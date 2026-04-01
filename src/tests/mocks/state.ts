import type * as state from '@/state';
import stateContract from '@/tests/contracts/state.json';

import { mergeMock, mockFn, type DeepPartial, type PublicApiMock } from './helpers';

type StateMock = PublicApiMock<typeof state, typeof stateContract>;

export function createStateMock(overrides?: DeepPartial<StateMock>): StateMock {
	const base = {
		chats: {
			addChat: mockFn<typeof state.chats.addChat>(),
			chatState: {
				chats: [],
				activeChatIndex: 0
			},
			deleteChat: mockFn<typeof state.chats.deleteChat>(),
			getActiveChat: mockFn<typeof state.chats.getActiveChat>(),
			getActiveExchangeId: mockFn<typeof state.chats.getActiveExchangeId>(),
			getActiveTree: mockFn<typeof state.chats.getActiveTree>(() => ({
				rootId: null,
				exchanges: {}
			})),
			getChatById: mockFn<typeof state.chats.getChatById>(),
			getTreeByChatId: mockFn<typeof state.chats.getTreeByChatId>(),
			hydrate: mockFn<typeof state.chats.hydrate>(),
			newChat: mockFn<typeof state.chats.newChat>(),
			renameChat: mockFn<typeof state.chats.renameChat>(),
			replaceActiveTree: mockFn<typeof state.chats.replaceActiveTree>(),
			replaceTreeByChatId: mockFn<typeof state.chats.replaceTreeByChatId>(),
			selectChat: mockFn<typeof state.chats.selectChat>(),
			setActiveExchangeId: mockFn<typeof state.chats.setActiveExchangeId>(),
			setContextStrategy: mockFn<typeof state.chats.setContextStrategy>()
		},
		documents: {
			closeDocument: mockFn<typeof state.documents.closeDocument>(),
			deleteDocumentFromFolder: mockFn<typeof state.documents.deleteDocumentFromFolder>(),
			deleteFolder: mockFn<typeof state.documents.deleteFolder>(),
			documentState: {
				folders: [],
				openDocuments: []
			},
			moveDocumentToFolder: mockFn<typeof state.documents.moveDocumentToFolder>(),
			createDocumentInFolder: mockFn<typeof state.documents.createDocumentInFolder>(),
			newFolder: mockFn<typeof state.documents.newFolder>(),
			renameDocumentInFolder: mockFn<typeof state.documents.renameDocumentInFolder>(),
			renameFolder: mockFn<typeof state.documents.renameFolder>(),
			selectDocument: mockFn<typeof state.documents.selectDocument>(),
			updateDocumentContent: mockFn<typeof state.documents.updateDocumentContent>()
		},
		providers: {
			providerState: {
				activeModel: null,
				contextLength: null,
				ollamaUrl: 'http://localhost:11434',
				ollamaStatus: 'disconnected',
				ollamaModels: [],
				apiKeys: {},
				vaultProviders: [],
				operationError: null,
				webllmStatus: 'idle',
				webllmProgress: 0,
				webllmProgressText: '',
				webllmModels: [],
				webllmError: null,
				webllmContextSize: 4_096
			},
			selectModel: mockFn<typeof state.providers.selectModel>()
		}
	} satisfies StateMock;

	return mergeMock<StateMock>(base, overrides);
}
