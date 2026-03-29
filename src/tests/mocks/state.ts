import { vi } from 'vitest';

import type * as state from '@/state';

import { mergeMock, type DeepPartial, type PublicApiMock } from './helpers';

type StateMock = PublicApiMock<typeof state>;

export function createStateMock(overrides?: DeepPartial<StateMock>): StateMock {
	const base = {
		chats: {
			chatState: {
				chats: [],
				activeChatIndex: 0
			},
			copyToNewChat: vi.fn(),
			deleteChat: vi.fn(),
			getActiveChat: vi.fn(),
			getActiveExchangeId: vi.fn(),
			getActiveExchanges: vi.fn(() => ({})),
			getActiveTree: vi.fn(() => ({ rootId: null, exchanges: {} })),
			getChatById: vi.fn(),
			getExchangesByChatId: vi.fn(),
			getTreeByChatId: vi.fn(),
			hydrate: vi.fn(),
			newChat: vi.fn(),
			renameChat: vi.fn(),
			replaceActiveExchanges: vi.fn(),
			replaceActiveTree: vi.fn(),
			replaceExchangesByChatId: vi.fn(),
			replaceTreeByChatId: vi.fn(),
			selectChat: vi.fn(),
			setActiveExchangeId: vi.fn()
		},
		documents: {
			closeDoc: vi.fn(),
			deleteDocFromFolder: vi.fn(),
			deleteFolder: vi.fn(),
			docState: {
				folders: [],
				openDocs: []
			},
			moveDocToFolder: vi.fn(),
			newDocInFolder: vi.fn(),
			newFolder: vi.fn(),
			renameDocInFolder: vi.fn(),
			renameFolder: vi.fn(),
			selectDoc: vi.fn(),
			updateDocContent: vi.fn()
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
			selectModel: vi.fn(),
			updateContextLength: vi.fn(),
			WEBLLM_CONTEXT_OPTIONS: [
				{ label: '4K', value: 4_096 },
				{ label: '8K', value: 8_192 },
				{ label: '16K', value: 16_384 }
			] as const
		}
	} satisfies StateMock;

	return mergeMock(
		base as unknown as Record<string, unknown>,
		overrides as DeepPartial<Record<string, unknown>>
	) as unknown as StateMock;
}
