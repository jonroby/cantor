import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';
import * as domain from '@/domain';

vi.mock('jszip', async () => {
	const mocks = await import('@/tests/mocks/jszip');
	return await mocks.mockJSZipModule();
});
vi.mock('@/state', async () => {
	const mocks = await import('@/tests/mocks/state');
	return await mocks.mockStateModule();
});
vi.mock('@/external', async () => {
	const mocks = await import('@/tests/mocks/external');
	return await mocks.mockExternalModule();
});
vi.mock('../../chat/index', async () => {
	const mocks = await import('@/tests/mocks/app');
	return await mocks.mockAppChatModule();
});

import * as documents from '../index';
import * as state from '@/state';
import * as lib from '@/lib';
import * as external from '@/external';

import {
	addDocumentToChat,
	createDocument,
	createFileWithContent,
	createFolder,
	createNamedFolder,
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
			contextStrategy: 'full' as const,
			mode: 'chat' as const
		}),
		findFolder: () => undefined,
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
	vi.spyOn(lib.validateMd, 'validate').mockReturnValue([]);
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
			exchanges: defaultData.exchanges,
			contextStrategy: 'full',
			mode: 'chat'
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
	state.documents.documentState.openDocuments = [];
	vi.mocked(state.documents.findFolder).mockImplementation((folderId: string) => {
		const visit = (
			folders: typeof state.documents.documentState.folders
		): (typeof folders)[number] | undefined => {
			for (const folder of folders) {
				if (folder.id === folderId) return folder;
				const nested = visit(folder.folders ?? []);
				if (nested) return nested;
			}
			return undefined;
		};
		return visit(state.documents.documentState.folders);
	});
	vi.mocked(state.documents.newFolder).mockImplementation((parentId?: string) => {
		const folderId = crypto.randomUUID();
		const folder = {
			id: folderId,
			name: 'New Folder',
			files: [] as (typeof state.documents.documentState.folders)[number]['files']
		};
		if (parentId) {
			const parent = state.documents.findFolder(parentId);
			if (parent) parent.folders = [...(parent.folders ?? []), folder];
		} else {
			state.documents.documentState.folders = [...state.documents.documentState.folders, folder];
		}
		return folderId;
	});
	vi.mocked(state.documents.renameFolder).mockImplementation((folderId: string, name: string) => {
		const folder = state.documents.findFolder(folderId);
		if (!folder) return false;
		const siblings = state.documents.documentState.folders;
		if (siblings.some((candidate) => candidate.id !== folderId && candidate.name === name))
			return false;
		folder.name = name;
		return true;
	});
	vi.mocked(state.documents.createDocumentInFolder).mockImplementation((folderId: string) => {
		const folder = state.documents.findFolder(folderId);
		if (!folder) return null;
		const fileId = crypto.randomUUID();
		folder.files = [...(folder.files ?? []), { id: fileId, name: 'Untitled.md', content: '' }];
		return fileId;
	});
	vi.mocked(state.documents.selectDocument).mockImplementation(
		(folderId: string, fileId: string) => {
			state.documents.documentState.openDocuments = [
				...state.documents.documentState.openDocuments,
				{ id: crypto.randomUUID(), content: '', documentKey: { folderId, fileId } }
			];
		}
	);
	vi.mocked(state.documents.renameDocumentInFolder).mockImplementation(
		(folderId: string, fileId: string, name: string) => {
			const folder = state.documents.findFolder(folderId);
			const file = folder?.files?.find((candidate) => candidate.id === fileId);
			if (!file) return false;
			if (folder?.files?.some((candidate) => candidate.id !== fileId && candidate.name === name)) {
				return false;
			}
			file.name = name;
			return true;
		}
	);
	vi.mocked(state.documents.updateDocumentContent).mockImplementation(
		(index: number, content: string) => {
			const openDocument = state.documents.documentState.openDocuments[index];
			if (!openDocument) return;
			openDocument.content = content;
			const key = openDocument.documentKey;
			if (!key) return;
			const file = state.documents
				.findFolder(key.folderId)
				?.files?.find((candidate) => candidate.id === key.fileId);
			if (file) file.content = content;
		}
	);
});

// ── Public API ──────────────────────────────────────────────────────────────

