import { describe, expect, it, beforeEach } from 'vitest';
import {
	docState,
	newFolder,
	newDocInFolder,
	deleteFolder,
	renameFolder,
	selectDoc,
	renameDocInFolder,
	deleteDocFromFolder,
	moveDocToFolder,
	updateDocContent,
	closeDoc,
	type DocFile
} from './documents.svelte';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeFile(name: string, content = 'test'): DocFile {
	return { id: crypto.randomUUID(), name, content };
}

function resetState() {
	docState.folders = [];
	docState.openDocs = [];
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('documents state', () => {
	beforeEach(() => {
		resetState();
	});

	describe('newFolder', () => {
		it('creates a folder with default name', () => {
			newFolder();
			expect(docState.folders.length).toBe(1);
			expect(docState.folders[0].name).toBe('New Folder');
		});

		it('returns the folder id', () => {
			const id = newFolder();
			expect(docState.folders[0].id).toBe(id);
		});

		it('auto-increments name on conflict', () => {
			newFolder();
			newFolder();
			expect(docState.folders[1].name).toBe('New Folder 2');
		});

		it('finds the next available name', () => {
			newFolder();
			newFolder();
			newFolder();
			expect(docState.folders[2].name).toBe('New Folder 3');
		});
	});

	describe('newDocInFolder', () => {
		it('creates a doc with default name', () => {
			const folderId = newFolder();
			newDocInFolder(folderId);
			expect(docState.folders[0].files!.length).toBe(1);
			expect(docState.folders[0].files![0].name).toBe('Untitled.md');
		});

		it('returns the file id', () => {
			const folderId = newFolder();
			const fileId = newDocInFolder(folderId);
			expect(docState.folders[0].files![0].id).toBe(fileId);
		});

		it('creates a doc with empty content', () => {
			const folderId = newFolder();
			newDocInFolder(folderId);
			expect(docState.folders[0].files![0].content).toBe('');
		});

		it('auto-increments name on conflict', () => {
			const folderId = newFolder();
			newDocInFolder(folderId);
			newDocInFolder(folderId);
			expect(docState.folders[0].files![1].name).toBe('Untitled 2.md');
		});

		it('finds the next available name', () => {
			const folderId = newFolder();
			newDocInFolder(folderId);
			newDocInFolder(folderId);
			newDocInFolder(folderId);
			expect(docState.folders[0].files![2].name).toBe('Untitled 3.md');
		});

		it('returns null for nonexistent folder', () => {
			expect(newDocInFolder('nonexistent')).toBeNull();
		});
	});

	describe('deleteFolder', () => {
		it('removes the folder with matching id', () => {
			const id = newFolder();
			deleteFolder(id);
			expect(docState.folders.length).toBe(0);
		});

		it('does nothing for nonexistent id', () => {
			newFolder();
			deleteFolder('nonexistent');
			expect(docState.folders.length).toBe(1);
		});
	});

	describe('renameFolder', () => {
		it('renames the folder', () => {
			const id = newFolder();
			const result = renameFolder(id, 'Renamed');
			expect(result).toBe(true);
			expect(docState.folders[0].name).toBe('Renamed');
		});

		it('returns false on name conflict', () => {
			const id1 = newFolder();
			newFolder();
			renameFolder(id1, 'A');
			const id2 = docState.folders[1].id;
			const result = renameFolder(id2, 'A');
			expect(result).toBe(false);
			expect(docState.folders.map((folder) => folder.name)).toEqual(['A', 'New Folder 2']);
		});

		it('allows renaming to the same name', () => {
			const id = newFolder();
			const result = renameFolder(id, 'New Folder');
			expect(result).toBe(true);
		});
	});

	describe('selectDoc', () => {
		it('opens a doc from a folder file', () => {
			const file = makeFile('test.md', '# Hello');
			docState.folders = [{ id: 'f1', name: 'F', files: [file] }];

			selectDoc('f1', file.id);
			expect(docState.openDocs.length).toBe(1);
			expect(docState.openDocs[0].content).toBe('# Hello');
			expect(docState.openDocs[0].docKey).toEqual({ folderId: 'f1', fileId: file.id });
		});

		it('does not duplicate if already open', () => {
			const file = makeFile('test.md');
			docState.folders = [{ id: 'f1', name: 'F', files: [file] }];

			selectDoc('f1', file.id);
			selectDoc('f1', file.id);
			expect(docState.openDocs.length).toBe(1);
		});

		it('does nothing for nonexistent folder', () => {
			selectDoc('nope', 'nope');
			expect(docState.openDocs.length).toBe(0);
		});

		it('does nothing for nonexistent file', () => {
			docState.folders = [{ id: 'f1', name: 'F', files: [] }];
			selectDoc('f1', 'nope');
			expect(docState.openDocs.length).toBe(0);
		});
	});

	describe('renameDocInFolder', () => {
		it('renames the file', () => {
			const file = makeFile('old.md');
			docState.folders = [{ id: 'f1', name: 'F', files: [file] }];

			const result = renameDocInFolder('f1', file.id, 'new.md');
			expect(result).toBe(true);
			expect(docState.folders[0].files![0].name).toBe('new.md');
		});

		it('returns false on name conflict', () => {
			const f1 = makeFile('a.md');
			const f2 = makeFile('b.md');
			docState.folders = [{ id: 'f1', name: 'F', files: [f1, f2] }];

			const result = renameDocInFolder('f1', f2.id, 'a.md');
			expect(result).toBe(false);
			expect(docState.folders[0].files!.map((file) => file.name)).toEqual(['a.md', 'b.md']);
		});
	});

	describe('deleteDocFromFolder', () => {
		it('removes the file from the folder', () => {
			const file = makeFile('test.md');
			docState.folders = [{ id: 'f1', name: 'F', files: [file] }];

			deleteDocFromFolder('f1', file.id);
			expect(docState.folders[0].files!.length).toBe(0);
		});

		it('also closes the open doc if it was open', () => {
			const file = makeFile('test.md');
			docState.folders = [{ id: 'f1', name: 'F', files: [file] }];
			selectDoc('f1', file.id);
			expect(docState.openDocs.length).toBe(1);

			deleteDocFromFolder('f1', file.id);
			expect(docState.openDocs.length).toBe(0);
		});
	});

	describe('moveDocToFolder', () => {
		it('moves a file between folders', () => {
			const file = makeFile('test.md');
			docState.folders = [
				{ id: 'f1', name: 'A', files: [file] },
				{ id: 'f2', name: 'B', files: [] }
			];

			const result = moveDocToFolder('f1', file.id, 'f2');
			expect(result).toBe(true);
			expect(docState.folders[0].files!.length).toBe(0);
			expect(docState.folders[1].files!.length).toBe(1);
			expect(docState.folders[1].files![0].name).toBe('test.md');
		});

		it('returns false if target folder already has a file with the same name', () => {
			const f1 = makeFile('test.md');
			const f2 = makeFile('test.md');
			docState.folders = [
				{ id: 'f1', name: 'A', files: [f1] },
				{ id: 'f2', name: 'B', files: [f2] }
			];

			const result = moveDocToFolder('f1', f1.id, 'f2');
			expect(result).toBe(false);
			expect(docState.folders[0].files!.map((file) => file.id)).toEqual([f1.id]);
			expect(docState.folders[1].files!.map((file) => file.id)).toEqual([f2.id]);
		});

		it('returns false if source file does not exist', () => {
			docState.folders = [
				{ id: 'f1', name: 'A', files: [] },
				{ id: 'f2', name: 'B', files: [] }
			];
			expect(moveDocToFolder('f1', 'nope', 'f2')).toBe(false);
		});

		it('returns false if target folder does not exist', () => {
			const file = makeFile('test.md');
			docState.folders = [{ id: 'f1', name: 'A', files: [file] }];
			expect(moveDocToFolder('f1', file.id, 'nope')).toBe(false);
		});

		it('updates docKey on open doc after move', () => {
			const file = makeFile('test.md');
			docState.folders = [
				{ id: 'f1', name: 'A', files: [file] },
				{ id: 'f2', name: 'B', files: [] }
			];
			selectDoc('f1', file.id);

			moveDocToFolder('f1', file.id, 'f2');
			expect(docState.openDocs[0].docKey).toEqual({ folderId: 'f2', fileId: file.id });
		});
	});

	describe('updateDocContent', () => {
		it('updates content of the open doc at index', () => {
			docState.openDocs = [{ id: 'd1', content: 'old', docKey: null }];
			updateDocContent(0, 'new');
			expect(docState.openDocs[0].content).toBe('new');
		});

		it('syncs content back to folder file when docKey is set', () => {
			const file = makeFile('test.md', 'original');
			docState.folders = [{ id: 'f1', name: 'F', files: [file] }];
			selectDoc('f1', file.id);

			updateDocContent(0, 'updated');
			expect(docState.folders[0].files![0].content).toBe('updated');
		});

		it('does nothing for out-of-range index', () => {
			docState.openDocs = [{ id: 'd1', content: 'ok', docKey: null }];
			updateDocContent(5, 'nope');
			expect(docState.openDocs[0].content).toBe('ok');
		});
	});

	describe('closeDoc', () => {
		it('removes the open doc at the given index', () => {
			docState.openDocs = [
				{ id: 'd1', content: 'a', docKey: null },
				{ id: 'd2', content: 'b', docKey: null }
			];
			closeDoc(0);
			expect(docState.openDocs.length).toBe(1);
			expect(docState.openDocs[0].id).toBe('d2');
		});
	});
});
