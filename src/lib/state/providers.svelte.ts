import {
	PROVIDER_CONFIG,
	getModelContextLength,
	isKeyBasedProvider,
	type ActiveModel,
	type OllamaStatus,
	type Provider
} from '@/lib/chat/models';
import {
	DEFAULT_OLLAMA_URL,
	fetchAvailableModels,
	fetchModelContextLength,
	streamOllamaChat
} from '@/lib/chat/ollama';
import {
	getWebLLMModels,
	loadWebLLMModel,
	streamWebLLMChat,
	deleteModelCache,
	deleteAllModelCaches,
	WEBLLM_CONTEXT_OPTIONS,
	type WebLLMStatus,
	type WebLLMModelEntry,
	type WebLLMContextSize
} from '@/lib/chat/webllm';
import { streamClaudeChat } from '@/lib/chat/claude';
import { streamGeminiChat } from '@/lib/chat/gemini';
import { streamOpenAICompatChat } from '@/lib/chat/openai-compat';
import {
	clearProviderKey,
	loadAllApiKeys,
	migrateVault,
	saveApiKey,
	storedProviders as getStoredProviders
} from '@/lib/chat/vault';
import type { Message } from '@/lib/chat/tree';

export { WEBLLM_CONTEXT_OPTIONS };
export type { WebLLMStatus, WebLLMModelEntry, WebLLMContextSize, ActiveModel, OllamaStatus };

