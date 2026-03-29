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
			setActiveExchangeId: mockFn<typeof state.chats.setActiveExchangeId>()
		},
		documents: {
			closeDoc: mockFn<typeof state.documents.closeDoc>(),
			deleteDocFromFolder: mockFn<typeof state.documents.deleteDocFromFolder>(),
			deleteFolder: mockFn<typeof state.documents.deleteFolder>(),
			docState: {
				folders: [],
				openDocs: []
			},
			moveDocToFolder: mockFn<typeof state.documents.moveDocToFolder>(),
			newDocInFolder: mockFn<typeof state.documents.newDocInFolder>(),
			newFolder: mockFn<typeof state.documents.newFolder>(),
			renameDocInFolder: mockFn<typeof state.documents.renameDocInFolder>(),
			renameFolder: mockFn<typeof state.documents.renameFolder>(),
			selectDoc: mockFn<typeof state.documents.selectDoc>(),
			updateDocContent: mockFn<typeof state.documents.updateDocContent>()
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
