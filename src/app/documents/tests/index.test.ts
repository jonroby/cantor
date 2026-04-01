import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';
import * as domain from '@/domain';

vi.mock('jszip', () => {
	const mockFile = vi.fn();
	const mockGenerateAsync = vi.fn().mockResolvedValue(new Blob(['zip-content']));
	class MockJSZip {
		file = mockFile;
		generateAsync = mockGenerateAsync;
	}
	return {
		default: MockJSZip
	};
});

vi.mock('@/state', async () => {
	const actual = await vi.importActual<typeof import('@/state')>('@/state');
	const importedDomain = await vi.importActual<typeof import('@/domain')>('@/domain');
	const empty = importedDomain.tree.buildEmptyTree();
	const result = importedDomain.tree.addExchange(
		empty,
		'unused',
		'hello',
		'claude-sonnet-4-6',
		'claude'
	);
	const exchanges = importedDomain.tree.updateExchangeResponse(
		result.tree.exchanges,
		result.id,
		'world'
	);
	const tree = { rootId: result.tree.rootId, exchanges };
	const chatState = {
		chats: [
			{
				id: 'chat-1',
				name: 'Test Chat',
				rootId: tree.rootId,
				exchanges: tree.exchanges,
				activeExchangeId: importedDomain.tree.getMainChatTail(tree)
			}
		],
		activeChatIndex: 0
	};
	const documentState = {
		folders: [
			{
				id: 'folder-1',
				name: 'Test Folder',
				files: [{ id: 'file-1', name: 'doc.md', content: '# Hello' }]
			}
		]
	};
	return {
		...actual,
		chatState,
		documentState,
		chats: {
			...actual.chats,
			chatState
		},
		documents: {
			...actual.documents,
			documentState
		}
	};
});

vi.mock('@/lib', async (importOriginal) => ({
	...(await importOriginal<typeof import('@/lib')>()),
	validateMd: {
		validate: vi.fn().mockReturnValue([])
	}
}));

vi.mock('@/external', async () => {
	const { createExternalMock } = await import('@/tests/mocks/external');
	return createExternalMock({
		providers: {
			webllm: {
				getWebLLMModels: vi.fn(async () => [])
			},
			vault: {
				storedProviders: vi.fn(() => [])
			}
		},
		persistence: {
			getPersistedLayout: vi.fn(() => ({}))
		}
	});
});

vi.mock('../../chat/index', async () => {
	const actual = await import('../../chat/index');
	return {
		...actual,
		addDocumentToChat: vi.fn()
	};
});

import * as documents from '../index';
import * as state from '@/state';
import * as lib from '@/lib';
import * as app from '@/app';
import * as external from '@/external';

import {
	addDocumentToChat,
	createDocument,
	createFolder,
	deleteDocument,
	getDocument,
	getState,
	importDocument,
	importFolder,
	importFolderIntoFolder,
	moveDocument,
	openDocument,
	exportFolder,
	renameDocument,
	updateDocumentContent,
	validateDocumentMarkdown,
	type DocumentCommandDeps
} from '../index';

// ── Helpers ─────────────────────────────────────────────────────────────────

function createDeps(overrides: Partial<DocumentCommandDeps> = {}): DocumentCommandDeps {
	return {
		getActiveChat: () => ({
			id: 'chat-1',
			name: 'Chat 1',
			rootId: 'root-1',
			exchanges: {},
			activeExchangeId: 'root-1',
			contextStrategy: 'full' as const
		}),
		getFolders: () => [],
		createDocumentInFolder: vi.fn(() => null),
		selectDocument: vi.fn(),
		appendDocumentToChat: vi.fn(() => 'exchange-1'),
		...overrides
	};
}

// ── Transfer helpers ────────────────────────────────────────────────────────

let nextPickedFile: File | null;
let nextPickedDirectory: File[];
let downloads: Array<{ blob: Blob; filename: string }>;

