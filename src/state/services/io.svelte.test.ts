import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';
import { addExchangeResult, buildEmptyTree, updateExchangeResponse } from '@/domain/tree';

// Mock external dependencies
vi.mock('svelte-sonner', () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn()
	}
}));

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

vi.mock('@/state/chats.svelte', async () => {
	const { buildEmptyTree, addExchangeResult, updateExchangeResponse, getMainChatTail } =
		await vi.importActual<typeof import('@/domain/tree')>('@/domain/tree');
	const empty = buildEmptyTree();
	const result = addExchangeResult(empty, 'unused', 'hello', 'claude-sonnet-4-6', 'claude');
	const exchanges = updateExchangeResponse(result.exchanges, result.id, 'world');
	const tree = { rootId: result.rootId, exchanges };
	return {
		chatState: {
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
		}
	};
});

vi.mock('@/state/documents.svelte', () => ({
	docState: {
		folders: [
			{
				id: 'folder-1',
				name: 'Test Folder',
				files: [
					{ id: 'file-1', name: 'doc.md', content: '# Hello' }
				]
			}
		]
	}
}));

vi.mock('@/domain/validate-md', () => ({
	validate: vi.fn().mockReturnValue([])
}));

import { toast } from 'svelte-sonner';
import { chatState } from '@/state/chats.svelte';
import { docState } from '@/state/documents.svelte';
import { validate } from '@/domain/validate-md';
import {
	downloadToFile,
	downloadChat,
	uploadChat,
	uploadDocToFolder,
	downloadFolder,
	uploadFolder,
	uploadFolderToFolder
} from './io.svelte';

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

