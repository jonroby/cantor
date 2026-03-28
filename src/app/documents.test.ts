import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./chat-actions', () => ({
	performAddDocToChat: vi.fn()
}));

import {
	clearDocumentLayout,
	performAddFolderDocumentToChat,
	performCloseDocumentPanel,
	performCreateDocument,
	performOpenDocument,
	restoreOpenDocument,
	type DocumentActionDeps
} from './documents';

function createDeps(overrides: Partial<DocumentActionDeps> = {}): DocumentActionDeps {
	return {
		getActiveChat: () => ({
			id: 'chat-1',
			name: 'Chat 1',
			rootId: 'root-1',
			exchanges: {},
			activeExchangeId: 'root-1'
		}),
		getFolders: () => [],
		newDocInFolder: vi.fn(() => null),
		selectDoc: vi.fn(),
		closeDoc: vi.fn(),
		getPersistedLayout: () => ({}),
		setPersistedLayout: vi.fn(),
		saveToStorage: vi.fn(),
		performAddDocToChat: vi.fn(() => 'exchange-1'),
		...overrides
	};
}

describe('document app actions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('opens an existing document and persists layout', () => {
		const selectDoc = vi.fn();
		const setPersistedLayout = vi.fn();
		const saveToStorage = vi.fn();
		const deps = createDeps({
			getFolders: () => [
				{ id: 'folder-1', name: 'Docs', files: [{ id: 'file-1', name: 'a.md', content: '' }] }
			],
			selectDoc,
			setPersistedLayout,
			saveToStorage
		});

		expect(performOpenDocument('folder-1', 'file-1', deps)).toBe(true);
		expect(selectDoc).toHaveBeenCalledWith('folder-1', 'file-1');
		expect(setPersistedLayout).toHaveBeenCalledWith({
			openDocument: { folderId: 'folder-1', fileId: 'file-1' }
		});
		expect(saveToStorage).toHaveBeenCalledOnce();
	});

	it('creates a document, selects it, and persists layout', () => {
		const newDocInFolder = vi.fn(() => 'file-2');
		const selectDoc = vi.fn();
		const setPersistedLayout = vi.fn();
		const saveToStorage = vi.fn();
		const deps = createDeps({
			newDocInFolder,
			selectDoc,
			setPersistedLayout,
			saveToStorage
		});

		expect(performCreateDocument('folder-1', deps)).toEqual({
			folderId: 'folder-1',
			fileId: 'file-2'
		});
		expect(newDocInFolder).toHaveBeenCalledWith('folder-1');
		expect(selectDoc).toHaveBeenCalledWith('folder-1', 'file-2');
		expect(setPersistedLayout).toHaveBeenCalledWith({
			openDocument: { folderId: 'folder-1', fileId: 'file-2' }
		});
		expect(saveToStorage).toHaveBeenCalledOnce();
	});

	it('closes an open document and clears layout', () => {
		const closeDoc = vi.fn();
		const setPersistedLayout = vi.fn();
		const saveToStorage = vi.fn();
		const deps = createDeps({ closeDoc, setPersistedLayout, saveToStorage });

		performCloseDocumentPanel(3, deps);

		expect(closeDoc).toHaveBeenCalledWith(3);
		expect(setPersistedLayout).toHaveBeenCalledWith({});
		expect(saveToStorage).toHaveBeenCalledOnce();
	});

	it('restores a persisted document when it still exists', () => {
		const selectDoc = vi.fn();
		const deps = createDeps({
			getFolders: () => [
				{ id: 'folder-1', name: 'Docs', files: [{ id: 'file-1', name: 'a.md', content: '' }] }
			],
			getPersistedLayout: () => ({ openDocument: { folderId: 'folder-1', fileId: 'file-1' } }),
			selectDoc
		});

		expect(restoreOpenDocument(deps)).toEqual({ folderId: 'folder-1', fileId: 'file-1' });
		expect(selectDoc).toHaveBeenCalledWith('folder-1', 'file-1');
	});

	it('clears stale persisted layout when the document is gone', () => {
		const setPersistedLayout = vi.fn();
		const deps = createDeps({
			getPersistedLayout: () => ({ openDocument: { folderId: 'folder-1', fileId: 'file-1' } }),
			setPersistedLayout
		});

		expect(restoreOpenDocument(deps)).toBeNull();
		expect(setPersistedLayout).toHaveBeenCalledWith({});
	});

	it('adds a folder document to the active chat', () => {
		const performAddDocToChat = vi.fn(() => 'exchange-9');
		const deps = createDeps({
			getFolders: () => [
				{
					id: 'folder-1',
					name: 'Docs',
					files: [{ id: 'file-1', name: 'notes.md', content: '# Notes' }]
				}
			],
			performAddDocToChat
		});

		expect(performAddFolderDocumentToChat('folder-1', 'file-1', deps)).toBe(true);
		expect(performAddDocToChat).toHaveBeenCalledWith(
			{ rootId: 'root-1', exchanges: {} },
			'root-1',
			'# Notes',
			'notes.md'
		);
	});

	it('can clear document layout without touching documents', () => {
		const setPersistedLayout = vi.fn();
		const saveToStorage = vi.fn();
		const deps = createDeps({ setPersistedLayout, saveToStorage });

		clearDocumentLayout(deps);

		expect(setPersistedLayout).toHaveBeenCalledWith({});
		expect(saveToStorage).toHaveBeenCalledOnce();
	});
});
