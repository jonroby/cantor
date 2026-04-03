import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/external', async () => {
	const mocks = await import('@/tests/mocks/external');
	return await mocks.mockExternalModule();
});
vi.mock('@/state', async () => {
	const mocks = await import('@/tests/mocks/state');
	return await mocks.mockStateModule();
});
vi.mock('../../providers/index', async () => {
	const { vi } = await import('vitest');
	return { initialize: vi.fn() };
});

import * as external from '@/external';
import * as state from '@/state';
import * as providers from '../../providers/index';
import { initialize } from '../index';

describe('app/bootstrap', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		state.documents.documentState.folders = [];
		state.documents.documentState.openDocuments = [];
		vi.mocked(external.persistence.getPersistedLayout).mockReturnValue({});
		vi.mocked(external.persistence.loadFromStorage).mockResolvedValue(null);
	});

	it('restores the last open document when it still exists', async () => {
		state.documents.documentState.folders = [
			{
				id: 'folder-1',
				name: 'Docs',
				files: [{ id: 'file-1', name: 'notes.md', content: '# Notes' }]
			}
		];
		vi.mocked(external.persistence.getPersistedLayout).mockReturnValue({
			openDocument: { folderId: 'folder-1', fileId: 'file-1' }
		});

		const result = await initialize();
		expect(result.restoredDocument).toBeNull();
		expect(result.hadDuplicateRenames).toBe(false);
		expect(state.workspace.hydrate).toHaveBeenCalledWith({
			panels: undefined,
			expandedFolders: undefined,
			sidebarOpen: undefined
		});
		expect(state.documents.selectDocument).toHaveBeenCalledWith('folder-1', 'file-1');
		expect(providers.initialize).toHaveBeenCalledOnce();
	});

	it('clears stale last-open-document persistence when the document no longer exists', async () => {
		vi.mocked(external.persistence.getPersistedLayout).mockReturnValue({
			openDocument: { folderId: 'folder-1', fileId: 'file-1' }
		});

		expect((await initialize()).restoredDocument).toBeNull();
		expect(external.persistence.setPersistedLayout).toHaveBeenCalledWith({
			openDocument: undefined
		});
	});

});
