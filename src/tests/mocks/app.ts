import { vi } from 'vitest';
import type * as app from '@/app';
import type * as domain from '@/domain';
import type * as state from '@/state';
import appContract from '@/tests/contracts/app.json';
import { marked } from '@/app/content';

import { mergeMock, mockFn, type DeepPartial, type PublicApiMock } from './helpers';

type AppMock = PublicApiMock<typeof app, typeof appContract>;

export function createAppMock(overrides?: DeepPartial<AppMock>): AppMock {
	const providerStateBacking: ReturnType<typeof app.providers.getState> = {
		activeModel: null,
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
		updateDocContent: vi.fn()
	};

	const base = {
		bootstrap: {
			initialize: mockFn<typeof app.bootstrap.initialize>(() => ({
				restoredDocument: null,
				hadDuplicateRenames: false
			})),
			save: mockFn<typeof app.bootstrap.save>()
		},
		chat: {
			addDocToChat: mockFn<typeof app.chat.addDocToChat>(),
			canAcceptNewChat: mockFn<typeof app.chat.canAcceptNewChat>(() => false),
			cancelStream: mockFn<typeof app.chat.cancelStream>(),
			cancelStreamsForChat: mockFn<typeof app.chat.cancelStreamsForChat>(),
			copyChat: mockFn<typeof app.chat.copyChat>(),
			deleteExchange: mockFn<typeof app.chat.deleteExchange>(),
			deleteChat: mockFn<typeof app.chat.deleteChat>(),
			getActiveChat: mockFn<typeof app.chat.getActiveChat>(
				() => appStateBacking.chatState.chats[appStateBacking.chatState.activeChatIndex]
			),
			getActiveChatIndex: mockFn<typeof app.chat.getActiveChatIndex>(() => 0),
			getActiveExchangeId: mockFn<typeof app.chat.getActiveExchangeId>(
				() =>
					appStateBacking.chatState.chats[appStateBacking.chatState.activeChatIndex]
						?.activeExchangeId
			),
			getActiveExchanges: mockFn<typeof app.chat.getActiveExchanges>(
				() =>
					appStateBacking.chatState.chats[appStateBacking.chatState.activeChatIndex]?.exchanges ??
					{}
			),
			getChildExchanges: mockFn<typeof app.chat.getChildExchanges>(() => []),
			getChats: mockFn<typeof app.chat.getChats>(() => appStateBacking.chatState.chats),
			getDeleteMode: mockFn<typeof app.chat.getDeleteMode>(),
			getExchangeNodeData: mockFn<typeof app.chat.getExchangeNodeData>(),
			getMainChatHistory: mockFn<typeof app.chat.getMainChatHistory>(() => []),
			getPathTokenTotal: mockFn<typeof app.chat.getPathTokenTotal>(() => 0),
			getRootExchange: mockFn<typeof app.chat.getRootExchange>(),
			isStreaming: mockFn<typeof app.chat.isStreaming>(() => false),
			newChat: mockFn<typeof app.chat.newChat>(),
			promoteExchange: mockFn<typeof app.chat.promoteExchange>(),
			quickAsk: mockFn<typeof app.chat.quickAsk>(),
			renameChat: mockFn<typeof app.chat.renameChat>(),
			selectChat: mockFn<typeof app.chat.selectChat>(),
			setActiveExchangeId: mockFn<typeof app.chat.setActiveExchangeId>(),
			submitPrompt: mockFn<typeof app.chat.submitPrompt>()
		},
		content: {
			diffLines: mockFn<typeof app.content.diffLines>(() => []),
			mapDocument: mockFn<typeof app.content.mapDocument>(() => []),
			marked,
			renameWithDedup: mockFn<typeof app.content.renameWithDedup>(),
			validate: mockFn<typeof app.content.validate>(() => [])
		},
		documents: {
			addFolderDocumentToChat: mockFn<typeof app.documents.addFolderDocumentToChat>(),
			clearDocumentLayout: mockFn<typeof app.documents.clearDocumentLayout>(),
			closeDocumentPanel: mockFn<typeof app.documents.closeDocumentPanel>(),
			createDocument: mockFn<typeof app.documents.createDocument>(),
			deleteDocFromFolder: mockFn<typeof app.documents.deleteDocFromFolder>(),
			deleteFolder: mockFn<typeof app.documents.deleteFolder>(),
			getFolderFile: mockFn<typeof app.documents.getFolderFile>(),
			getFolders: mockFn<typeof app.documents.getFolders>(() => appStateBacking.docState.folders),
			getOpenDocs: mockFn<typeof app.documents.getOpenDocs>(
				() => appStateBacking.docState.openDocs
			),
			moveDocToFolder: mockFn<typeof app.documents.moveDocToFolder>(),
			newFolder: mockFn<typeof app.documents.newFolder>(),
			openDocument: mockFn<typeof app.documents.openDocument>(),
			renameDocInFolder: mockFn<typeof app.documents.renameDocInFolder>(),
			renameFolder: mockFn<typeof app.documents.renameFolder>(),
			restoreOpenDocument: mockFn<typeof app.documents.restoreOpenDocument>(),
			updateDocContent: mockFn<typeof app.documents.updateDocContent>()
		},
		files: {
			downloadChat: mockFn<typeof app.files.downloadChat>(),
			downloadFolder: mockFn<typeof app.files.downloadFolder>(),
			downloadToFile: mockFn<typeof app.files.downloadToFile>(),
			uploadChat: mockFn<typeof app.files.uploadChat>(),
			uploadDocToFolder: mockFn<typeof app.files.uploadDocToFolder>(),
			uploadFolder: mockFn<typeof app.files.uploadFolder>(),
			uploadFolderToFolder: mockFn<typeof app.files.uploadFolderToFolder>()
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
		},
		search: {
			getDefaultItems: mockFn<typeof app.search.getDefaultItems>(() => []),
			searchChats: mockFn<typeof app.search.searchChats>(() => [])
		}
	} satisfies AppMock;

	return mergeMock<AppMock>(base, overrides);
}
