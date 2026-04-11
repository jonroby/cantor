import { vi } from 'vitest';
import type * as app from '@/app';
import type * as state from '@/state';
import appContract from '@tests/contracts/app.json';

import { mergeMock, mockFn, type DeepPartial, type PublicApiMock } from './helpers';

type AppMock = PublicApiMock<typeof app, typeof appContract>;

export function createAppMock(overrides?: DeepPartial<AppMock>): AppMock {
	const providerStateBacking: ReturnType<typeof app.providers.getState> = {
		activeModel: null,
		activeModelLabel: null,
		contextLength: null,
		vaultState: 'empty',
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
					activeExchangeId: null,
					contextStrategy: 'full' as const,
					mode: 'chat' as const
				}
			] as state.chats.ChatRecord[],
			activeChatIndex: 0
		},
		deleteChat: vi.fn(),
		deleteDocumentFromFolder: vi.fn(),
		deleteFolder: vi.fn(),
		documentState: {
			folders: [] as state.documents.Folder[],
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
		agent: {
			TOOLS: [] as typeof app.agent.TOOLS,
			acceptPending: mockFn<typeof app.agent.acceptPending>(),
			buildMessages: mockFn<typeof app.agent.buildMessages>(() => []),
			buildSystemPrompt: mockFn<typeof app.agent.buildSystemPrompt>(() => ''),
			describeCapabilities: mockFn<typeof app.agent.describeCapabilities>(() => ''),
			dismissResponse: mockFn<typeof app.agent.dismissResponse>(),
			executeTool: mockFn<typeof app.agent.executeTool>(() => ({ result: '' })),
			getCapabilities: mockFn<typeof app.agent.getCapabilities>(() => []),
			getRelevantTools: mockFn<typeof app.agent.getRelevantTools>(() => []),
			getState: mockFn<typeof app.agent.getState>(() => ({
				streamingExchangeIds: [],
				pendingContent: null,
				lastResponse: null,
				liveStatusByExchangeId: {},
				thinkingByExchangeId: {},
				expandedByExchangeId: {}
			})),
			getToolDefinition: mockFn<typeof app.agent.getToolDefinition>(() => undefined),
			isRunning: mockFn<typeof app.agent.isRunning>(() => false),
			rejectPending: mockFn<typeof app.agent.rejectPending>(),
			reset: mockFn<typeof app.agent.reset>(),
			setThinkingExpanded: mockFn<typeof app.agent.setThinkingExpanded>(),
			startRun: mockFn<typeof app.agent.startRun>(),
			stop: mockFn<typeof app.agent.stop>(),
			stopRun: mockFn<typeof app.agent.stopRun>(),
			stopRunsForChat: mockFn<typeof app.agent.stopRunsForChat>()
		},
		bootstrap: {
			deleteTrashItem: mockFn<typeof app.bootstrap.deleteTrashItem>(async () => {}),
			emptyTrash: mockFn<typeof app.bootstrap.emptyTrash>(async () => {}),
			initialize: mockFn<typeof app.bootstrap.initialize>(async () => ({
				restoredDocument: null,
				hadDuplicateRenames: false
			})),
			loadTrash: mockFn<typeof app.bootstrap.loadTrash>(async () => []),
			restoreChat: mockFn<typeof app.bootstrap.restoreChat>(async () => false),
			restoreDocument: mockFn<typeof app.bootstrap.restoreDocument>(async () => false),
			restoreFolder: mockFn<typeof app.bootstrap.restoreFolder>(async () => false),
			save: mockFn<typeof app.bootstrap.save>(async () => {})
		},
		chat: {
			addDocumentToChat: mockFn<typeof app.chat.addDocumentToChat>(),
			canCreateSideChat: mockFn<typeof app.chat.canCreateSideChat>(() => false),
			canPromoteSideChat: mockFn<typeof app.chat.canPromoteSideChat>(() => false),
			canSubmitPrompt: mockFn<typeof app.chat.canSubmitPrompt>(() => false),
			copyChat: mockFn<typeof app.chat.copyChat>(),
			createChat: mockFn<typeof app.chat.createChat>(),
			deleteExchange: mockFn<typeof app.chat.deleteExchange>(),
			exportChat: mockFn<typeof app.chat.exportChat>(),
			exportState: mockFn<typeof app.chat.exportState>(),
			getExchangePath: mockFn<typeof app.chat.getExchangePath>(() => []),
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
			getContextStrategy: mockFn<typeof app.chat.getContextStrategy>(() => 'full'),
			getEnabledToolNames: mockFn<typeof app.chat.getEnabledToolNames>(() => null),
			getMode: mockFn<typeof app.chat.getMode>(() => 'chat'),
			getMainChat: mockFn<typeof app.chat.getMainChat>(() => []),
			getSideChats: mockFn<typeof app.chat.getSideChats>(() => []),
			getTotalTokens: mockFn<typeof app.chat.getTotalTokens>(() => 0),
			getUsedTokens: mockFn<typeof app.chat.getUsedTokens>(() => 0),
			importChat: mockFn<typeof app.chat.importChat>(),
			isStreaming: mockFn<typeof app.chat.isStreaming>(() => false),
			promoteExchange: mockFn<typeof app.chat.promoteExchange>(),
			quickAsk: mockFn<typeof app.chat.quickAsk>(),
			removeChat: mockFn<typeof app.chat.removeChat>(),
			renameChat: mockFn<typeof app.chat.renameChat>(),
			selectChat: mockFn<typeof app.chat.selectChat>(),
			selectExchange: mockFn<typeof app.chat.selectExchange>(),
			setContextStrategy: mockFn<typeof app.chat.setContextStrategy>(),
			setEnabledToolNames: mockFn<typeof app.chat.setEnabledToolNames>(),
			setMode: mockFn<typeof app.chat.setMode>(),
			stopChatStreams: mockFn<typeof app.chat.stopChatStreams>(),
			stopStream: mockFn<typeof app.chat.stopStream>(),
			submitPrompt: mockFn<typeof app.chat.submitPrompt>()
		},
		documents: {
			addDocumentToChat: mockFn<typeof app.documents.addDocumentToChat>(),
			closeDocument: mockFn<typeof app.documents.closeDocument>(),
			closeOpenDocument: mockFn<typeof app.documents.closeOpenDocument>(),
			createDocument: mockFn<typeof app.documents.createDocument>(),
			createFileWithContent: mockFn<typeof app.documents.createFileWithContent>(() => ({
				result: null
			})),
			createFolder: mockFn<typeof app.documents.createFolder>(),
			createNamedFolder: mockFn<typeof app.documents.createNamedFolder>(() => null),
			deleteDocument: mockFn<typeof app.documents.deleteDocument>(),
			deleteFolder: mockFn<typeof app.documents.deleteFolder>(),
			exportFolder: mockFn<typeof app.documents.exportFolder>(),
			findOpenDocumentIndex: mockFn<typeof app.documents.findOpenDocumentIndex>(() => -1),
			SUPPORTED_EXTENSIONS: ['.md', '.svg'] as const,
			getDocument: mockFn<typeof app.documents.getDocument>(() => null),
			getFolder: mockFn<typeof app.documents.getFolder>(() => undefined),
			isSupportedFileName: mockFn<typeof app.documents.isSupportedFileName>(() => true),
			getState: mockFn<typeof app.documents.getState>(() => appStateBacking.documentState),
			importDocument: mockFn<typeof app.documents.importDocument>(),
			importFolder: mockFn<typeof app.documents.importFolder>(),
			importFolderIntoFolder: mockFn<typeof app.documents.importFolderIntoFolder>(),
			moveDocument: mockFn<typeof app.documents.moveDocument>(),
			openDocument: mockFn<typeof app.documents.openDocument>(),
			renameDocument: mockFn<typeof app.documents.renameDocument>(() => ({ result: null })),
			supportedExtensionsLabel: mockFn<typeof app.documents.supportedExtensionsLabel>(
				() => '.md, .svg'
			),
			renameFolder: mockFn<typeof app.documents.renameFolder>(),
			resolveAsset: mockFn<typeof app.documents.resolveAsset>(() => null),
			updateDocumentContent: mockFn<typeof app.documents.updateDocumentContent>(),
			updateOpenDocumentContent: mockFn<typeof app.documents.updateOpenDocumentContent>(),
			validateDocumentMarkdown: mockFn<typeof app.documents.validateDocumentMarkdown>(() => [])
		},
		providers: {
			clearCachedModels: mockFn<typeof app.providers.clearCachedModels>(),
			lockAllCredentials: mockFn<typeof app.providers.lockAllCredentials>(async () => {}),
			connect: mockFn<typeof app.providers.connect>(),
			getState: mockFn<typeof app.providers.getState>(() => providerStateBacking),
			initialize: mockFn<typeof app.providers.initialize>(),
			removeCredential: mockFn<typeof app.providers.removeCredential>(),
			removeCachedModel: mockFn<typeof app.providers.removeCachedModel>(),
			resolveModelLabel: mockFn<typeof app.providers.resolveModelLabel>(() => undefined),
			saveCredential: mockFn<typeof app.providers.saveCredential>(),
			selectModel: mockFn<typeof app.providers.selectModel>(),
			setContextSize: mockFn<typeof app.providers.setContextSize>(),
			streamText: mockFn<typeof app.providers.streamText>(),
			unlockCredentials: mockFn<typeof app.providers.unlockCredentials>()
		},
		canvas: {
			getDeleteMode: mockFn<typeof app.canvas.getDeleteMode>(() => 'exchange'),
			getExpandedParentFromSelection: mockFn<typeof app.canvas.getExpandedParentFromSelection>(
				() => null
			),
			getHiddenExchangeIds: mockFn<typeof app.canvas.getHiddenExchangeIds>(() => new Set()),
			getSideChatIndexFromSelection: mockFn<typeof app.canvas.getSideChatIndexFromSelection>(
				() => 0
			),
			isSideRoot: mockFn<typeof app.canvas.isSideRoot>(() => false)
		},
		workspace: {
			clearOpenDocument: mockFn<typeof app.workspace.clearOpenDocument>(),
			getState: mockFn<typeof app.workspace.getState>(() => ({
				panels: [{ type: 'chat' as const }],
				expandedFolders: {},
				sidebarOpen: true,
				selectedFileIdsByFolderId: {}
			})),
			rememberOpenDocument: mockFn<typeof app.workspace.rememberOpenDocument>(),
			selectFolderFile: mockFn<typeof app.workspace.selectFolderFile>(),
			setActiveModel: mockFn<typeof app.workspace.setActiveModel>(),
			setExpandedFolders: mockFn<typeof app.workspace.setExpandedFolders>(),
			setPanels: mockFn<typeof app.workspace.setPanels>(),
			setSidebarOpen: mockFn<typeof app.workspace.setSidebarOpen>(),
			toggleSidebar: mockFn<typeof app.workspace.toggleSidebar>()
		}
	} satisfies AppMock;

	return mergeMock<AppMock>(base, overrides);
}

export async function mockAppChatModule() {
	return createAppMock().chat;
}

export async function mockAppDocumentsModule() {
	return createAppMock().documents;
}

export async function mockAppProvidersModule() {
	return createAppMock().providers;
}

export async function mockAppWorkspaceModule() {
	return createAppMock().workspace;
}