describe('io.svelte', () => {
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
		it('creates a file input and clicks it', () => {
			uploadChat();

			expect(lastCreatedInput.type).toBe('file');
			expect(lastCreatedInput.accept).toBe('.json');
			expect(lastCreatedInput.click).toHaveBeenCalled();
		});

		it('imports a valid chat file', async () => {
			uploadChat();

			const fileContent = JSON.stringify(buildValidUploadData());
			const file = new File([fileContent], 'Imported Chat.json', { type: 'application/json' });
			lastCreatedInput.files = [file];

			lastCreatedInput.onchange!();

			// Wait for async file reading
			await vi.waitFor(() => {
				expect(toast.success).toHaveBeenCalled();
			});

			expect(chatState.chats.length).toBe(2);
			expect(chatState.activeChatIndex).toBe(1);
			expect(chatState.chats[1].name).toBe('Imported Chat');
			expect(chatState.chats[1].id).not.toBe('uploaded-id');
			expect(chatState.chats[1].activeExchangeId).toBeDefined();
		});

		it('deduplicates imported chat names based on the filename', async () => {
			chatState.chats[0].name = 'Imported Chat';
			uploadChat();

			const file = new File([JSON.stringify(buildValidUploadData())], 'Imported Chat.json', {
				type: 'application/json'
			});
			lastCreatedInput.files = [file];

			lastCreatedInput.onchange!();

			await vi.waitFor(() => {
				expect(toast.success).toHaveBeenCalled();
			});

			expect(chatState.chats[1].name).toBe('Imported Chat (1)');
		});

		it('shows error toast for invalid JSON', async () => {
			uploadChat();

			const file = new File(['not json'], 'bad.json', { type: 'application/json' });
			lastCreatedInput.files = [file];

			lastCreatedInput.onchange!();

			await vi.waitFor(() => {
				expect(toast.error).toHaveBeenCalled();
			});
		});

		it('does nothing when no file selected', () => {
			uploadChat();

			lastCreatedInput.files = [] as unknown as File[];
			// Simulate onchange with no files
			Object.defineProperty(lastCreatedInput, 'files', {
				get: () => null
			});

			// Should not throw
			lastCreatedInput.onchange!();

			expect(toast.success).not.toHaveBeenCalled();
			expect(toast.error).not.toHaveBeenCalled();
		});
	});

	describe('uploadDocToFolder', () => {
		it('creates a file input for .md files', () => {
			uploadDocToFolder('folder-1');

			expect(lastCreatedInput.type).toBe('file');
			expect(lastCreatedInput.accept).toBe('.md');
			expect(lastCreatedInput.click).toHaveBeenCalled();
		});

		it('imports a valid markdown file', async () => {
			uploadDocToFolder('folder-1');

			const file = new File(['# Test'], 'doc.md', { type: 'text/markdown' });
			lastCreatedInput.files = [file];

			lastCreatedInput.onchange!();

			// FileReader is async — wait for toast
			await vi.waitFor(() => {
				expect(toast.success).toHaveBeenCalled();
			});

			expect(docState.folders[0].files).toHaveLength(2);
			expect(docState.folders[0].files?.[1]).toMatchObject({
				name: 'doc (1).md',
				content: '# Test'
			});
		});

		it('shows error toast for invalid markdown', async () => {
			vi.mocked(validate).mockReturnValue(['Invalid heading']);

			uploadDocToFolder('folder-1');

			const file = new File(['bad markdown'], 'bad.md', { type: 'text/markdown' });
			lastCreatedInput.files = [file];

			lastCreatedInput.onchange!();

			await vi.waitFor(() => {
				expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Invalid markdown'));
			});

			expect(docState.folders[0].files).toHaveLength(1);
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
			docState.folders = [{ id: 'empty-folder', name: 'Empty', files: [] }] as typeof docState.folders;

			await downloadFolder('empty-folder');

			expect(toast.error).toHaveBeenCalledWith('Folder is empty');
		});

		it('shows error for folder with no files property', async () => {
			docState.folders = [{ id: 'no-files', name: 'NoFiles' }] as typeof docState.folders;

			await downloadFolder('no-files');

			expect(toast.error).toHaveBeenCalledWith('Folder is empty');
		});

		it('shows error for nonexistent folder', async () => {
			await downloadFolder('nonexistent');

			expect(toast.error).toHaveBeenCalledWith('Folder is empty');
		});
	});

	describe('uploadFolder', () => {
		it('creates a directory file input', () => {
			uploadFolder();

			expect(lastCreatedInput.type).toBe('file');
			expect(lastCreatedInput.webkitdirectory).toBe(true);
			expect(lastCreatedInput.click).toHaveBeenCalled();
		});

		it('shows error when no .md files found', () => {
			uploadFolder();

			const txtFile = new File(['text'], 'readme.txt');
			Object.defineProperty(txtFile, 'name', { value: 'readme.txt' });
			lastCreatedInput.files = [txtFile] as unknown as File[];

			lastCreatedInput.onchange!();

			expect(toast.error).toHaveBeenCalledWith('No .md files found in the selected folder');
		});

		it('does nothing when no files selected', () => {
			uploadFolder();

			lastCreatedInput.files = null;
			lastCreatedInput.onchange!();

			expect(toast.error).not.toHaveBeenCalled();
			expect(toast.success).not.toHaveBeenCalled();
		});

		it('creates a new folder and imports .md files', async () => {
			uploadFolder();

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
	});

	describe('uploadFolderToFolder', () => {
		it('creates a directory file input', () => {
			uploadFolderToFolder('folder-1');

			expect(lastCreatedInput.type).toBe('file');
			expect(lastCreatedInput.webkitdirectory).toBe(true);
			expect(lastCreatedInput.click).toHaveBeenCalled();
		});

		it('shows error when no .md files found', () => {
			uploadFolderToFolder('folder-1');

			const txtFile = new File(['text'], 'readme.txt');
			lastCreatedInput.files = [txtFile] as unknown as File[];

			lastCreatedInput.onchange!();

			expect(toast.error).toHaveBeenCalledWith('No .md files found in the selected folder');
		});

		it('does nothing when no files selected', () => {
			uploadFolderToFolder('folder-1');

			lastCreatedInput.files = null;
			lastCreatedInput.onchange!();

			expect(toast.error).not.toHaveBeenCalled();
		});
	});
});