type TransferFeedback = {
	success: Mock;
	error: Mock;
};

function createFeedback(): TransferFeedback {
	return {
		success: vi.fn(),
		error: vi.fn()
	};
}

async function flushAsyncWork() {
	await Promise.resolve();
	await Promise.resolve();
}

function buildValidUploadData() {
	let tree = domain.tree.buildEmptyTree();
	const result = domain.tree.addExchange(tree, 'unused', 'hello', 'claude-sonnet-4-6', 'claude');
	tree = {
		rootId: result.tree.rootId,
		exchanges: domain.tree.updateExchangeResponse(result.tree.exchanges, result.id, 'response')
	};

	return {
		id: 'uploaded-id',
		name: 'Uploaded Chat',
		rootId: tree.rootId,
		activeExchangeId: result.id,
		exchanges: tree.exchanges
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(lib.validateMd.validate).mockReturnValue([]);
	nextPickedFile = null;
	nextPickedDirectory = [];
	downloads = [];
	vi.mocked(external.io.pickFile).mockImplementation(async () => nextPickedFile);
	vi.mocked(external.io.pickDirectory).mockImplementation(async () => nextPickedDirectory);
	vi.mocked(external.io.downloadBlob).mockImplementation((blob, filename) => {
		downloads.push({ blob, filename });
	});

	const defaultData = buildValidUploadData();
	state.chats.chatState.chats = [
		{
			id: 'chat-1',
			name: 'Test Chat',
			rootId: defaultData.rootId,
			activeExchangeId: defaultData.activeExchangeId,
			exchanges: defaultData.exchanges
		}
	] as typeof state.chats.chatState.chats;
	state.chats.chatState.activeChatIndex = 0;

	state.documents.documentState.folders = [
		{
			id: 'folder-1',
			name: 'Test Folder',
			files: [{ id: 'file-1', name: 'doc.md', content: '# Hello' }]
		}
	] as typeof state.documents.documentState.folders;
});

// ── Public API ──────────────────────────────────────────────────────────────

describe('document app actions', () => {
	it('opens an existing document', () => {
		const selectDocument = vi.fn();
		const deps = createDeps({
			getFolders: () => [
				{ id: 'folder-1', name: 'Docs', files: [{ id: 'file-1', name: 'a.md', content: '' }] }
			],
			selectDocument
		});

		expect(openDocument('folder-1', 'file-1', deps)).toBe(true);
		expect(selectDocument).toHaveBeenCalledWith('folder-1', 'file-1');
	});

	it('creates a document and selects it', () => {
		const createDocumentInFolder = vi.fn(() => 'file-2');
		const selectDocument = vi.fn();
		const deps = createDeps({
			createDocumentInFolder,
			selectDocument
		});

		expect(createDocument('folder-1', deps)).toEqual({
			folderId: 'folder-1',
			fileId: 'file-2'
		});
		expect(createDocumentInFolder).toHaveBeenCalledWith('folder-1');
		expect(selectDocument).toHaveBeenCalledWith('folder-1', 'file-2');
	});

	it('adds a folder document to the active chat', () => {
		const appendDocumentToChat = vi.fn(() => 'exchange-9');
		const deps = createDeps({
			getFolders: () => [
				{
					id: 'folder-1',
					name: 'Docs',
					files: [{ id: 'file-1', name: 'notes.md', content: '# Notes' }]
				}
			],
			appendDocumentToChat
		});

		expect(addDocumentToChat('folder-1', 'file-1', deps)).toBe(true);
		expect(appendDocumentToChat).toHaveBeenCalledWith(
			{ rootId: 'root-1', exchanges: {} },
			'root-1',
			'# Notes',
			'notes.md'
		);
	});

	it('exposes the expected public API', () => {
		expect(Object.keys(documents).sort()).toEqual([
			'addDocumentToChat',
			'closeDocument',
			'createDocument',
			'createFolder',
			'deleteDocument',
			'deleteFolder',
			'exportFolder',
			'getDocument',
			'getState',
			'importDocument',
			'importFolder',
			'importFolderIntoFolder',
			'moveDocument',
			'openDocument',
			'renameDocument',
			'renameFolder',
			'updateDocumentContent',
			'validateDocumentMarkdown'
		]);
		expect(createFolder).toBeTypeOf('function');
		expect(deleteDocument).toBeTypeOf('function');
		expect(getDocument).toBeTypeOf('function');
		expect(getState).toBeTypeOf('function');
		expect(importDocument).toBeTypeOf('function');
		expect(importFolder).toBeTypeOf('function');
		expect(importFolderIntoFolder).toBeTypeOf('function');
		expect(moveDocument).toBeTypeOf('function');
		expect(renameDocument).toBeTypeOf('function');
		expect(updateDocumentContent).toBeTypeOf('function');
		expect(validateDocumentMarkdown).toBeTypeOf('function');
		expect(exportFolder).toBeTypeOf('function');
	});
});

