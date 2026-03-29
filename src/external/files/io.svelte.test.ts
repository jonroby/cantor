import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';
import { addExchangeResult, buildEmptyTree, updateExchangeResponse } from '@/domain';

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
	const { buildEmptyTree, addExchangeResult, updateExchangeResponse, getMainChatTail } =
		await vi.importActual<typeof import('@/domain')>('@/domain');
	const empty = buildEmptyTree();
	const result = addExchangeResult(empty, 'unused', 'hello', 'claude-sonnet-4-6', 'claude');
	const exchanges = updateExchangeResponse(result.exchanges, result.id, 'world');
	const tree = { rootId: result.rootId, exchanges };
	const chatState = {
		chats: [
			{
				id: 'chat-1',
				name: 'Test Chat',
				rootId: tree.rootId,
				exchanges: tree.exchanges,
				activeExchangeId: getMainChatTail(tree)
			}
		],
		activeChatIndex: 0
	};
	const docState = {
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
		docState,
		chats: {
			...actual.chats,
			chatState
		},
		documents: {
			...actual.documents,
			docState
		}
	};
});

vi.mock('@/lib', async (importOriginal) => ({
	...(await importOriginal<typeof import('@/lib')>()),
	validate: vi.fn().mockReturnValue([]),
	validateMd: {
		validate: vi.fn().mockReturnValue([])
	}
}));

vi.mock('@/external', () => ({
	files: {
		validateChatUpload: vi.fn((data) => data),
		deduplicateName: vi.fn((name: string, existingNames: string[]) => {
			if (!existingNames.includes(name)) return name;
			const ext = name.lastIndexOf('.') !== -1 ? name.slice(name.lastIndexOf('.')) : '';
			const base = ext ? name.slice(0, name.lastIndexOf('.')) : name;
			let i = 1;
			while (existingNames.includes(`${base} (${i})${ext}`)) i++;
			return `${base} (${i})${ext}`;
		})
	},
	providers: {
		DEFAULT_OLLAMA_URL: 'http://localhost:11434',
		fetchAvailableModels: vi.fn(),
		fetchModelContextLength: vi.fn(),
		getWebLLMModels: vi.fn(() => []),
		loadWebLLMModel: vi.fn(),
		deleteModelCache: vi.fn(),
		deleteAllModelCaches: vi.fn(),
		clearProviderKey: vi.fn(),
		loadAllApiKeys: vi.fn(),
		migrateVault: vi.fn(),
		saveApiKey: vi.fn(),
		storedProviders: vi.fn(() => [])
	},
	persistence: {
		getPersistedLayout: vi.fn(() => ({})),
		saveToStorage: vi.fn(),
		setPersistedLayout: vi.fn()
	},
	streams: {
		startStream: vi.fn(),
		cancelStream: vi.fn(),
		cancelAllStreams: vi.fn(),
		cancelStreamsForExchanges: vi.fn(),
		cancelStreamsForChat: vi.fn(),
		isStreaming: vi.fn(() => false),
		isAnyStreaming: vi.fn(() => false),
		getProviderStream: vi.fn()
	}
}));

import { chatState } from '@/state';
import { docState } from '@/state';
import * as lib from '@/lib';
import {
	downloadToFile,
	downloadChat,
	uploadChat,
	uploadDocToFolder,
	downloadFolder,
	uploadFolder,
	uploadFolderToFolder
} from '@/app';
import type { FileCommandFeedback } from '@/app';

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

function createFeedback(): Required<FileCommandFeedback> {
	return {
		success: vi.fn(),
		error: vi.fn()
	};
}

function buildValidUploadData() {
	let tree = buildEmptyTree();
	const result = addExchangeResult(tree, 'unused', 'hello', 'claude-sonnet-4-6', 'claude');
	tree = {
		rootId: result.rootId,
		exchanges: updateExchangeResponse(result.exchanges, result.id, 'response')
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
	chatState.chats = [
		{
			id: 'chat-1',
			name: 'Test Chat',
			rootId: defaultData.rootId,
			activeExchangeId: defaultData.activeExchangeId,
			exchanges: defaultData.exchanges
		}
	] as typeof chatState.chats;
	chatState.activeChatIndex = 0;

	docState.folders = [
		{
			id: 'folder-1',
			name: 'Test Folder',
			files: [{ id: 'file-1', name: 'doc.md', content: '# Hello' }]
		}
	] as typeof docState.folders;
});

