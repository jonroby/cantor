import { describe, expect, it, beforeEach } from 'vitest';
import {
	documentState,
	newFolder,
	createDocumentInFolder,
	deleteFolder,
	renameFolder,
	selectDocument,
	renameDocumentInFolder,
	deleteDocumentFromFolder,
	moveDocumentToFolder,
	updateDocumentContent,
	closeDocument,
	type DocumentFile
} from '../documents.svelte';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeFile(name: string, content = 'test'): DocumentFile {
	return { id: crypto.randomUUID(), name, content };
}

function resetState() {
	documentState.folders = [];
	documentState.openDocuments = [];
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('documents state', () => {
	beforeEach(() => {
		resetState();
	});

	describe('newFolder', () => {
		it('creates a folder with default name', () => {
			newFolder();
			expect(documentState.folders.length).toBe(1);
			expect(documentState.folders[0].name).toBe('New Folder');
		});

		it('returns the folder id', () => {
			const id = newFolder();
			expect(documentState.folders[0].id).toBe(id);
		});

		it('auto-increments name on conflict', () => {
			newFolder();
			newFolder();
			expect(documentState.folders[1].name).toBe('New Folder 2');
		});

		it('finds the next available name', () => {
			newFolder();
			newFolder();
			newFolder();
			expect(documentState.folders[2].name).toBe('New Folder 3');
		});
	});

	describe('createDocumentInFolder', () => {
		it('creates a doc with default name', () => {
			const folderId = newFolder();
			createDocumentInFolder(folderId);
			expect(documentState.folders[0].files!.length).toBe(1);
			expect(documentState.folders[0].files![0].name).toBe('Untitled.md');
		});

		it('returns the file id', () => {
			const folderId = newFolder();
			const fileId = createDocumentInFolder(folderId);
			expect(documentState.folders[0].files![0].id).toBe(fileId);
		});

		it('creates a doc with empty content', () => {
			const folderId = newFolder();
			createDocumentInFolder(folderId);
			expect(documentState.folders[0].files![0].content).toBe('');
		});

		it('auto-increments name on conflict', () => {
			const folderId = newFolder();
			createDocumentInFolder(folderId);
			createDocumentInFolder(folderId);
			expect(documentState.folders[0].files![1].name).toBe('Untitled 2.md');
		});

		it('finds the next available name', () => {
			const folderId = newFolder();
			createDocumentInFolder(folderId);
			createDocumentInFolder(folderId);
			createDocumentInFolder(folderId);
			expect(documentState.folders[0].files![2].name).toBe('Untitled 3.md');
		});

		it('returns null for nonexistent folder', () => {
			expect(createDocumentInFolder('nonexistent')).toBeNull();
		});
	});

	describe('deleteFolder', () => {
		it('removes the folder with matching id', () => {
			const id = newFolder();
			deleteFolder(id);
			expect(documentState.folders.length).toBe(0);
		});

		it('does nothing for nonexistent id', () => {
			newFolder();
			deleteFolder('nonexistent');
			expect(documentState.folders.length).toBe(1);
		});
	});

	describe('renameFolder', () => {
		it('renames the folder', () => {
			const id = newFolder();
			const result = renameFolder(id, 'Renamed');
			expect(result).toBe(true);
			expect(documentState.folders[0].name).toBe('Renamed');
		});

		it('returns false on name conflict', () => {
			const id1 = newFolder();
			newFolder();
			renameFolder(id1, 'A');
			const id2 = documentState.folders[1].id;
			const result = renameFolder(id2, 'A');
			expect(result).toBe(false);
			expect(documentState.folders.map((folder) => folder.name)).toEqual(['A', 'New Folder 2']);
		});

		it('allows renaming to the same name', () => {
			const id = newFolder();
			const result = renameFolder(id, 'New Folder');
			expect(result).toBe(true);
		});
	});

	describe('selectDocument', () => {
		it('opens a doc from a folder file', () => {
			const file = makeFile('test.md', '# Hello');
			documentState.folders = [{ id: 'f1', name: 'F', files: [file] }];

			selectDocument('f1', file.id);
			expect(documentState.openDocuments.length).toBe(1);
			expect(documentState.openDocuments[0].content).toBe('# Hello');
			expect(documentState.openDocuments[0].documentKey).toEqual({
				folderId: 'f1',
				fileId: file.id
			});
		});

		it('does not duplicate if already open', () => {
			const file = makeFile('test.md');
			documentState.folders = [{ id: 'f1', name: 'F', files: [file] }];

			selectDocument('f1', file.id);
			selectDocument('f1', file.id);
			expect(documentState.openDocuments.length).toBe(1);
		});

		it('does nothing for nonexistent folder', () => {
			selectDocument('nope', 'nope');
			expect(documentState.openDocuments.length).toBe(0);
		});

		it('does nothing for nonexistent file', () => {
			documentState.folders = [{ id: 'f1', name: 'F', files: [] }];
			selectDocument('f1', 'nope');
			expect(documentState.openDocuments.length).toBe(0);
		});
	});

	describe('renameDocumentInFolder', () => {
		it('renames the file', () => {
			const file = makeFile('old.md');
			documentState.folders = [{ id: 'f1', name: 'F', files: [file] }];

			const result = renameDocumentInFolder('f1', file.id, 'new.md');
			expect(result).toBe(true);
			expect(documentState.folders[0].files![0].name).toBe('new.md');
		});

		it('returns false on name conflict', () => {
			const f1 = makeFile('a.md');
			const f2 = makeFile('b.md');
			documentState.folders = [{ id: 'f1', name: 'F', files: [f1, f2] }];

			const result = renameDocumentInFolder('f1', f2.id, 'a.md');
			expect(result).toBe(false);
			expect(documentState.folders[0].files!.map((file) => file.name)).toEqual(['a.md', 'b.md']);
		});
	});

	describe('deleteDocumentFromFolder', () => {
		it('removes the file from the folder', () => {
			const file = makeFile('test.md');
			documentState.folders = [{ id: 'f1', name: 'F', files: [file] }];

			deleteDocumentFromFolder('f1', file.id);
			expect(documentState.folders[0].files!.length).toBe(0);
		});

		it('also closes the open doc if it was open', () => {
			const file = makeFile('test.md');
			documentState.folders = [{ id: 'f1', name: 'F', files: [file] }];
			selectDocument('f1', file.id);
			expect(documentState.openDocuments.length).toBe(1);

			deleteDocumentFromFolder('f1', file.id);
			expect(documentState.openDocuments.length).toBe(0);
		});
	});

	describe('moveDocumentToFolder', () => {
		it('moves a file between folders', () => {
			const file = makeFile('test.md');
			documentState.folders = [
				{ id: 'f1', name: 'A', files: [file] },
				{ id: 'f2', name: 'B', files: [] }
			];

			const result = moveDocumentToFolder('f1', file.id, 'f2');
			expect(result).toBe(true);
			expect(documentState.folders[0].files!.length).toBe(0);
			expect(documentState.folders[1].files!.length).toBe(1);
			expect(documentState.folders[1].files![0].name).toBe('test.md');
		});

		it('returns false if target folder already has a file with the same name', () => {
			const f1 = makeFile('test.md');
			const f2 = makeFile('test.md');
			documentState.folders = [
				{ id: 'f1', name: 'A', files: [f1] },
				{ id: 'f2', name: 'B', files: [f2] }
			];

			const result = moveDocumentToFolder('f1', f1.id, 'f2');
			expect(result).toBe(false);
			expect(documentState.folders[0].files!.map((file) => file.id)).toEqual([f1.id]);
			expect(documentState.folders[1].files!.map((file) => file.id)).toEqual([f2.id]);
		});

		it('returns false if source file does not exist', () => {
			documentState.folders = [
				{ id: 'f1', name: 'A', files: [] },
				{ id: 'f2', name: 'B', files: [] }
			];
			expect(moveDocumentToFolder('f1', 'nope', 'f2')).toBe(false);
		});

		it('returns false if target folder does not exist', () => {
			const file = makeFile('test.md');
			documentState.folders = [{ id: 'f1', name: 'A', files: [file] }];
			expect(moveDocumentToFolder('f1', file.id, 'nope')).toBe(false);
		});

		it('updates documentKey on open doc after move', () => {
			const file = makeFile('test.md');
			documentState.folders = [
				{ id: 'f1', name: 'A', files: [file] },
				{ id: 'f2', name: 'B', files: [] }
			];
			selectDocument('f1', file.id);

			moveDocumentToFolder('f1', file.id, 'f2');
			expect(documentState.openDocuments[0].documentKey).toEqual({
				folderId: 'f2',
				fileId: file.id
			});
		});
	});

	describe('updateDocumentContent', () => {
		it('updates content of the open doc at index', () => {
			documentState.openDocuments = [{ id: 'd1', content: 'old', documentKey: null }];
			updateDocumentContent(0, 'new');
			expect(documentState.openDocuments[0].content).toBe('new');
		});

		it('syncs content back to folder file when documentKey is set', () => {
			const file = makeFile('test.md', 'original');
			documentState.folders = [{ id: 'f1', name: 'F', files: [file] }];
			selectDocument('f1', file.id);

			updateDocumentContent(0, 'updated');
			expect(documentState.folders[0].files![0].content).toBe('updated');
		});

		it('does nothing for out-of-range index', () => {
			documentState.openDocuments = [{ id: 'd1', content: 'ok', documentKey: null }];
			updateDocumentContent(5, 'nope');
			expect(documentState.openDocuments[0].content).toBe('ok');
		});
	});

	describe('closeDocument', () => {
		it('removes the open doc at the given index', () => {
			documentState.openDocuments = [
				{ id: 'd1', content: 'a', documentKey: null },
				{ id: 'd2', content: 'b', documentKey: null }
			];
			closeDocument(0);
			expect(documentState.openDocuments.length).toBe(1);
			expect(documentState.openDocuments[0].id).toBe('d2');
		});
	});
});
