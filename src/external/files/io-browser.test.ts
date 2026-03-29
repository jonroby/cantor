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
		files: {
			validateChatUpload: vi.fn(
				(data) =>
					({
						id: (data as ReturnType<typeof buildValidUploadData>).id,
						name: (data as ReturnType<typeof buildValidUploadData>).name,
						tree: {
							rootId: (data as ReturnType<typeof buildValidUploadData>).rootId,
							exchanges: (data as ReturnType<typeof buildValidUploadData>).exchanges
						},
						activeExchangeId: (data as ReturnType<typeof buildValidUploadData>).activeExchangeId
					}) as ReturnType<typeof import('@/external').files.validateChatUpload>
			)
		},
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

import * as state from '@/state';
import * as lib from '@/lib';
import * as app from '@/app';

// ── DOM mocking helpers ─────────────────────────────────────────────────────

let lastCreatedLink: { href: string; download: string; click: Mock };
let lastCreatedInput: {
	type: string;
	accept: string;
	webkitdirectory: boolean;
	files: File[] | null;
	onchange: (() => void) | null;
	click: Mock;
};

class MockFileReader {
	result: string | ArrayBuffer | null = null;
	onload: null | (() => void) = null;

	readAsText(file: File) {
		file
			.text()
			.then((text) => {
				this.result = text;
				this.onload?.();
			})
			.catch(() => {
				this.result = null;
				this.onload?.();
			});
	}
}

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

	lastCreatedLink = { href: '', download: '', click: vi.fn() };
	lastCreatedInput = {
		type: '',
		accept: '',
		webkitdirectory: false,
		files: null,
		onchange: null,
		click: vi.fn()
	};

	vi.stubGlobal('FileReader', MockFileReader);
	vi.stubGlobal('document', {
		createElement: vi.fn((tag: string) => {
			if (tag === 'a') return lastCreatedLink;
			if (tag === 'input') return lastCreatedInput;
			throw new Error(`Unexpected element: ${tag}`);
		}),
		body: {
			appendChild: vi.fn((n) => n),
			removeChild: vi.fn((n) => n)
		}
	});
	vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-url');
	vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

	// Reset chatState chats to default using domain helpers
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

