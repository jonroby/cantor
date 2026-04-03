import type * as external from '@/external';
import externalContract from '@/tests/contracts/external.json';
import { CLAUDE_MODELS, PROVIDER_CONFIG, PROVIDER_MODELS } from '@/external/providers/catalog';
import { DEFAULT_OLLAMA_URL } from '@/external/providers/ollama';
import { WEBLLM_CONTEXT_OPTIONS } from '@/external/providers/webllm';

import { mergeMock, mockFn, type DeepPartial, type PublicApiMock } from './helpers';

type ExternalMock = PublicApiMock<typeof external, typeof externalContract>;

export function createExternalMock(overrides?: DeepPartial<ExternalMock>): ExternalMock {
	const base = {
		io: {
			downloadBlob: mockFn<typeof external.io.downloadBlob>(),
			pickDirectory: mockFn<typeof external.io.pickDirectory>(async () => []),
			pickFile: mockFn<typeof external.io.pickFile>(async () => null),
			validateChatUpload: mockFn<typeof external.io.validateChatUpload>(
				(value) => value as ReturnType<typeof external.io.validateChatUpload>
			)
		},
		persistence: {
			clearVaultStorage: mockFn<typeof external.persistence.clearVaultStorage>(),
			deleteTrashItem: mockFn<typeof external.persistence.deleteTrashItem>(async () => {}),
			emptyTrash: mockFn<typeof external.persistence.emptyTrash>(async () => {}),
			getPersistedLayout: mockFn<typeof external.persistence.getPersistedLayout>(() => ({})),
			getTrashItem: mockFn<typeof external.persistence.getTrashItem>(async () => undefined),
			getVaultStore: mockFn<typeof external.persistence.getVaultStore>(() => ({})),
			loadFromStorage: mockFn<typeof external.persistence.loadFromStorage>(),
			loadTrash: mockFn<typeof external.persistence.loadTrash>(async () => []),
			saveToStorage: mockFn<typeof external.persistence.saveToStorage>(),
			setPersistedLayout: mockFn<typeof external.persistence.setPersistedLayout>(),
			setVaultStore: mockFn<typeof external.persistence.setVaultStore>(),
			trashItem: mockFn<typeof external.persistence.trashItem>(async () => {})
		},
		providers: {
			catalog: {
				CLAUDE_MODELS,
				getModelContextLength: mockFn<typeof external.providers.catalog.getModelContextLength>(
					() => null
				),
				getProviderForModelId: mockFn<typeof external.providers.catalog.getProviderForModelId>(
					() => null
				),
				PROVIDER_CONFIG,
				PROVIDER_MODELS
			},
			claude: {
				streamClaudeChat: mockFn<typeof external.providers.claude.streamClaudeChat>()
			},
			gemini: {
				streamGeminiChat: mockFn<typeof external.providers.gemini.streamGeminiChat>()
			},
			ollama: {
				DEFAULT_OLLAMA_URL,
				fetchAvailableModels: mockFn<typeof external.providers.ollama.fetchAvailableModels>(),
				fetchModelContextLength: mockFn<typeof external.providers.ollama.fetchModelContextLength>(),
				streamOllamaChat: mockFn<typeof external.providers.ollama.streamOllamaChat>()
			},
			openAiCompat: {
				streamOpenAICompatChat:
					mockFn<typeof external.providers.openAiCompat.streamOpenAICompatChat>()
			},
			stream: {
				getProviderStream: mockFn<typeof external.providers.stream.getProviderStream>()
			},
			validate: {
				validateApiKey: mockFn<typeof external.providers.validate.validateApiKey>(async () => {})
			},
			vault: {
				clearProviderKey: mockFn<typeof external.providers.vault.clearProviderKey>(),
				clearVault: mockFn<typeof external.providers.vault.clearVault>(),
				hasProviderKey: mockFn<typeof external.providers.vault.hasProviderKey>(() => false),
				hasVault: mockFn<typeof external.providers.vault.hasVault>(() => false),
				loadAllApiKeys: mockFn<typeof external.providers.vault.loadAllApiKeys>(async () => ({})),
				loadApiKey: mockFn<typeof external.providers.vault.loadApiKey>(async () => ''),
				saveApiKey: mockFn<typeof external.providers.vault.saveApiKey>(async () => {}),
				storedProviders: mockFn<typeof external.providers.vault.storedProviders>(() => [])
			},
			webllm: {
				deleteAllModelCaches: mockFn<typeof external.providers.webllm.deleteAllModelCaches>(
					async () => {}
				),
				deleteModelCache: mockFn<typeof external.providers.webllm.deleteModelCache>(async () => {}),
				getLoadedModelId: mockFn<typeof external.providers.webllm.getLoadedModelId>(() => null),
				getWebLLMEngine: mockFn<typeof external.providers.webllm.getWebLLMEngine>(),
				getWebLLMModels: mockFn<typeof external.providers.webllm.getWebLLMModels>(async () => []),
				isModelCached: mockFn<typeof external.providers.webllm.isModelCached>(async () => false),
				isWebLLMReady: mockFn<typeof external.providers.webllm.isWebLLMReady>(() => false),
				loadWebLLMModel: mockFn<typeof external.providers.webllm.loadWebLLMModel>(async () => {}),
				streamWebLLMChat: mockFn<typeof external.providers.webllm.streamWebLLMChat>(),
				unloadWebLLM: mockFn<typeof external.providers.webllm.unloadWebLLM>(),
				WEBLLM_CONTEXT_OPTIONS
			}
		},
		streams: {
			cancelAllStreams: mockFn<typeof external.streams.cancelAllStreams>(),
			cancelStream: mockFn<typeof external.streams.cancelStream>(),
			cancelStreamsForChat: mockFn<typeof external.streams.cancelStreamsForChat>(),
			cancelStreamsForExchanges: mockFn<typeof external.streams.cancelStreamsForExchanges>(),
			isAnyStreaming: mockFn<typeof external.streams.isAnyStreaming>(() => false),
			isStreaming: mockFn<typeof external.streams.isStreaming>(() => false),
			startStream: mockFn<typeof external.streams.startStream>()
		}
	} satisfies ExternalMock;

	return mergeMock<ExternalMock>(base, overrides);
}

export async function mockExternalModule() {
	return createExternalMock();
}
