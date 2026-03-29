import * as documents from './index';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/external', async () => {
	const { createExternalMock } = await import('@/tests/mocks/external');
	return createExternalMock();
});

vi.mock('../chat/index', async () => {
	const actual = await import('../chat/index');
	return {
		...actual,
		addDocumentToChat: vi.fn()
	};
});

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
} from './index';

function createDeps(overrides: Partial<DocumentCommandDeps> = {}): DocumentCommandDeps {
	return {
		getActiveChat: () => ({
			id: 'chat-1',
			name: 'Chat 1',
			rootId: 'root-1',
			exchanges: {},
			activeExchangeId: 'root-1'
		}),
		getFolders: () => [],
		createDocumentInFolder: vi.fn(() => null),
		selectDocument: vi.fn(),
		appendDocumentToChat: vi.fn(() => 'exchange-1'),
		...overrides
	};
}

describe('document app actions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

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
