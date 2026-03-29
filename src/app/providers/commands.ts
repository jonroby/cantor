import {
	DEFAULT_OLLAMA_URL,
	fetchAvailableModels,
	fetchModelContextLength
} from '@/external/providers/ollama';
import {
	loadWebLLMModel,
	deleteModelCache,
	deleteAllModelCaches
} from '@/external/providers/webllm';
import {
	clearProviderKey,
	loadAllApiKeys,
	saveApiKey,
	storedProviders as getStoredProviders
} from '@/external/providers/vault';
import { providerState } from '@/state';

export function autoConnectOllama() {
	return _autoConnectOllama();
}

async function _autoConnectOllama() {
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
		if (providerState.activeModel?.provider === 'ollama') {
			if (models.includes(providerState.activeModel.modelId)) {
				providerState.activeModel = {
					provider: 'ollama',
					modelId: providerState.activeModel.modelId
				};
			} else {
				providerState.activeModel = models[0] ? { provider: 'ollama', modelId: models[0] } : null;
			}
		}
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