describe('app/files', () => {
	describe('downloadToFile', () => {
		it('creates a JSON blob and triggers download', () => {
			downloadToFile();

			expect(URL.createObjectURL).toHaveBeenCalled();
			expect(lastCreatedLink.click).toHaveBeenCalled();
			expect(lastCreatedLink.download).toMatch(/^chat-tree-\d+\.json$/);
			expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url');
		});
	});

	describe('downloadChat', () => {
		it('downloads a single chat as JSON', () => {
			downloadChat(0);

			expect(URL.createObjectURL).toHaveBeenCalled();
			expect(lastCreatedLink.click).toHaveBeenCalled();
			expect(lastCreatedLink.download).toBe('Test Chat.json');
		});

		it('strips invalid filename characters', () => {
			chatState.chats[0].name = 'Chat/With:Bad*Chars?';
			downloadChat(0);

			expect(lastCreatedLink.download).toBe('ChatWithBadChars.json');
		});
	});

	describe('uploadChat', () => {
		it('imports a valid chat file', async () => {
			const feedback = createFeedback();
			uploadChat(feedback);

			const fileContent = JSON.stringify(buildValidUploadData());
			const file = new File([fileContent], 'Imported Chat.json', { type: 'application/json' });
			lastCreatedInput.files = [file];

			lastCreatedInput.onchange!();

			// Wait for async file reading
			await vi.waitFor(() => {
				expect(feedback.success).toHaveBeenCalled();
			});

			expect(chatState.chats.length).toBe(2);
			expect(chatState.activeChatIndex).toBe(1);
			expect(chatState.chats[1].name).toBe('Imported Chat');
			expect(chatState.chats[1].id).not.toBe('uploaded-id');
			expect(chatState.chats[1].activeExchangeId).toBeDefined();
		});

		it('deduplicates imported chat names based on the filename', async () => {
			const feedback = createFeedback();
			chatState.chats[0].name = 'Imported Chat';
			uploadChat(feedback);

			const file = new File([JSON.stringify(buildValidUploadData())], 'Imported Chat.json', {
				type: 'application/json'
			});
			lastCreatedInput.files = [file];

			lastCreatedInput.onchange!();

			await vi.waitFor(() => {
				expect(feedback.success).toHaveBeenCalled();
			});

			expect(chatState.chats[1].name).toBe('Imported Chat (1)');
		});

		it('shows error toast for invalid JSON', async () => {
			const feedback = createFeedback();
			uploadChat(feedback);

			const file = new File(['not json'], 'bad.json', { type: 'application/json' });
			lastCreatedInput.files = [file];

			lastCreatedInput.onchange!();

			await vi.waitFor(() => {
				expect(feedback.error).toHaveBeenCalled();
			});
		});

		it('does nothing when no file selected', () => {
			const feedback = createFeedback();
			uploadChat(feedback);

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

	describe('uploadDocToFolder', () => {
		it('does nothing when no file is selected', () => {
			const feedback = createFeedback();
			uploadDocToFolder('folder-1', feedback);

			lastCreatedInput.files = null;
			lastCreatedInput.onchange!();

			expect(feedback.success).not.toHaveBeenCalled();
			expect(feedback.error).not.toHaveBeenCalled();
			expect(docState.folders[0].files).toHaveLength(1);
		});

		it('imports a valid markdown file', async () => {
			const feedback = createFeedback();
			uploadDocToFolder('folder-1', feedback);

			const file = new File(['# Test'], 'doc.md', { type: 'text/markdown' });
			lastCreatedInput.files = [file];

			lastCreatedInput.onchange!();

			// FileReader is async — wait for toast
			await vi.waitFor(() => {
				expect(feedback.success).toHaveBeenCalled();
			});

			expect(docState.folders[0].files).toHaveLength(2);
			expect(docState.folders[0].files?.[1]).toMatchObject({
				name: 'doc (1).md',
				content: '# Test'
			});
		});

		it('shows error toast for invalid markdown', async () => {
			vi.mocked(lib.validateMd.validate).mockReturnValue(['Invalid heading']);
			const feedback = createFeedback();

			uploadDocToFolder('folder-1', feedback);

			const file = new File(['bad markdown'], 'bad.md', { type: 'text/markdown' });
			lastCreatedInput.files = [file];

			lastCreatedInput.onchange!();

			await vi.waitFor(() => {
				expect(feedback.error).toHaveBeenCalledWith(expect.stringContaining('Invalid markdown'));
			});

			expect(docState.folders[0].files).toHaveLength(1);
		});

		it('creates the files array when the target folder has none', async () => {
			const feedback = createFeedback();
			docState.folders = [{ id: 'folder-1', name: 'Test Folder' }] as typeof docState.folders;
			uploadDocToFolder('folder-1', feedback);

			const file = new File(['# Test'], 'doc.md', { type: 'text/markdown' });
			lastCreatedInput.files = [file];

			lastCreatedInput.onchange!();

			await vi.waitFor(() => {
				expect(feedback.success).toHaveBeenCalled();
			});

			expect(docState.folders[0].files).toHaveLength(1);
			expect(docState.folders[0].files?.[0]?.name).toBe('doc.md');
		});

		it('reports an error when uploading into a missing folder', async () => {
			const feedback = createFeedback();
			uploadDocToFolder('missing-folder', feedback);

			const file = new File(['# Test'], 'doc.md', { type: 'text/markdown' });
			lastCreatedInput.files = [file];
			lastCreatedInput.onchange!();

			await vi.waitFor(() => {
				expect(feedback.error).toHaveBeenCalledWith('Folder not found');
			});

			expect(feedback.success).not.toHaveBeenCalled();
		});
	});

	describe('downloadFolder', () => {
		it('creates a zip and triggers download', async () => {
			await downloadFolder('folder-1');

			expect(URL.createObjectURL).toHaveBeenCalled();
			expect(lastCreatedLink.download).toBe('Test Folder.zip');
			expect(lastCreatedLink.click).toHaveBeenCalled();
		});

		it('shows error for empty folder', async () => {
			const feedback = createFeedback();
			docState.folders = [
				{ id: 'empty-folder', name: 'Empty', files: [] }
			] as typeof docState.folders;

			await downloadFolder('empty-folder', feedback);

			expect(feedback.error).toHaveBeenCalledWith('Folder is empty');
		});

		it('shows error for folder with no files property', async () => {
			const feedback = createFeedback();
			docState.folders = [{ id: 'no-files', name: 'NoFiles' }] as typeof docState.folders;

			await downloadFolder('no-files', feedback);

			expect(feedback.error).toHaveBeenCalledWith('Folder is empty');
		});

		it('shows error for nonexistent folder', async () => {
			const feedback = createFeedback();
			await downloadFolder('nonexistent', feedback);

			expect(feedback.error).toHaveBeenCalledWith('Folder is empty');
		});
	});

	describe('uploadFolder', () => {
		it('shows error when no .md files found', () => {
			const feedback = createFeedback();
			uploadFolder(feedback);

			const txtFile = new File(['text'], 'readme.txt');
			Object.defineProperty(txtFile, 'name', { value: 'readme.txt' });
			lastCreatedInput.files = [txtFile] as unknown as File[];

			lastCreatedInput.onchange!();

			expect(feedback.error).toHaveBeenCalledWith('No .md files found in the selected folder');
		});

		it('does nothing when no files selected', () => {
			const feedback = createFeedback();
			uploadFolder(feedback);

			lastCreatedInput.files = null;
			lastCreatedInput.onchange!();

			expect(feedback.error).not.toHaveBeenCalled();
			expect(feedback.success).not.toHaveBeenCalled();
		});

		it('creates a new folder and imports .md files', async () => {
			const feedback = createFeedback();
			uploadFolder(feedback);

			const mdFile = new File(['# Doc'], 'doc.md');
			Object.defineProperty(mdFile, 'webkitRelativePath', { value: 'MyFolder/doc.md' });
			lastCreatedInput.files = [mdFile] as unknown as File[];

			lastCreatedInput.onchange!();

			await vi.waitFor(() => {
				expect(docState.folders.length).toBe(2);
			});

			expect(docState.folders[1]).toMatchObject({
				name: 'MyFolder'
			});
		});

		it('falls back to "Uploaded Folder" when relative path is missing', async () => {
			const feedback = createFeedback();
			uploadFolder(feedback);

			const mdFile = new File(['# Doc'], 'doc.md');
			lastCreatedInput.files = [mdFile] as unknown as File[];

			lastCreatedInput.onchange!();

			await vi.waitFor(() => {
				expect(docState.folders.length).toBe(2);
			});

			expect(docState.folders[1]?.name).toBe('Uploaded Folder');
		});

		it('deduplicates the created folder name when the uploaded directory already exists', async () => {
			const feedback = createFeedback();
			docState.folders = [
				{
					id: 'folder-1',
					name: 'Test Folder',
					files: [{ id: 'doc-1', name: 'doc.md', content: '# Existing' }]
				},
				{ id: 'folder-2', name: 'MyFolder', files: [] }
			] as typeof docState.folders;

			uploadFolder(feedback);

			const mdFile = new File(['# Doc'], 'doc.md');
			Object.defineProperty(mdFile, 'webkitRelativePath', { value: 'MyFolder/doc.md' });
			lastCreatedInput.files = [mdFile] as unknown as File[];

			lastCreatedInput.onchange!();

			await vi.waitFor(() => {
				expect(docState.folders.length).toBe(3);
			});

			expect(docState.folders[2]).toMatchObject({
				name: 'MyFolder (1)'
			});
		});

		it('deduplicates duplicate file names within the uploaded batch for the new folder', async () => {
			const feedback = createFeedback();
			uploadFolder(feedback);

			const first = new File(['# One'], 'doc.md');
			Object.defineProperty(first, 'webkitRelativePath', { value: 'Batch/doc.md' });
			const second = new File(['# Two'], 'doc.md');
			Object.defineProperty(second, 'webkitRelativePath', { value: 'Batch/doc.md' });
			lastCreatedInput.files = [first, second] as unknown as File[];

			lastCreatedInput.onchange!();

			await vi.waitFor(() => {
				expect(feedback.success).toHaveBeenCalledWith('Uploaded 2 files');
			});

			expect(docState.folders[1]?.name).toBe('Batch');
			expect(docState.folders[1]?.files?.map((file) => file.name)).toEqual([
				'doc.md',
				'doc (1).md'
			]);
		});

		it('still shows a success summary for valid files when one file in the batch is invalid', async () => {
			vi.mocked(lib.validateMd.validate).mockImplementation((markdown: string) =>
				markdown.includes('bad') ? ['Invalid heading'] : []
			);
			const feedback = createFeedback();

			uploadFolder(feedback);

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

	describe('uploadFolderToFolder', () => {
		it('shows error when no .md files found', () => {
			const feedback = createFeedback();
			uploadFolderToFolder('folder-1', feedback);

			const txtFile = new File(['text'], 'readme.txt');
			lastCreatedInput.files = [txtFile] as unknown as File[];

			lastCreatedInput.onchange!();

			expect(feedback.error).toHaveBeenCalledWith('No .md files found in the selected folder');
		});

		it('does nothing when no files selected', () => {
			const feedback = createFeedback();
			uploadFolderToFolder('folder-1', feedback);

			lastCreatedInput.files = null;
			lastCreatedInput.onchange!();

			expect(feedback.error).not.toHaveBeenCalled();
		});

		it('imports markdown files into an existing folder and summarizes the count', async () => {
			const feedback = createFeedback();
			uploadFolderToFolder('folder-1', feedback);

			const first = new File(['# One'], 'doc.md');
			const second = new File(['# Two'], 'doc.md');
			lastCreatedInput.files = [first, second] as unknown as File[];

			lastCreatedInput.onchange!();

			await vi.waitFor(() => {
				expect(feedback.success).toHaveBeenCalledWith('Uploaded 2 files');
			});

			expect(docState.folders[0].files).toHaveLength(3);
			expect(docState.folders[0].files?.map((file) => file.name)).toEqual([
				'doc.md',
				'doc (1).md',
				'doc (2).md'
			]);
		});

		it('reports an error when the target folder does not exist', async () => {
			const feedback = createFeedback();
			uploadFolderToFolder('missing-folder', feedback);

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
