import { vi } from 'vitest';
import type * as app from '@/app';
import type * as state from '@/state';
import appContract from '@/tests/contracts/app.json';

import { mergeMock, mockFn, type DeepPartial, type PublicApiMock } from './helpers';

type AppMock = PublicApiMock<typeof app, typeof appContract>;

export function createAppMock(overrides?: DeepPartial<AppMock>): AppMock {
	const providerStateBacking: ReturnType<typeof app.providers.getState> = {
		activeModel: null,
		activeModelLabel: null,
		contextLength: null,
		providers: [
			{
				id: 'claude',
				name: 'Claude',
				kind: 'remote',
				credentialState: 'missing',
				models: [{ id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', enabled: true }]
			},
			{
				id: 'ollama',
				name: 'Ollama',
				kind: 'local',
				connection: {
					status: 'disconnected',
					value: 'http://localhost:11434',
					label: 'Server URL'
				},
				models: []
			},
			{
				id: 'webllm',
				name: 'WebLLM',
				kind: 'embedded',
				context: {
					value: 4_096,
					options: [
						{ label: '4K', value: 4_096 },
						{ label: '8K', value: 8_192 },
						{ label: '16K', value: 16_384 }
					]
				},
				loadState: { status: 'idle', progress: 0, text: '', error: null },
				models: []
			}
		]
	};

	const appStateBacking = {
		cancelStream: vi.fn(),
		cancelStreamsForChat: vi.fn(),
		chatState: {
			chats: [
				{
					id: 'chat-1',
					name: 'Chat 1',
					rootId: null,
					exchanges: {},
					activeExchangeId: null
				}
			] as state.chats.ChatRecord[],
			activeChatIndex: 0
		},
		deleteChat: vi.fn(),
		deleteDocumentFromFolder: vi.fn(),
		deleteFolder: vi.fn(),
		documentState: {
			folders: [] as state.documents.ChatFolder[],
			openDocuments: [] as state.documents.OpenDocument[]
		},
		getActiveChat: vi.fn(),
		getActiveExchangeId: vi.fn(),
		isStreaming: vi.fn(() => false),
		loadFromStorage: vi.fn(),
		moveDocumentToFolder: vi.fn(),
		newChat: vi.fn(),
		newFolder: vi.fn(),
		providerState: providerStateBacking,
		renameChat: vi.fn(),
		renameDocumentInFolder: vi.fn(),
		renameFolder: vi.fn(),
		saveToStorage: vi.fn(),
		selectChat: vi.fn(),
		selectModel: vi.fn(),
		setActiveExchangeId: vi.fn(),
		updateDocumentContent: vi.fn()
	};

	const base = {
		bootstrap: {
			clearOpenDocument: mockFn<typeof app.bootstrap.clearOpenDocument>(),
			initialize: mockFn<typeof app.bootstrap.initialize>(() => ({
				restoredDocument: null,
				hadDuplicateRenames: false
			})),
			rememberOpenDocument: mockFn<typeof app.bootstrap.rememberOpenDocument>(),
			save: mockFn<typeof app.bootstrap.save>()
		},
		chat: {
			addDocumentToChat: mockFn<typeof app.chat.addDocumentToChat>(),
			canSubmitPrompt: mockFn<typeof app.chat.canSubmitPrompt>(() => false),
			copyChat: mockFn<typeof app.chat.copyChat>(),
			createChat: mockFn<typeof app.chat.createChat>(),
			deleteExchange: mockFn<typeof app.chat.deleteExchange>(),
			exportChat: mockFn<typeof app.chat.exportChat>(),
			exportState: mockFn<typeof app.chat.exportState>(),
			getActiveChatIndex: mockFn<typeof app.chat.getActiveChatIndex>(
				() => appStateBacking.chatState.activeChatIndex
			),
			getActiveExchangeId: mockFn<typeof app.chat.getActiveExchangeId>(() => {
				const activeChat =
					appStateBacking.chatState.chats[appStateBacking.chatState.activeChatIndex];
				return activeChat?.activeExchangeId ?? null;
			}),
			getChat: mockFn<typeof app.chat.getChat>(() => {
				return appStateBacking.chatState.chats[appStateBacking.chatState.activeChatIndex]!;
			}),
			getChats: mockFn<typeof app.chat.getChats>(() => appStateBacking.chatState.chats),
			getMainChat: mockFn<typeof app.chat.getMainChat>(() => []),
			getSideChats: mockFn<typeof app.chat.getSideChats>(() => []),
			getUsedTokens: mockFn<typeof app.chat.getUsedTokens>(() => 0),
			importChat: mockFn<typeof app.chat.importChat>(),
			isStreaming: mockFn<typeof app.chat.isStreaming>(() => false),
			promoteExchange: mockFn<typeof app.chat.promoteExchange>(),
			quickAsk: mockFn<typeof app.chat.quickAsk>(),
			removeChat: mockFn<typeof app.chat.removeChat>(),
			renameChat: mockFn<typeof app.chat.renameChat>(),
			selectChat: mockFn<typeof app.chat.selectChat>(),
			selectExchange: mockFn<typeof app.chat.selectExchange>(),
			stopChatStreams: mockFn<typeof app.chat.stopChatStreams>(),
			stopStream: mockFn<typeof app.chat.stopStream>(),
			submitPrompt: mockFn<typeof app.chat.submitPrompt>()
		},
		documents: {
			addDocumentToChat: mockFn<typeof app.documents.addDocumentToChat>(),
			closeDocument: mockFn<typeof app.documents.closeDocument>(),
			createDocument: mockFn<typeof app.documents.createDocument>(),
			createFolder: mockFn<typeof app.documents.createFolder>(),
			deleteDocument: mockFn<typeof app.documents.deleteDocument>(),
			deleteFolder: mockFn<typeof app.documents.deleteFolder>(),
			exportFolder: mockFn<typeof app.documents.exportFolder>(),
			getDocument: mockFn<typeof app.documents.getDocument>(),
			getState: mockFn<typeof app.documents.getState>(() => appStateBacking.documentState),
			importDocument: mockFn<typeof app.documents.importDocument>(),
			importFolder: mockFn<typeof app.documents.importFolder>(),
			importFolderIntoFolder: mockFn<typeof app.documents.importFolderIntoFolder>(),
			moveDocument: mockFn<typeof app.documents.moveDocument>(),
			openDocument: mockFn<typeof app.documents.openDocument>(),
			renameDocument: mockFn<typeof app.documents.renameDocument>(),
			renameFolder: mockFn<typeof app.documents.renameFolder>(),
			updateDocumentContent: mockFn<typeof app.documents.updateDocumentContent>(),
			validateDocumentMarkdown: mockFn<typeof app.documents.validateDocumentMarkdown>(() => [])
		},
		providers: {
			clearCachedModels: mockFn<typeof app.providers.clearCachedModels>(),
			clearCredential: mockFn<typeof app.providers.clearCredential>(),
			connect: mockFn<typeof app.providers.connect>(),
			getState: mockFn<typeof app.providers.getState>(() => providerStateBacking),
			initialize: mockFn<typeof app.providers.initialize>(),
			removeCachedModel: mockFn<typeof app.providers.removeCachedModel>(),
			saveCredential: mockFn<typeof app.providers.saveCredential>(),
			selectModel: mockFn<typeof app.providers.selectModel>(),
			setContextSize: mockFn<typeof app.providers.setContextSize>(),
			streamText: mockFn<typeof app.providers.streamText>(),
			unlockCredentials: mockFn<typeof app.providers.unlockCredentials>()
		}
	} satisfies AppMock;

	return mergeMock<AppMock>(base, overrides);
}
