import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/external', async () => {
	const { createExternalMock } = await import('@/tests/mocks/external');
	return createExternalMock({
		persistence: {
			getPersistedLayout: vi.fn(() => ({})),
			loadFromStorage: vi.fn(),
			saveToStorage: vi.fn(),
			setPersistedLayout: vi.fn()
		}
	});
});

vi.mock('@/state', async () => {
	const { createStateMock } = await import('@/tests/mocks/state');
	return createStateMock({
		documents: {
			docState: {
				folders: [],
				openDocs: []
			},
			selectDoc: vi.fn()
		}
	});
});

vi.mock('../providers/index', async () => ({
	initialize: vi.fn()
}));

import * as external from '@/external';
import * as state from '@/state';
import * as providers from '../providers/index';
import { clearOpenDocument, initialize, rememberOpenDocument } from './index';

describe('app/bootstrap', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		state.documents.docState.folders = [];
	});

	it('restores the last open document when it still exists', () => {
		state.documents.docState.folders = [
			{
				id: 'folder-1',
				name: 'Docs',
				files: [{ id: 'file-1', name: 'notes.md', content: '# Notes' }]
			}
		];
		vi.mocked(external.persistence.getPersistedLayout).mockReturnValue({
			openDocument: { folderId: 'folder-1', fileId: 'file-1' }
		});

		expect(initialize()).toEqual({
			restoredDocument: { folderId: 'folder-1', fileId: 'file-1' },
			hadDuplicateRenames: false
		});
		expect(state.documents.selectDoc).toHaveBeenCalledWith('folder-1', 'file-1');
		expect(providers.initialize).toHaveBeenCalledOnce();
	});

	it('clears stale last-open-document persistence when the document no longer exists', () => {
		vi.mocked(external.persistence.getPersistedLayout).mockReturnValue({
			openDocument: { folderId: 'folder-1', fileId: 'file-1' }
		});

		expect(initialize().restoredDocument).toBeNull();
		expect(external.persistence.setPersistedLayout).toHaveBeenCalledWith({});
	});

	it('remembers the last open document', () => {
		rememberOpenDocument('folder-1', 'file-1');

		expect(external.persistence.setPersistedLayout).toHaveBeenCalledWith({
			openDocument: { folderId: 'folder-1', fileId: 'file-1' }
		});
		expect(external.persistence.saveToStorage).toHaveBeenCalledOnce();
	});

	it('clears the last open document', () => {
		clearOpenDocument();

		expect(external.persistence.setPersistedLayout).toHaveBeenCalledWith({});
		expect(external.persistence.saveToStorage).toHaveBeenCalledOnce();
	});
});