// ── importDocument ──────────────────────────────────────────────────────────

describe('documents.importDocument', () => {
	it('does nothing when no file is selected', async () => {
		const feedback = createFeedback();
		nextPickedFile = null;
		app.documents.importDocument('folder-1', feedback);
		await flushAsyncWork();

		expect(feedback.success).not.toHaveBeenCalled();
		expect(feedback.error).not.toHaveBeenCalled();
		expect(state.documents.documentState.folders[0].files).toHaveLength(1);
	});

	it('imports a valid markdown file', async () => {
		const feedback = createFeedback();
		const file = new File(['# Test'], 'doc.md', { type: 'text/markdown' });
		nextPickedFile = file;
		app.documents.importDocument('folder-1', feedback);

		await vi.waitFor(() => {
			expect(feedback.success).toHaveBeenCalled();
		});

		expect(state.documents.documentState.folders[0].files).toHaveLength(2);
		expect(state.documents.documentState.folders[0].files?.[1]).toMatchObject({
			name: 'doc (1).md',
			content: '# Test'
		});
	});

	it('shows error toast for invalid markdown', async () => {
		vi.mocked(lib.validateMd.validate).mockReturnValue(['Invalid heading']);
		const feedback = createFeedback();
		const file = new File(['bad markdown'], 'bad.md', { type: 'text/markdown' });
		nextPickedFile = file;
		app.documents.importDocument('folder-1', feedback);

		await vi.waitFor(() => {
			expect(feedback.error).toHaveBeenCalledWith(expect.stringContaining('Invalid markdown'));
		});

		expect(state.documents.documentState.folders[0].files).toHaveLength(1);
	});

	it('creates the files array when the target folder has none', async () => {
		const feedback = createFeedback();
		state.documents.documentState.folders = [
			{ id: 'folder-1', name: 'Test Folder' }
		] as typeof state.documents.documentState.folders;
		const file = new File(['# Test'], 'doc.md', { type: 'text/markdown' });
		nextPickedFile = file;
		app.documents.importDocument('folder-1', feedback);

		await vi.waitFor(() => {
			expect(feedback.success).toHaveBeenCalled();
		});

		expect(state.documents.documentState.folders[0].files).toHaveLength(1);
		expect(state.documents.documentState.folders[0].files?.[0]?.name).toBe('doc.md');
	});

	it('reports an error when uploading into a missing folder', async () => {
		const feedback = createFeedback();
		const file = new File(['# Test'], 'doc.md', { type: 'text/markdown' });
		nextPickedFile = file;
		app.documents.importDocument('missing-folder', feedback);

		await vi.waitFor(() => {
			expect(feedback.error).toHaveBeenCalledWith('Folder not found');
		});

		expect(feedback.success).not.toHaveBeenCalled();
	});
});

// ── exportFolder ────────────────────────────────────────────────────────────