describe('document app actions', () => {
	it('opens an existing document', () => {
		const selectDocument = vi.fn();
		const deps = createDeps({
			findFolder: () => ({
				id: 'folder-1',
				name: 'Docs',
				files: [{ id: 'file-1', name: 'a.md', content: '' }]
			}),
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

	it('creates a named folder through the mocked state layer', () => {
		const result = createNamedFolder('Specs');

		expect(state.documents.newFolder).toHaveBeenCalledWith(undefined);
		expect(state.documents.renameFolder).toHaveBeenCalled();
		expect(result).toEqual({
			folderId: expect.any(String),
			name: 'Specs'
		});
	});

	it('creates a file with content through the mocked state layer', () => {
		const result = createFileWithContent('folder-1', 'notes.md', '# Notes');

		expect(state.documents.createDocumentInFolder).toHaveBeenCalledWith('folder-1');
		expect(state.documents.renameDocumentInFolder).toHaveBeenCalled();
		expect(state.documents.updateDocumentContent).toHaveBeenCalled();
		expect(result).toMatchObject({
			result: {
				folderId: 'folder-1',
				name: 'notes.md',
				path: 'notes.md'
			}
		});
	});

	it('rejects unsupported file names before creating a file', () => {
		const fileCount = state.documents.documentState.folders[0].files?.length ?? 0;

		const result = createFileWithContent('folder-1', 'notes.txt', '# Notes');

		expect(result).toEqual({
			result: null,
			error: 'Cantor only supports: .md, .svg'
		});
		expect(state.documents.documentState.folders[0].files).toHaveLength(fileCount);
	});

	it('adds a folder document to the active chat', () => {
		const appendDocumentToChat = vi.fn(() => 'exchange-9');
		const deps = createDeps({
			findFolder: () => ({
				id: 'folder-1',
				name: 'Docs',
				files: [{ id: 'file-1', name: 'notes.md', content: '# Notes' }]
			}),
			appendDocumentToChat
		});

		expect(addDocumentToChat('folder-1', 'file-1', deps)).toBe('exchange-9');
		expect(appendDocumentToChat).toHaveBeenCalledWith(
			{ rootId: 'root-1', exchanges: {} },
			'root-1',
			'# Notes',
			'notes.md'
		);
	});

	it('exposes the expected public API', () => {
		expect(Object.keys(documents).sort()).toEqual([
			'SUPPORTED_EXTENSIONS',
			'addDocumentToChat',
			'closeDocument',
			'closeOpenDocument',
			'createDocument',
			'createFileWithContent',
			'createFolder',
			'createNamedFolder',
			'deleteDocument',
			'deleteFolder',
			'exportFolder',
			'findOpenDocumentIndex',
			'getDocument',
			'getFolder',
			'getState',
			'importDocument',
			'importFolder',
			'importFolderIntoFolder',
			'isSupportedFileName',
			'moveDocument',
			'openDocument',
			'renameDocument',
			'renameFolder',
			'resolveAsset',
			'supportedExtensionsLabel',
			'updateDocumentContent',
			'updateOpenDocumentContent',
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
		documents.importDocument('folder-1', feedback);
		await flushAsyncWork();

		expect(feedback.success).not.toHaveBeenCalled();
		expect(feedback.error).not.toHaveBeenCalled();
		expect(state.documents.documentState.folders[0].files).toHaveLength(1);
	});

	it('imports a valid markdown file', async () => {
		const feedback = createFeedback();
		const file = new File(['# Test'], 'doc.md', { type: 'text/markdown' });
		nextPickedFile = file;
		documents.importDocument('folder-1', feedback);

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
		vi.spyOn(lib.validateMd, 'validate').mockReturnValue(['Invalid heading']);
		const feedback = createFeedback();
		const file = new File(['bad markdown'], 'bad.md', { type: 'text/markdown' });
		nextPickedFile = file;
		documents.importDocument('folder-1', feedback);

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
		documents.importDocument('folder-1', feedback);

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
		documents.importDocument('missing-folder', feedback);

		await vi.waitFor(() => {
			expect(feedback.error).toHaveBeenCalledWith('Folder not found');
		});

		expect(feedback.success).not.toHaveBeenCalled();
	});
});

// ── exportFolder ────────────────────────────────────────────────────────────

describe('documents.exportFolder', () => {
	it('creates a zip and triggers download', async () => {
		await documents.exportFolder('folder-1');

		expect(external.io.downloadBlob).toHaveBeenCalledOnce();
		expect(downloads[0]?.filename).toBe('Test Folder.zip');
	});

	it('shows error for empty folder', async () => {
		const feedback = createFeedback();
		state.documents.documentState.folders = [
			{ id: 'empty-folder', name: 'Empty', files: [] }
		] as typeof state.documents.documentState.folders;

		await documents.exportFolder('empty-folder', feedback);

		expect(feedback.error).toHaveBeenCalledWith('Folder is empty');
	});

	it('shows error for folder with no files property', async () => {
		const feedback = createFeedback();
		state.documents.documentState.folders = [
			{ id: 'no-files', name: 'NoFiles' }
		] as typeof state.documents.documentState.folders;

		await documents.exportFolder('no-files', feedback);

		expect(feedback.error).toHaveBeenCalledWith('Folder is empty');
	});

	it('shows error for nonexistent folder', async () => {
		const feedback = createFeedback();
		await documents.exportFolder('nonexistent', feedback);

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
		documents.importFolder(feedback);
		await flushAsyncWork();

		expect(feedback.error).toHaveBeenCalledWith(
			'No .md or .svg files found in the selected folder'
		);
	});

	it('does nothing when no files selected', async () => {
		const feedback = createFeedback();
		nextPickedDirectory = [];
		documents.importFolder(feedback);
		await flushAsyncWork();

		expect(feedback.error).not.toHaveBeenCalled();
		expect(feedback.success).not.toHaveBeenCalled();
	});

	it('creates a new folder and imports .md files', async () => {
		const feedback = createFeedback();
		const mdFile = new File(['# Doc'], 'doc.md');
		Object.defineProperty(mdFile, 'webkitRelativePath', { value: 'MyFolder/doc.md' });
		nextPickedDirectory = [mdFile];
		documents.importFolder(feedback);

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
		documents.importFolder(feedback);

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
		documents.importFolder(feedback);

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
		documents.importFolder(feedback);

		await vi.waitFor(() => {
			expect(feedback.success).toHaveBeenCalledWith('Uploaded 2 files');
		});

		expect(state.documents.documentState.folders[1]?.name).toBe('Batch');
		expect(
			state.documents.documentState.folders[1]?.files?.map((file: { name: string }) => file.name)
		).toEqual(['doc.md', 'doc (1).md']);
	});

	it('still shows a success summary for valid files when one file in the batch is invalid', async () => {
		vi.spyOn(lib.validateMd, 'validate').mockImplementation((markdown: string) =>
			markdown.includes('bad') ? ['Invalid heading'] : []
		);
		const feedback = createFeedback();

		const validFile = new File(['# Good'], 'good.md');
		Object.defineProperty(validFile, 'webkitRelativePath', { value: 'Mixed/good.md' });
		const invalidFile = new File(['bad markdown'], 'bad.md');
		Object.defineProperty(invalidFile, 'webkitRelativePath', { value: 'Mixed/bad.md' });
		nextPickedDirectory = [validFile, invalidFile];
		documents.importFolder(feedback);

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
		documents.importFolderIntoFolder('folder-1', feedback);
		await flushAsyncWork();

		expect(feedback.error).toHaveBeenCalledWith(
			'No .md or .svg files found in the selected folder'
		);
	});

	it('does nothing when no files selected', async () => {
		const feedback = createFeedback();
		nextPickedDirectory = [];
		documents.importFolderIntoFolder('folder-1', feedback);
		await flushAsyncWork();

		expect(feedback.error).not.toHaveBeenCalled();
	});

	it('imports markdown files into an existing folder and summarizes the count', async () => {
		const feedback = createFeedback();
		const first = new File(['# One'], 'doc.md');
		const second = new File(['# Two'], 'doc.md');
		nextPickedDirectory = [first, second];
		documents.importFolderIntoFolder('folder-1', feedback);

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
		documents.importFolderIntoFolder('missing-folder', feedback);

		await vi.waitFor(() => {
			expect(feedback.error).toHaveBeenCalledWith('Folder not found');
		});

		expect(feedback.success).not.toHaveBeenCalled();
	});
});
