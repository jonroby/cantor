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

export const providerState = $state({
	activeModel: null as ActiveModel | null,
	contextLength: null as number | null,
	ollamaUrl: DEFAULT_OLLAMA_URL,
	ollamaStatus: 'disconnected' as OllamaStatus,
	ollamaModels: [] as string[],
	apiKeys: {} as Record<string, string>,
	vaultProviders: [] as string[],
	operationError: null as string | null,
	webllmStatus: 'idle' as WebLLMStatus,
	webllmProgress: 0,
	webllmProgressText: '',
	webllmModels: [] as WebLLMModelEntry[],
	webllmError: null as string | null,
	webllmContextSize: 4_096 as WebLLMContextSize
});

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

export function selectModel(model: ActiveModel) {
	providerState.activeModel = model;
}

export function updateContextLength() {
	if (providerState.activeModel && isKeyBasedProvider(providerState.activeModel.provider)) {
		providerState.contextLength = getModelContextLength(
			providerState.activeModel.provider,
			providerState.activeModel.modelId
		);
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