describe('documents.exportFolder', () => {
	it('creates a zip and triggers download', async () => {
		await app.documents.exportFolder('folder-1');

		expect(external.io.downloadBlob).toHaveBeenCalledOnce();
		expect(downloads[0]?.filename).toBe('Test Folder.zip');
	});

	it('shows error for empty folder', async () => {
		const feedback = createFeedback();
		state.documents.documentState.folders = [
			{ id: 'empty-folder', name: 'Empty', files: [] }
		] as typeof state.documents.documentState.folders;

		await app.documents.exportFolder('empty-folder', feedback);

		expect(feedback.error).toHaveBeenCalledWith('Folder is empty');
	});

	it('shows error for folder with no files property', async () => {
		const feedback = createFeedback();
		state.documents.documentState.folders = [
			{ id: 'no-files', name: 'NoFiles' }
		] as typeof state.documents.documentState.folders;

		await app.documents.exportFolder('no-files', feedback);

		expect(feedback.error).toHaveBeenCalledWith('Folder is empty');
	});

	it('shows error for nonexistent folder', async () => {
		const feedback = createFeedback();
		await app.documents.exportFolder('nonexistent', feedback);

		expect(feedback.error).toHaveBeenCalledWith('Folder is empty');
	});
});

// ── importFolder ────────────────────────────────────────────────────────────

describe('documents.importFolder', () => {
	it('shows error when no .md files found', async () => {
		const feedback = createFeedback();
		const txtFile = new File(['text'], 'readme.txt');
		Object.defineProperty(txtFile, 'name', { value: 'readme.txt' });
		nextPickedDirectory = [txtFile];
		app.documents.importFolder(feedback);
		await flushAsyncWork();

		expect(feedback.error).toHaveBeenCalledWith('No .md files found in the selected folder');
	});

	it('does nothing when no files selected', async () => {
		const feedback = createFeedback();
		nextPickedDirectory = [];
		app.documents.importFolder(feedback);
		await flushAsyncWork();

		expect(feedback.error).not.toHaveBeenCalled();
		expect(feedback.success).not.toHaveBeenCalled();
	});

	it('creates a new folder and imports .md files', async () => {
		const feedback = createFeedback();
		const mdFile = new File(['# Doc'], 'doc.md');
		Object.defineProperty(mdFile, 'webkitRelativePath', { value: 'MyFolder/doc.md' });
		nextPickedDirectory = [mdFile];
		app.documents.importFolder(feedback);

		await vi.waitFor(() => {
			expect(state.documents.documentState.folders.length).toBe(2);
		});

		expect(state.documents.documentState.folders[1]).toMatchObject({
			name: 'MyFolder'
		});
	});

	it('falls back to "Uploaded Folder" when relative path is missing', async () => {
		const feedback = createFeedback();
		const mdFile = new File(['# Doc'], 'doc.md');
		nextPickedDirectory = [mdFile];
		app.documents.importFolder(feedback);

		await vi.waitFor(() => {
			expect(state.documents.documentState.folders.length).toBe(2);
		});

		expect(state.documents.documentState.folders[1]?.name).toBe('Uploaded Folder');
	});

	it('deduplicates the created folder name when the uploaded directory already exists', async () => {
		const feedback = createFeedback();
		state.documents.documentState.folders = [
			{
				id: 'folder-1',
				name: 'Test Folder',
				files: [{ id: 'doc-1', name: 'doc.md', content: '# Existing' }]
			},
			{ id: 'folder-2', name: 'MyFolder', files: [] }
		] as typeof state.documents.documentState.folders;

		const mdFile = new File(['# Doc'], 'doc.md');
		Object.defineProperty(mdFile, 'webkitRelativePath', { value: 'MyFolder/doc.md' });
		nextPickedDirectory = [mdFile];
		app.documents.importFolder(feedback);

		await vi.waitFor(() => {
			expect(state.documents.documentState.folders.length).toBe(3);
		});

		expect(state.documents.documentState.folders[2]).toMatchObject({
			name: 'MyFolder (1)'
		});
	});

	it('deduplicates duplicate file names within the uploaded batch for the new folder', async () => {
		const feedback = createFeedback();
		const first = new File(['# One'], 'doc.md');
		Object.defineProperty(first, 'webkitRelativePath', { value: 'Batch/doc.md' });
		const second = new File(['# Two'], 'doc.md');
		Object.defineProperty(second, 'webkitRelativePath', { value: 'Batch/doc.md' });
		nextPickedDirectory = [first, second];
		app.documents.importFolder(feedback);

		await vi.waitFor(() => {
			expect(feedback.success).toHaveBeenCalledWith('Uploaded 2 files');
		});

		expect(state.documents.documentState.folders[1]?.name).toBe('Batch');
		expect(
			state.documents.documentState.folders[1]?.files?.map((file: { name: string }) => file.name)
		).toEqual(['doc.md', 'doc (1).md']);
	});

	it('still shows a success summary for valid files when one file in the batch is invalid', async () => {
		vi.mocked(lib.validateMd.validate).mockImplementation((markdown: string) =>
			markdown.includes('bad') ? ['Invalid heading'] : []
		);
		const feedback = createFeedback();

		const validFile = new File(['# Good'], 'good.md');
		Object.defineProperty(validFile, 'webkitRelativePath', { value: 'Mixed/good.md' });
		const invalidFile = new File(['bad markdown'], 'bad.md');
		Object.defineProperty(invalidFile, 'webkitRelativePath', { value: 'Mixed/bad.md' });
		nextPickedDirectory = [validFile, invalidFile];
		app.documents.importFolder(feedback);

		await vi.waitFor(() => {
			expect(feedback.error).toHaveBeenCalledWith(expect.stringContaining('Skipped bad.md'));
		});

		await vi.waitFor(() => {
			expect(feedback.success).toHaveBeenCalledWith('Uploaded 1 file');
		});
	});
});