export function createProviderState() {
	let activeModel: ActiveModel | null = $state(null);
	let contextLength: number | null = $state(null);
	let ollamaUrl = $state(DEFAULT_OLLAMA_URL);
	let ollamaStatus: OllamaStatus = $state('disconnected');
	let ollamaModels: string[] = $state([]);
	let apiKeys: Record<string, string> = $state({});
	let vaultProviders: string[] = $state([]);
	let operationError: string | null = $state(null);

	let webllmStatus: WebLLMStatus = $state('idle');
	let webllmProgress = $state(0);
	let webllmProgressText = $state('');
	let webllmModels: WebLLMModelEntry[] = $state([]);
	let webllmError: string | null = $state(null);
	let webllmContextSize: WebLLMContextSize = $state(4_096);

	function init() {
		migrateVault();
		vaultProviders = getStoredProviders();
		webllmModels = getWebLLMModels();
	}

	async function autoConnectOllama() {
		try {
			const models = await fetchAvailableModels(DEFAULT_OLLAMA_URL);
			if (models.length > 0) {
				ollamaUrl = DEFAULT_OLLAMA_URL;
				ollamaModels = models;
				ollamaStatus = 'connected';
				activeModel = { provider: 'ollama', modelId: models[0] };
			}
		} catch {
			// Ollama not running
		}
	}

	async function connectOllama(url: string) {
		ollamaStatus = 'connecting';
		try {
			const models = await fetchAvailableModels(url);
			ollamaUrl = url;
			ollamaModels = models;
			ollamaStatus = 'connected';
		} catch (error) {
			ollamaStatus = 'error';
			ollamaModels = [];
			operationError = error instanceof Error ? error.message : 'Failed to connect to Ollama.';
		}
	}

	async function loadWebLLMModel_(modelId: string) {
		webllmStatus = 'loading';
		webllmProgress = 0;
		webllmProgressText = '';
		webllmError = null;
		try {
			await loadWebLLMModel(modelId, webllmContextSize, (report) => {
				webllmProgress = report.progress;
				webllmProgressText = report.text;
			});
			webllmStatus = 'ready';
			activeModel = { provider: 'webllm', modelId };
			contextLength = webllmContextSize;
		} catch (error) {
			webllmStatus = 'error';
			webllmError = error instanceof Error ? error.message : 'Failed to load model.';
		}
	}

	async function deleteWebLLMCache(modelId: string) {
		await deleteModelCache(modelId);
		if (activeModel?.provider === 'webllm' && activeModel.modelId === modelId) {
			activeModel = null;
			webllmStatus = 'idle';
		}
	}

	async function deleteAllWebLLMCaches() {
		await deleteAllModelCaches();
		if (activeModel?.provider === 'webllm') {
			activeModel = null;
		}
		webllmStatus = 'idle';
	}

	async function unlockKeys(password: string) {
		apiKeys = await loadAllApiKeys(password);
	}

	async function saveKey(provider: string, apiKey: string, password: string) {
		await saveApiKey(provider, apiKey, password);
		apiKeys = { ...apiKeys, [provider]: apiKey };
		vaultProviders = getStoredProviders();
	}

	function forgetKey(provider: string) {
		clearProviderKey(provider);
		const { [provider]: _, ...rest } = apiKeys;
		void _;
		apiKeys = rest;
		vaultProviders = getStoredProviders();
		if (activeModel?.provider === provider) {
			activeModel = null;
		}
	}

	function selectModel(model: ActiveModel) {
		activeModel = model;
	}

	function updateContextLength() {
		if (activeModel && isKeyBasedProvider(activeModel.provider)) {
			contextLength = getModelContextLength(activeModel.provider, activeModel.modelId);
		}
	}

	async function fetchOllamaContextLength() {
		if (activeModel?.provider === 'ollama') {
			const modelId = activeModel.modelId;
			const url = ollamaUrl;
			try {
				const length = await fetchModelContextLength(modelId, url);
				if (
					activeModel?.provider === 'ollama' &&
					activeModel.modelId === modelId &&
					ollamaUrl === url
				) {
					contextLength = length;
				}
			} catch {
				if (
					activeModel?.provider === 'ollama' &&
					activeModel.modelId === modelId &&
					ollamaUrl === url
				) {
					contextLength = null;
				}
			}
		}
	}

	function getProviderStream(model: ActiveModel, history: Message[], signal: AbortSignal) {
		const key = apiKeys[model.provider] ?? '';
		if (model.provider === 'webllm') return streamWebLLMChat(history, signal);
		if (model.provider === 'ollama')
			return streamOllamaChat(model.modelId, history, signal, ollamaUrl);
		if (model.provider === 'claude') return streamClaudeChat(model.modelId, history, key, signal);
		if (model.provider === 'gemini') return streamGeminiChat(model.modelId, history, key, signal);
		const config = PROVIDER_CONFIG[model.provider as Exclude<Provider, 'ollama' | 'webllm'>];
		return streamOpenAICompatChat(config.baseUrl, model.modelId, history, key, signal);
	}

	return {
		get activeModel() {
			return activeModel;
		},
		set activeModel(v: ActiveModel | null) {
			activeModel = v;
		},
		get contextLength() {
			return contextLength;
		},
		set contextLength(v: number | null) {
			contextLength = v;
		},
		get ollamaUrl() {
			return ollamaUrl;
		},
		get ollamaStatus() {
			return ollamaStatus;
		},
		get ollamaModels() {
			return ollamaModels;
		},
		get apiKeys() {
			return apiKeys;
		},
		get vaultProviders() {
			return vaultProviders;
		},
		get operationError() {
			return operationError;
		},
		set operationError(v: string | null) {
			operationError = v;
		},
		get webllmStatus() {
			return webllmStatus;
		},
		get webllmProgress() {
			return webllmProgress;
		},
		get webllmProgressText() {
			return webllmProgressText;
		},
		get webllmModels() {
			return webllmModels;
		},
		get webllmError() {
			return webllmError;
		},
		get webllmContextSize() {
			return webllmContextSize;
		},
		set webllmContextSize(v: WebLLMContextSize) {
			webllmContextSize = v;
		},
		init,
		autoConnectOllama,
		connectOllama,
		loadWebLLMModel: loadWebLLMModel_,
		deleteWebLLMCache,
		deleteAllWebLLMCaches,
		unlockKeys,
		saveKey,
		forgetKey,
		selectModel,
		updateContextLength,
		fetchOllamaContextLength,
		getProviderStream,
		WEBLLM_CONTEXT_OPTIONS
	};
}
