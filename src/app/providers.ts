import { PROVIDER_CONFIG, type ActiveModel, type Provider } from '@/domain/models';
import {
	DEFAULT_OLLAMA_URL,
	fetchAvailableModels,
	fetchModelContextLength,
	streamOllamaChat
} from '@/state/services/providers/ollama';
import {
	getWebLLMModels,
	loadWebLLMModel,
	streamWebLLMChat,
	deleteModelCache,
	deleteAllModelCaches
} from '@/state/services/providers/webllm';
import { streamClaudeChat } from '@/state/services/providers/claude';
import { streamGeminiChat } from '@/state/services/providers/gemini';
import { streamOpenAICompatChat } from '@/state/services/providers/openai-compat';
import {
	clearProviderKey,
	loadAllApiKeys,
	migrateVault,
	saveApiKey,
	storedProviders as getStoredProviders
} from '@/state/services/providers/vault';
import { providerState } from '@/state/providers.svelte';
import type { Message } from '@/domain/tree';

export function init() {
	migrateVault();
	providerState.vaultProviders = getStoredProviders();
	providerState.webllmModels = getWebLLMModels();
}

export async function autoConnectOllama() {
	try {
		const models = await fetchAvailableModels(DEFAULT_OLLAMA_URL);
		if (models.length > 0) {
			providerState.ollamaUrl = DEFAULT_OLLAMA_URL;
			providerState.ollamaModels = models;
			providerState.ollamaStatus = 'connected';
			providerState.activeModel = { provider: 'ollama', modelId: models[0] };
		}
	} catch {
		// Ollama not running
	}
}

export async function connectOllama(url: string) {
	providerState.ollamaStatus = 'connecting';
	try {
		const models = await fetchAvailableModels(url);
		providerState.ollamaUrl = url;
		providerState.ollamaModels = models;
		providerState.ollamaStatus = 'connected';
	} catch (error) {
		providerState.ollamaStatus = 'error';
		providerState.ollamaModels = [];
		providerState.operationError =
			error instanceof Error ? error.message : 'Failed to connect to Ollama.';
	}
}

export async function loadWebLLMModel_(modelId: string) {
	providerState.webllmStatus = 'loading';
	providerState.webllmProgress = 0;
	providerState.webllmProgressText = '';
	providerState.webllmError = null;
	try {
		await loadWebLLMModel(modelId, providerState.webllmContextSize, (report) => {
			providerState.webllmProgress = report.progress;
			providerState.webllmProgressText = report.text;
		});
		providerState.webllmStatus = 'ready';
		providerState.activeModel = { provider: 'webllm', modelId };
		providerState.contextLength = providerState.webllmContextSize;
	} catch (error) {
		providerState.webllmStatus = 'error';
		providerState.webllmError = error instanceof Error ? error.message : 'Failed to load model.';
	}
}

export async function deleteWebLLMCache(modelId: string) {
	await deleteModelCache(modelId);
	if (
		providerState.activeModel?.provider === 'webllm' &&
		providerState.activeModel.modelId === modelId
	) {
		providerState.activeModel = null;
		providerState.webllmStatus = 'idle';
	}
}

export async function deleteAllWebLLMCaches() {
	await deleteAllModelCaches();
	if (providerState.activeModel?.provider === 'webllm') {
		providerState.activeModel = null;
	}
	providerState.webllmStatus = 'idle';
}

export async function unlockKeys(password: string) {
	providerState.apiKeys = await loadAllApiKeys(password);
}

export async function saveKey(provider: string, apiKey: string, password: string) {
	await saveApiKey(provider, apiKey, password);
	providerState.apiKeys = { ...providerState.apiKeys, [provider]: apiKey };
	providerState.vaultProviders = getStoredProviders();
}

export function forgetKey(provider: string) {
	clearProviderKey(provider);
	const { [provider]: _, ...rest } = providerState.apiKeys;
	void _;
	providerState.apiKeys = rest;
	providerState.vaultProviders = getStoredProviders();
	if (providerState.activeModel?.provider === provider) {
		providerState.activeModel = null;
	}
}

export async function fetchOllamaContextLength() {
	if (providerState.activeModel?.provider === 'ollama') {
		const modelId = providerState.activeModel.modelId;
		const url = providerState.ollamaUrl;
		try {
			const length = await fetchModelContextLength(modelId, url);
			if (
				providerState.activeModel?.provider === 'ollama' &&
				providerState.activeModel.modelId === modelId &&
				providerState.ollamaUrl === url
			) {
				providerState.contextLength = length;
			}
		} catch {
			if (
				providerState.activeModel?.provider === 'ollama' &&
				providerState.activeModel.modelId === modelId &&
				providerState.ollamaUrl === url
			) {
				providerState.contextLength = null;
			}
		}
	}
}

export function getProviderStream(model: ActiveModel, history: Message[], signal: AbortSignal) {
	const key = providerState.apiKeys[model.provider] ?? '';
	if (model.provider === 'webllm') return streamWebLLMChat(history, signal);
	if (model.provider === 'ollama')
		return streamOllamaChat(model.modelId, history, signal, providerState.ollamaUrl);
	if (model.provider === 'claude') return streamClaudeChat(model.modelId, history, key, signal);
	if (model.provider === 'gemini') return streamGeminiChat(model.modelId, history, key, signal);
	const config = PROVIDER_CONFIG[model.provider as Exclude<Provider, 'ollama' | 'webllm'>];
	return streamOpenAICompatChat(config.baseUrl, model.modelId, history, key, signal);
}
