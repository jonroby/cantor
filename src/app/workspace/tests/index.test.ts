import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/external', async () => {
	const mocks = await import('@tests/mocks/external');
	return await mocks.mockExternalModule();
});
vi.mock('@/state', async () => {
	const mocks = await import('@tests/mocks/state');
	return await mocks.mockStateModule();
});

import * as external from '@/external';
import { clearOpenDocument, rememberOpenDocument } from '../index';

describe('app/workspace', () => {
	beforeEach(() => {
		vi.clearAllMocks();
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

		expect(external.persistence.setPersistedLayout).toHaveBeenCalledWith({
			openDocument: undefined
		});
		expect(external.persistence.saveToStorage).toHaveBeenCalledOnce();
	});
});
