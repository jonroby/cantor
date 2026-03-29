import * as external from '@/external';
import * as state from '@/state';

export function autoConnectOllama() {
	return _autoConnectOllama();
}

async function _autoConnectOllama() {
	try {
		const models = await external.providers.fetchAvailableModels(
			external.providers.DEFAULT_OLLAMA_URL
		);
		if (models.length > 0) {
			state.providers.providerState.ollamaUrl = external.providers.DEFAULT_OLLAMA_URL;
			state.providers.providerState.ollamaModels = models;
			state.providers.providerState.ollamaStatus = 'connected';
			state.providers.providerState.activeModel = { provider: 'ollama', modelId: models[0] };
		}
	} catch {
		// Ollama not running
	}
}

export async function connectOllama(url: string) {
	state.providers.providerState.ollamaStatus = 'connecting';
	try {
		const models = await external.providers.fetchAvailableModels(url);
		state.providers.providerState.ollamaUrl = url;
		state.providers.providerState.ollamaModels = models;
		state.providers.providerState.ollamaStatus = 'connected';
		if (state.providers.providerState.activeModel?.provider === 'ollama') {
			if (models.includes(state.providers.providerState.activeModel.modelId)) {
				state.providers.providerState.activeModel = {
					provider: 'ollama',
					modelId: state.providers.providerState.activeModel.modelId
				};
			} else {
				state.providers.providerState.activeModel = models[0]
					? { provider: 'ollama', modelId: models[0] }
					: null;
			}
		}
	} catch (error) {
		state.providers.providerState.ollamaStatus = 'error';
		state.providers.providerState.ollamaModels = [];
		state.providers.providerState.operationError =
			error instanceof Error ? error.message : 'Failed to connect to Ollama.';
	}
}

export async function loadWebLLMModel_(modelId: string) {
	state.providers.providerState.webllmStatus = 'loading';
	state.providers.providerState.webllmProgress = 0;
	state.providers.providerState.webllmProgressText = '';
	state.providers.providerState.webllmError = null;
	try {
		await external.providers.loadWebLLMModel(
			modelId,
			state.providers.providerState.webllmContextSize,
			(report) => {
				state.providers.providerState.webllmProgress = report.progress;
				state.providers.providerState.webllmProgressText = report.text;
			}
		);
		state.providers.providerState.webllmStatus = 'ready';
		state.providers.providerState.activeModel = { provider: 'webllm', modelId };
		state.providers.providerState.contextLength = state.providers.providerState.webllmContextSize;
	} catch (error) {
		state.providers.providerState.webllmStatus = 'error';
		state.providers.providerState.webllmError =
			error instanceof Error ? error.message : 'Failed to load model.';
	}
}

export async function deleteWebLLMCache(modelId: string) {
	await external.providers.deleteModelCache(modelId);
	if (
		state.providers.providerState.activeModel?.provider === 'webllm' &&
		state.providers.providerState.activeModel.modelId === modelId
	) {
		state.providers.providerState.activeModel = null;
		state.providers.providerState.webllmStatus = 'idle';
	}
}

export async function deleteAllWebLLMCaches() {
	await external.providers.deleteAllModelCaches();
	if (state.providers.providerState.activeModel?.provider === 'webllm') {
		state.providers.providerState.activeModel = null;
	}
	state.providers.providerState.webllmStatus = 'idle';
}

export async function unlockKeys(password: string) {
	state.providers.providerState.apiKeys = await external.providers.loadAllApiKeys(password);
}

export async function saveKey(provider: string, apiKey: string, password: string) {
	await external.providers.saveApiKey(provider, apiKey, password);
	state.providers.providerState.apiKeys = {
		...state.providers.providerState.apiKeys,
		[provider]: apiKey
	};
	state.providers.providerState.vaultProviders = external.providers.storedProviders();
}

export function forgetKey(provider: string) {
	external.providers.clearProviderKey(provider);
	const { [provider]: _, ...rest } = state.providers.providerState.apiKeys;
	void _;
	state.providers.providerState.apiKeys = rest;
	state.providers.providerState.vaultProviders = external.providers.storedProviders();
	if (state.providers.providerState.activeModel?.provider === provider) {
		state.providers.providerState.activeModel = null;
	}
}

export async function fetchOllamaContextLength() {
	if (state.providers.providerState.activeModel?.provider === 'ollama') {
		const modelId = state.providers.providerState.activeModel.modelId;
		const url = state.providers.providerState.ollamaUrl;
		try {
			const length = await external.providers.fetchModelContextLength(modelId, url);
			if (
				state.providers.providerState.activeModel?.provider === 'ollama' &&
				state.providers.providerState.activeModel.modelId === modelId &&
				state.providers.providerState.ollamaUrl === url
			) {
				state.providers.providerState.contextLength = length;
			}
		} catch {
			if (
				state.providers.providerState.activeModel?.provider === 'ollama' &&
				state.providers.providerState.activeModel.modelId === modelId &&
				state.providers.providerState.ollamaUrl === url
			) {
				state.providers.providerState.contextLength = null;
			}
		}
	}
}