describe('app import/export actions', () => {
	describe('chat.exportState', () => {
		it('creates a JSON blob and triggers download', () => {
			app.chat.exportState();

			expect(URL.createObjectURL).toHaveBeenCalled();
			expect(lastCreatedLink.click).toHaveBeenCalled();
			expect(lastCreatedLink.download).toMatch(/^chat-tree-\d+\.json$/);
			expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url');
		});
	});

	describe('chat.exportChat', () => {
		it('downloads a single chat as JSON', () => {
			app.chat.exportChat(0);

			expect(URL.createObjectURL).toHaveBeenCalled();
			expect(lastCreatedLink.click).toHaveBeenCalled();
			expect(lastCreatedLink.download).toBe('Test Chat.json');
		});

		it('strips invalid filename characters', () => {
			state.chats.chatState.chats[0].name = 'Chat/With:Bad*Chars?';
			app.chat.exportChat(0);

			expect(lastCreatedLink.download).toBe('ChatWithBadChars.json');
		});
	});

	describe('chat.importChat', () => {
		it('imports a valid chat file', async () => {
			const feedback = createFeedback();
			app.chat.importChat(feedback);

			const fileContent = JSON.stringify(buildValidUploadData());
			const file = new File([fileContent], 'Imported Chat.json', { type: 'application/json' });
			lastCreatedInput.files = [file];

			lastCreatedInput.onchange!();

			// Wait for async file reading
			await vi.waitFor(() => {
				expect(feedback.success).toHaveBeenCalled();
			});

			expect(state.chats.chatState.chats.length).toBe(2);
			expect(state.chats.chatState.activeChatIndex).toBe(1);
			expect(state.chats.chatState.chats[1].name).toBe('Imported Chat');
			expect(state.chats.chatState.chats[1].id).not.toBe('uploaded-id');
			expect(state.chats.chatState.chats[1].activeExchangeId).toBeDefined();
		});

		it('deduplicates imported chat names based on the filename', async () => {
			const feedback = createFeedback();
			state.chats.chatState.chats[0].name = 'Imported Chat';
			app.chat.importChat(feedback);

			const file = new File([JSON.stringify(buildValidUploadData())], 'Imported Chat.json', {
				type: 'application/json'
			});
			lastCreatedInput.files = [file];

			lastCreatedInput.onchange!();

			await vi.waitFor(() => {
				expect(feedback.success).toHaveBeenCalled();
			});

			expect(state.chats.chatState.chats[1].name).toBe('Imported Chat (1)');
		});

		it('shows error toast for invalid JSON', async () => {
			const feedback = createFeedback();
			app.chat.importChat(feedback);

			const file = new File(['not json'], 'bad.json', { type: 'application/json' });
			lastCreatedInput.files = [file];

			lastCreatedInput.onchange!();

			await vi.waitFor(() => {
				expect(feedback.error).toHaveBeenCalled();
			});
		});

		it('does nothing when no file selected', () => {
			const feedback = createFeedback();
			app.chat.importChat(feedback);

			lastCreatedInput.files = [] as unknown as File[];
			// Simulate onchange with no files
			Object.defineProperty(lastCreatedInput, 'files', {
				get: () => null
			});

			// Should not throw
			lastCreatedInput.onchange!();

			expect(feedback.success).not.toHaveBeenCalled();
			expect(feedback.error).not.toHaveBeenCalled();
		});
	});

	describe('documents.importDocument', () => {
		it('does nothing when no file is selected', () => {
			const feedback = createFeedback();
			app.documents.importDocument('folder-1', feedback);

			lastCreatedInput.files = null;
			lastCreatedInput.onchange!();

			expect(feedback.success).not.toHaveBeenCalled();
			expect(feedback.error).not.toHaveBeenCalled();
			expect(state.documents.documentState.folders[0].files).toHaveLength(1);
		});

		it('imports a valid markdown file', async () => {
			const feedback = createFeedback();
			app.documents.importDocument('folder-1', feedback);

			const file = new File(['# Test'], 'doc.md', { type: 'text/markdown' });
			lastCreatedInput.files = [file];

			lastCreatedInput.onchange!();

			// FileReader is async — wait for toast
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

			app.documents.importDocument('folder-1', feedback);

			const file = new File(['bad markdown'], 'bad.md', { type: 'text/markdown' });
			lastCreatedInput.files = [file];

			lastCreatedInput.onchange!();

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
			app.documents.importDocument('folder-1', feedback);

			const file = new File(['# Test'], 'doc.md', { type: 'text/markdown' });
			lastCreatedInput.files = [file];

			lastCreatedInput.onchange!();

			await vi.waitFor(() => {
				expect(feedback.success).toHaveBeenCalled();
			});

			expect(state.documents.documentState.folders[0].files).toHaveLength(1);
			expect(state.documents.documentState.folders[0].files?.[0]?.name).toBe('doc.md');
		});

		it('reports an error when uploading into a missing folder', async () => {
			const feedback = createFeedback();
			app.documents.importDocument('missing-folder', feedback);

			const file = new File(['# Test'], 'doc.md', { type: 'text/markdown' });
			lastCreatedInput.files = [file];
			lastCreatedInput.onchange!();

			await vi.waitFor(() => {
				expect(feedback.error).toHaveBeenCalledWith('Folder not found');
			});

			expect(feedback.success).not.toHaveBeenCalled();
		});
	});

	describe('documents.exportFolder', () => {
		it('creates a zip and triggers download', async () => {
			await app.documents.exportFolder('folder-1');

			expect(URL.createObjectURL).toHaveBeenCalled();
			expect(lastCreatedLink.download).toBe('Test Folder.zip');
			expect(lastCreatedLink.click).toHaveBeenCalled();
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

	describe('documents.importFolder', () => {
		it('shows error when no .md files found', () => {
			const feedback = createFeedback();
			app.documents.importFolder(feedback);

			const txtFile = new File(['text'], 'readme.txt');
			Object.defineProperty(txtFile, 'name', { value: 'readme.txt' });
			lastCreatedInput.files = [txtFile] as unknown as File[];

			lastCreatedInput.onchange!();

			expect(feedback.error).toHaveBeenCalledWith('No .md files found in the selected folder');
		});

		it('does nothing when no files selected', () => {
			const feedback = createFeedback();
			app.documents.importFolder(feedback);

			lastCreatedInput.files = null;
			lastCreatedInput.onchange!();

			expect(feedback.error).not.toHaveBeenCalled();
			expect(feedback.success).not.toHaveBeenCalled();
		});

		it('creates a new folder and imports .md files', async () => {
			const feedback = createFeedback();
			app.documents.importFolder(feedback);

			const mdFile = new File(['# Doc'], 'doc.md');
			Object.defineProperty(mdFile, 'webkitRelativePath', { value: 'MyFolder/doc.md' });
			lastCreatedInput.files = [mdFile] as unknown as File[];

			lastCreatedInput.onchange!();

			await vi.waitFor(() => {
				expect(state.documents.documentState.folders.length).toBe(2);
			});

			expect(state.documents.documentState.folders[1]).toMatchObject({
				name: 'MyFolder'
			});
		});

		it('falls back to "Uploaded Folder" when relative path is missing', async () => {
			const feedback = createFeedback();
			app.documents.importFolder(feedback);

			const mdFile = new File(['# Doc'], 'doc.md');
			lastCreatedInput.files = [mdFile] as unknown as File[];

			lastCreatedInput.onchange!();

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

			app.documents.importFolder(feedback);

			const mdFile = new File(['# Doc'], 'doc.md');
			Object.defineProperty(mdFile, 'webkitRelativePath', { value: 'MyFolder/doc.md' });
			lastCreatedInput.files = [mdFile] as unknown as File[];

			lastCreatedInput.onchange!();

			await vi.waitFor(() => {
				expect(state.documents.documentState.folders.length).toBe(3);
			});

			expect(state.documents.documentState.folders[2]).toMatchObject({
				name: 'MyFolder (1)'
			});
		});

		it('deduplicates duplicate file names within the uploaded batch for the new folder', async () => {
			const feedback = createFeedback();
			app.documents.importFolder(feedback);

			const first = new File(['# One'], 'doc.md');
			Object.defineProperty(first, 'webkitRelativePath', { value: 'Batch/doc.md' });
			const second = new File(['# Two'], 'doc.md');
			Object.defineProperty(second, 'webkitRelativePath', { value: 'Batch/doc.md' });
			lastCreatedInput.files = [first, second] as unknown as File[];

			lastCreatedInput.onchange!();

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

			app.documents.importFolder(feedback);

			const validFile = new File(['# Good'], 'good.md');
			Object.defineProperty(validFile, 'webkitRelativePath', { value: 'Mixed/good.md' });
			const invalidFile = new File(['bad markdown'], 'bad.md');
			Object.defineProperty(invalidFile, 'webkitRelativePath', { value: 'Mixed/bad.md' });
			lastCreatedInput.files = [validFile, invalidFile] as unknown as File[];

			lastCreatedInput.onchange!();

			await vi.waitFor(() => {
				expect(feedback.error).toHaveBeenCalledWith(expect.stringContaining('Skipped bad.md'));
			});

			await vi.waitFor(() => {
				expect(feedback.success).toHaveBeenCalledWith('Uploaded 1 file');
			});
		});
	});

	describe('documents.importFolderIntoFolder', () => {
		it('shows error when no .md files found', () => {
			const feedback = createFeedback();
			app.documents.importFolderIntoFolder('folder-1', feedback);

			const txtFile = new File(['text'], 'readme.txt');
			lastCreatedInput.files = [txtFile] as unknown as File[];

			lastCreatedInput.onchange!();

			expect(feedback.error).toHaveBeenCalledWith('No .md files found in the selected folder');
		});

		it('does nothing when no files selected', () => {
			const feedback = createFeedback();
			app.documents.importFolderIntoFolder('folder-1', feedback);

			lastCreatedInput.files = null;
			lastCreatedInput.onchange!();

			expect(feedback.error).not.toHaveBeenCalled();
		});

		it('imports markdown files into an existing folder and summarizes the count', async () => {
			const feedback = createFeedback();
			app.documents.importFolderIntoFolder('folder-1', feedback);

			const first = new File(['# One'], 'doc.md');
			const second = new File(['# Two'], 'doc.md');
			lastCreatedInput.files = [first, second] as unknown as File[];

			lastCreatedInput.onchange!();

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
			app.documents.importFolderIntoFolder('missing-folder', feedback);

			const file = new File(['# One'], 'doc.md');
			lastCreatedInput.files = [file] as unknown as File[];

			lastCreatedInput.onchange!();

			await vi.waitFor(() => {
				expect(feedback.error).toHaveBeenCalledWith('Folder not found');
			});

			expect(feedback.success).not.toHaveBeenCalled();
		});
	});
});
