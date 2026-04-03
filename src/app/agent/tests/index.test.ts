import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/external', async () => {
	const mocks = await import('@/tests/mocks/external');
	return await mocks.mockExternalModule();
});
vi.mock('@/state', async () => {
	const mocks = await import('@/tests/mocks/state');
	return await mocks.mockStateModule();
});
vi.mock('@/app/documents', async () => {
	const mocks = await import('@/tests/mocks/app');
	return await mocks.mockAppDocumentsModule();
});
vi.mock('@/app/chat', async () => {
	const mocks = await import('@/tests/mocks/app');
	return await mocks.mockAppChatModule();
});
vi.mock('@/app/providers', async () => {
	const mocks = await import('@/tests/mocks/app');
	return await mocks.mockAppProvidersModule();
});
vi.mock('@/app/workspace', async () => {
	const mocks = await import('@/tests/mocks/app');
	return await mocks.mockAppWorkspaceModule();
});

import * as agent from '../index';
import * as documents from '@/app/documents';
import * as chat from '@/app/chat';

describe('app/agent', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('adds the active document into the active chat', () => {
		vi.mocked(documents.getDocument).mockReturnValue({
			folder: { id: 'folder-1', name: 'Docs', files: [] },
			file: { id: 'file-1', name: 'notes.md', content: '# Notes' }
		});
		vi.mocked(chat.getChat).mockReturnValue({
			id: 'chat-1',
			name: 'Chat 1',
			rootId: 'root-1',
			exchanges: {},
			activeExchangeId: 'exchange-1',
			contextStrategy: 'full',
			mode: 'agent'
		});
		vi.mocked(chat.addDocumentToChat).mockReturnValue('exchange-2');

		const result = agent.executeTool(
			'add_document_to_chat',
			{},
			{
				folderId: 'folder-1',
				activeDocumentKey: { folderId: 'folder-1', fileId: 'file-1' }
			}
		);

		expect(chat.addDocumentToChat).toHaveBeenCalledWith(
			{ rootId: 'root-1', exchanges: {} },
			'exchange-1',
			'# Notes',
			'notes.md'
		);
		expect(result.result).toBe('Added document "notes.md" to the chat as exchange exchange-2.');
	});

	it('creates a file through the shared documents action', () => {
		const createFileWithContent = vi
			.spyOn(documents, 'createFileWithContent')
			.mockReturnValue({
				result: {
					folderId: 'folder-1',
					fileId: 'file-2',
					name: 'notes.md',
					path: 'notes.md'
				}
			});

		const result = agent.executeTool(
			'create_file',
			{ filename: 'notes.md', content: '# Notes' },
			{ folderId: 'folder-1' }
		);

		expect(createFileWithContent).toHaveBeenCalledWith('folder-1', 'notes.md', '# Notes', {
			subfolder: undefined
		});
		expect(result.result).toBe('Created "notes.md" in folder folder-1.');
	});

	it('creates a folder through the shared documents action', () => {
		const createNamedFolder = vi.spyOn(documents, 'createNamedFolder').mockReturnValue({
			folderId: 'folder-2',
			name: 'Specs'
		});

		const result = agent.executeTool(
			'create_folder',
			{ name: 'Specs', parent_folder_id: 'folder-1' },
			{ folderId: 'folder-1' }
		);

		expect(createNamedFolder).toHaveBeenCalledWith('Specs', 'folder-1');
		expect(result.result).toBe('Created folder "Specs" (id: folder-2).');
	});
});
