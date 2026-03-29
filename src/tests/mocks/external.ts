import { vi } from 'vitest';

import type * as external from '@/external';

import { mergeMock, type DeepPartial, type PublicApiMock } from './helpers';

type ExternalMock = PublicApiMock<typeof external>;

export function createExternalMock(overrides?: DeepPartial<ExternalMock>): ExternalMock {
	const base = {
		files: {
			deduplicateName: vi.fn((name: string) => name),
			findRootId: vi.fn(),
			validateChatUpload: vi.fn((value: unknown) => value)
		},
		persistence: {
			clearVaultStorage: vi.fn(),
			getPersistedLayout: vi.fn(() => ({})),
			getVaultStore: vi.fn(() => ({})),
			loadFromStorage: vi.fn(),
			migrateVaultStorage: vi.fn(),
			saveToStorage: vi.fn(),
			setPersistedLayout: vi.fn(),
			setVaultStore: vi.fn()
		},
		providers: {
			catalog: {
				CLAUDE_MODELS: [],
				getModelContextLength: vi.fn(() => null),
				getProviderForModelId: vi.fn(() => null),
				PROVIDER_CONFIG: {} as ExternalMock['providers']['catalog']['PROVIDER_CONFIG'],
				PROVIDER_MODELS: {} as ExternalMock['providers']['catalog']['PROVIDER_MODELS']
			},
			claude: {
				streamClaudeChat: vi.fn()
			},
			gemini: {
				streamGeminiChat: vi.fn()
			},
			ollama: {
				DEFAULT_OLLAMA_URL: 'http://localhost:11434',
				fetchAvailableModels: vi.fn(),
				fetchModelContextLength: vi.fn(),
				streamOllamaChat: vi.fn()
			},
			openAiCompat: {
				streamOpenAICompatChat: vi.fn()
			},
			stream: {
				getProviderStream: vi.fn()
			},
			vault: {
				clearProviderKey: vi.fn(),
				clearVault: vi.fn(),
				hasProviderKey: vi.fn(() => false),
				hasVault: vi.fn(() => false),
				loadAllApiKeys: vi.fn(async () => ({})),
				loadApiKey: vi.fn(async () => null),
				migrateVault: vi.fn(),
				saveApiKey: vi.fn(async () => {}),
				storedProviders: vi.fn(() => [])
			},
			webllm: {
				deleteAllModelCaches: vi.fn(async () => {}),
				deleteModelCache: vi.fn(async () => {}),
				getLoadedModelId: vi.fn(() => null),
				getWebLLMEngine: vi.fn(),
				getWebLLMModels: vi.fn(async () => []),
				isModelCached: vi.fn(async () => false),
				isWebLLMReady: vi.fn(() => false),
				loadWebLLMModel: vi.fn(async () => {}),
				streamWebLLMChat: vi.fn(),
				unloadWebLLM: vi.fn(),
				WEBLLM_CONTEXT_OPTIONS: [
					{ label: '4K', value: 4_096 },
					{ label: '8K', value: 8_192 },
					{ label: '16K', value: 16_384 }
				] as const
			}
		},
		streams: {
			cancelAllStreams: vi.fn(),
			cancelStream: vi.fn(),
			cancelStreamsForChat: vi.fn(),
			cancelStreamsForExchanges: vi.fn(),
			isAnyStreaming: vi.fn(() => false),
			isStreaming: vi.fn(() => false),
			startStream: vi.fn()
		}
	} satisfies ExternalMock;

	return mergeMock(
		base as unknown as Record<string, unknown>,
		overrides as DeepPartial<Record<string, unknown>>
	) as unknown as ExternalMock;
}
