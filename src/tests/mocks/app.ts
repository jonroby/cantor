import { vi } from 'vitest';

import type * as app from '@/app';
import type * as domain from '@/domain';
import type * as state from '@/state';

import { mergeMock, type DeepPartial, type PublicApiMock } from './helpers';

type AppMock = PublicApiMock<typeof app>;

export function createAppMock(overrides?: DeepPartial<AppMock>): AppMock {
	const providerStateBacking = {
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
	};

	const appStateBacking = {
		cancelStream: vi.fn(),
		cancelStreamsForChat: vi.fn(),
		chatState: { chats: [] as domain.tree.Chat[], activeChatIndex: 0 },
		deleteChat: vi.fn(),
		deleteDocFromFolder: vi.fn(),
		deleteFolder: vi.fn(),
		docState: {
			folders: [] as state.documents.ChatFolder[],
			openDocs: [] as state.documents.OpenDoc[]
		},
		getActiveChat: vi.fn(),
		getActiveExchangeId: vi.fn(),
		getActiveExchanges: vi.fn(() => ({})),
		getProviderStream: vi.fn(),
		isStreaming: vi.fn(() => false),
		loadFromStorage: vi.fn(),
		moveDocToFolder: vi.fn(),
		newChat: vi.fn(),
		newFolder: vi.fn(),
		providerState: providerStateBacking,
		renameChat: vi.fn(),
		renameDocInFolder: vi.fn(),
		renameFolder: vi.fn(),
		saveToStorage: vi.fn(),
		selectChat: vi.fn(),
		selectModel: vi.fn(),
		setActiveExchangeId: vi.fn(),
		updateContextLength: vi.fn(),
		updateDocContent: vi.fn()
	};

	const base = {
		bootstrap: {
			initialize: vi.fn(() => ({ restoredDocument: null, hadDuplicateRenames: false })),
			save: vi.fn()
		},
		chat: {
			addDocToChat: vi.fn(),
			canAcceptNewChat: vi.fn(() => false),
			cancelStream: vi.fn(),
			cancelStreamsForChat: vi.fn(),
			copyChat: vi.fn(),
			deleteExchange: vi.fn(),
			deleteChat: vi.fn(),
			getActiveChat: vi.fn(
				() => appStateBacking.chatState.chats[appStateBacking.chatState.activeChatIndex]
			),
			getActiveChatIndex: vi.fn(() => 0),
			getActiveExchangeId: vi.fn(
				() =>
					appStateBacking.chatState.chats[appStateBacking.chatState.activeChatIndex]
						?.activeExchangeId
			),
			getActiveExchanges: vi.fn(
				() =>
					appStateBacking.chatState.chats[appStateBacking.chatState.activeChatIndex]?.exchanges ??
					{}
			),
			getChildExchanges: vi.fn(() => []),
			getChats: vi.fn(() => appStateBacking.chatState.chats),
			getDeleteMode: vi.fn(),
			getExchangeNodeData: vi.fn(),
			getMainChatHistory: vi.fn(() => []),
			getPathTokenTotal: vi.fn(() => 0),
			getRootExchange: vi.fn(),
			isStreaming: vi.fn(() => false),
			newChat: vi.fn(),
			performAddDocToChat: vi.fn(),
			performCopy: vi.fn(),
			performDelete: vi.fn(),
			performPromote: vi.fn(),
			performQuickAsk: vi.fn(),
			performSubmitPrompt: vi.fn(),
			promoteExchange: vi.fn(),
			quickAsk: vi.fn(),
			renameChat: vi.fn(),
			selectChat: vi.fn(),
			setActiveExchangeId: vi.fn(),
			submitPrompt: vi.fn()
		},
		content: {
			diffLines: vi.fn(() => []),
			mapDocument: vi.fn(() => []),
			marked: {
				lexer: vi.fn(() => []),
				parser: vi.fn(() => ''),
				parse: vi.fn((text: string) => text)
			} as unknown as AppMock['content']['marked'],
			renameWithDedup: vi.fn(),
			validate: vi.fn(() => [])
		},
		documents: {
			addFolderDocumentToChat: vi.fn(),
			clearDocumentLayout: vi.fn(),
			closeDocumentPanel: vi.fn(),
			createDocument: vi.fn(),
			deleteDocFromFolder: vi.fn(),
			deleteFolder: vi.fn(),
			getFolderFile: vi.fn(),
			getFolders: vi.fn(() => appStateBacking.docState.folders),
			getOpenDocs: vi.fn(() => appStateBacking.docState.openDocs),
			moveDocToFolder: vi.fn(),
			newFolder: vi.fn(),
			openDocument: vi.fn(),
			performAddFolderDocumentToChat: vi.fn(),
			performCloseDocumentPanel: vi.fn(),
			performCreateDocument: vi.fn(),
			performOpenDocument: vi.fn(),
			renameDocInFolder: vi.fn(),
			renameFolder: vi.fn(),
			restoreOpenDocument: vi.fn(),
			updateDocContent: vi.fn()
		},
		files: {
			downloadChat: vi.fn(),
			downloadFolder: vi.fn(),
			downloadToFile: vi.fn(),
			uploadChat: vi.fn(),
			uploadDocToFolder: vi.fn(),
			uploadFolder: vi.fn(),
			uploadFolderToFolder: vi.fn()
		},
		providers: {
			autoConnectOllama: vi.fn(),
			connectOllama: vi.fn(),
			deleteAllWebLLMCaches: vi.fn(),
			deleteWebLLMCache: vi.fn(),
			fetchOllamaContextLength: vi.fn(),
			forgetKey: vi.fn(),
			init: vi.fn(),
			initProviders: vi.fn(),
			KEY_BASED_PROVIDERS: [
				'claude',
				'openai',
				'gemini',
				'moonshot',
				'qwen',
				'deepseek',
				'mistral',
				'groq'
			] as const,
			loadWebLLMModel_: vi.fn(),
			PROVIDER_CONFIG: {} as AppMock['providers']['PROVIDER_CONFIG'],
			PROVIDER_LOGOS: {} as AppMock['providers']['PROVIDER_LOGOS'],
			PROVIDER_MODELS: {} as AppMock['providers']['PROVIDER_MODELS'],
			getState: vi.fn(() => providerStateBacking),
			getProviderStream: vi.fn(),
			saveKey: vi.fn(),
			selectModel: vi.fn(),
			setWebLLMContextSize: vi.fn(),
			unlockKeys: vi.fn(),
			updateContextLength: vi.fn(),
			WEBLLM_CONTEXT_OPTIONS: [
				{ label: '4K', value: 4_096 },
				{ label: '8K', value: 8_192 },
				{ label: '16K', value: 16_384 }
			] as const
		},
		search: {
			getDefaultItems: vi.fn(() => []),
			searchChats: vi.fn(() => [])
		},
		types: {}
	} satisfies AppMock;

	return mergeMock(
		base as unknown as Record<string, unknown>,
		overrides as DeepPartial<Record<string, unknown>>
	) as unknown as AppMock;
}