// ── importFolderIntoFolder ──────────────────────────────────────────────────

describe('documents.importFolderIntoFolder', () => {
	it('shows error when no .md files found', async () => {
		const feedback = createFeedback();
		const txtFile = new File(['text'], 'readme.txt');
		nextPickedDirectory = [txtFile];
		app.documents.importFolderIntoFolder('folder-1', feedback);
		await flushAsyncWork();

		expect(feedback.error).toHaveBeenCalledWith('No .md files found in the selected folder');
	});

	it('does nothing when no files selected', async () => {
		const feedback = createFeedback();
		nextPickedDirectory = [];
		app.documents.importFolderIntoFolder('folder-1', feedback);
		await flushAsyncWork();

		expect(feedback.error).not.toHaveBeenCalled();
	});

	it('imports markdown files into an existing folder and summarizes the count', async () => {
		const feedback = createFeedback();
		const first = new File(['# One'], 'doc.md');
		const second = new File(['# Two'], 'doc.md');
		nextPickedDirectory = [first, second];
		app.documents.importFolderIntoFolder('folder-1', feedback);

		await vi.waitFor(() => {
			expect(feedback.success).toHaveBeenCalledWith('Uploaded 2 files');
		});

		expect(state.documents.documentState.folders[0].files).toHaveLength(3);
		expect(
			state.documents.documentState.folders[0].files?.map((file: { name: string }) => file.name)
		).toEqual(['doc.md', 'doc (1).md', 'doc (2).md']);
	});

	it('reports an error when the target folder does not exist', async () => {
		const feedback = createFeedback();
		const file = new File(['# One'], 'doc.md');
		nextPickedDirectory = [file];
		app.documents.importFolderIntoFolder('missing-folder', feedback);

		await vi.waitFor(() => {
			expect(feedback.error).toHaveBeenCalledWith('Folder not found');
		});

		expect(feedback.success).not.toHaveBeenCalled();
	});
});
