import * as domain from '@/domain';
import * as external from '@/external';
import * as state from '@/state';
import * as lib from '@/lib';
import * as workspace from '@/app/workspace';
import type { Provider, ActiveModel, ContextSize, State } from './types';

export type * from './types';

async function loadWebLLMProvider() {
	const externalModule = await import('@/external');
	return externalModule.providers.webllm;
}

function initProviders() {
	state.providers.providerState.vaultProviders = external.providers.vault.storedProviders();
	return hydrateWebLLMModels();
}

async function hydrateWebLLMModels() {
	const webllm = await loadWebLLMProvider();
	state.providers.providerState.webllmModels = await webllm.getWebLLMModels();
}

async function autoConnectOllama() {
	const host = window.location.hostname;
	if (host !== 'localhost' && host !== '127.0.0.1') return;

	try {
		const models = await external.providers.ollama.fetchAvailableModels(
			external.providers.ollama.DEFAULT_OLLAMA_URL
		);
		if (models.length > 0) {
			state.providers.providerState.ollamaUrl = external.providers.ollama.DEFAULT_OLLAMA_URL;
			state.providers.providerState.ollamaModels = models;
			state.providers.providerState.ollamaStatus = 'connected';
			state.providers.providerState.activeModel = { provider: 'ollama', modelId: models[0] };
		}
	} catch {
		// Ollama not running
	}
}

async function connectOllama(url: string) {
	state.providers.providerState.ollamaStatus = 'connecting';
	try {
		const models = await external.providers.ollama.fetchAvailableModels(url);
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

async function loadWebLLMModel_(modelId: string) {
	state.providers.providerState.webllmStatus = 'loading';
	state.providers.providerState.webllmProgress = 0;
	state.providers.providerState.webllmProgressText = '';
	state.providers.providerState.webllmError = null;
	try {
		const webllm = await loadWebLLMProvider();
		await webllm.loadWebLLMModel(
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

async function deleteWebLLMCache(modelId: string) {
	const webllm = await loadWebLLMProvider();
	await webllm.deleteModelCache(modelId);
	if (
		state.providers.providerState.activeModel?.provider === 'webllm' &&
		state.providers.providerState.activeModel.modelId === modelId
	) {
		state.providers.providerState.activeModel = null;
		state.providers.providerState.webllmStatus = 'idle';
	}
}

async function deleteAllWebLLMCaches() {
	const webllm = await loadWebLLMProvider();
	await webllm.deleteAllModelCaches();
	if (state.providers.providerState.activeModel?.provider === 'webllm') {
		state.providers.providerState.activeModel = null;
	}
	state.providers.providerState.webllmStatus = 'idle';
}

async function unlockVault(password: string) {
	state.providers.providerState.apiKeys = await external.providers.vault.loadAllApiKeys(password);
	await external.providers.vault.cacheSession(password);
}

async function autoUnlockFromSession() {
	const cachedPassword = await external.providers.vault.getCachedSession();
	if (!cachedPassword || state.providers.providerState.vaultProviders.length === 0) return;
	try {
		await unlockVault(cachedPassword);
	} catch {
		await external.providers.vault.clearSession();
	}
}

async function saveKey(provider: string, apiKey: string, password: string) {
	await external.providers.vault.saveApiKey(provider, apiKey, password);
	state.providers.providerState.apiKeys = {
		...state.providers.providerState.apiKeys,
		[provider]: apiKey
	};
	state.providers.providerState.vaultProviders = external.providers.vault.storedProviders();
	await external.providers.vault.cacheSession(password);
}

async function lockVault() {
	state.providers.providerState.apiKeys = {};
	state.providers.providerState.activeModel = null;
	workspace.setActiveModel(null);
	await external.providers.vault.clearSession();
}

function removeKey(provider: string) {
	external.providers.vault.clearProviderKey(provider);
	const { [provider]: _removed, ...rest } = state.providers.providerState.apiKeys;
	void _removed;
	state.providers.providerState.apiKeys = rest;
	state.providers.providerState.vaultProviders = external.providers.vault.storedProviders();
	if (state.providers.providerState.activeModel?.provider === provider) {
		state.providers.providerState.activeModel = null;
		workspace.setActiveModel(null);
	}
}

function getVaultState(): 'empty' | 'locked' | 'unlocked' {
	if (state.providers.providerState.vaultProviders.length === 0) return 'empty';
	if (Object.keys(state.providers.providerState.apiKeys).length > 0) return 'unlocked';
	return 'locked';
}

async function fetchOllamaContextLength() {
	if (state.providers.providerState.activeModel?.provider === 'ollama') {
		const modelId = state.providers.providerState.activeModel.modelId;
		const url = state.providers.providerState.ollamaUrl;
		try {
			const length = await external.providers.ollama.fetchModelContextLength(modelId, url);
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

function providerName(provider: domain.models.Provider): string {
	if (provider === 'ollama') return 'Ollama';
	if (provider === 'webllm') return 'WebLLM';
	return external.providers.catalog.PROVIDER_CONFIG[provider].name;
}

function getCredentialState(provider: domain.models.Provider) {
	if (!domain.models.isKeyBasedProvider(provider)) return 'not-required' as const;
	if (state.providers.providerState.apiKeys[provider]) return 'ready' as const;
	if (
		getVaultState() === 'unlocked' &&
		state.providers.providerState.vaultProviders.includes(provider)
	) {
		return 'ready' as const;
	}
	return 'missing' as const;
}

function getContextLength(model: domain.models.ActiveModel | null): number | null {
	if (!model) return null;
	if (model.provider === 'webllm') return state.providers.providerState.webllmContextSize;
	if (model.provider === 'ollama') return state.providers.providerState.contextLength;
	return external.providers.catalog.getModelContextLength(model.provider, model.modelId);
}

function syncContextLength(model: domain.models.ActiveModel | null) {
	state.providers.providerState.contextLength = getContextLength(model);
}

function getRemoteProviders(): State['providers'] {
	return domain.models.KEY_BASED_PROVIDERS.map((provider) => ({
		id: provider,
		name: providerName(provider),
		kind: 'remote' as const,
		credentialState: getCredentialState(provider),
		models: external.providers.catalog.PROVIDER_MODELS[provider].map((model) => ({
			id: model.id,
			label: model.label,
			enabled:
				provider === 'claude' ||
				provider === 'gemini' ||
				provider === 'openai' ||
				provider === 'deepseek' ||
				provider === 'mistral',
			note:
				provider === 'claude' ||
				provider === 'gemini' ||
				provider === 'openai' ||
				provider === 'deepseek' ||
				provider === 'mistral'
					? undefined
					: 'Soon'
		}))
	}));
}

function getLocalProviders(): State['providers'] {
	return [
		{
			id: 'ollama',
			name: 'Ollama',
			kind: 'local' as const,
			credentialState: 'not-required' as const,
			connection: {
				status: state.providers.providerState.ollamaStatus,
				value: state.providers.providerState.ollamaUrl,
				label: 'Server URL'
			},
			models: state.providers.providerState.ollamaModels.map((modelId) => ({
				id: modelId,
				label: modelId,
				enabled: true
			}))
		},
		{
			id: 'webllm',
			name: 'WebLLM',
			kind: 'embedded' as const,
			loadState: {
				status: state.providers.providerState.webllmStatus,
				progress: state.providers.providerState.webllmProgress,
				text: state.providers.providerState.webllmProgressText,
				error: state.providers.providerState.webllmError
			},
			context: {
				value: state.providers.providerState.webllmContextSize,
				options: lib.providerDefaults.WEBLLM_CONTEXT_OPTIONS
			},
			models: state.providers.providerState.webllmModels.map((model) => ({
				id: model.id,
				label: model.label,
				enabled: true,
				meta:
					model.vramMB == null
						? undefined
						: model.vramMB < 1024
							? `${model.vramMB}MB`
							: `${(model.vramMB / 1024).toFixed(1)}GB`
			}))
		}
	];
}

export function resolveModelLabel(
	provider: domain.models.Provider | null | undefined,
	modelId: string | undefined
): string | undefined {
	if (!provider || !modelId) return modelId;
	if (provider === 'ollama' || provider === 'webllm') return modelId;
	const models = external.providers.catalog.PROVIDER_MODELS[provider];
	const entry = models.find((m) => m.id === modelId);
	return entry?.label ?? modelId;
}

function getActiveModelLabel(model: domain.models.ActiveModel | null): string | null {
	if (!model) return null;
	return resolveModelLabel(model.provider, model.modelId) ?? null;
}

export function getState(): State {
	const activeModel = state.providers.providerState.activeModel;
	return {
		activeModel,
		activeModelLabel: getActiveModelLabel(activeModel),
		contextLength: getContextLength(activeModel),
		vaultState: getVaultState(),
		providers: [...getRemoteProviders(), ...getLocalProviders()]
	};
}

export async function initialize() {
	await initProviders();

	await autoUnlockFromSession();

	await autoConnectOllama();

	const layout = external.persistence.getPersistedLayout();
	const savedModel = layout.activeModel as ActiveModel | undefined;
	if (savedModel) {
		const credState = getCredentialState(savedModel.provider);
		const ollamaReady =
			savedModel.provider !== 'ollama' ||
			state.providers.providerState.ollamaModels.includes(savedModel.modelId);
		if ((credState === 'ready' || credState === 'not-required') && ollamaReady) {
			state.providers.selectModel(savedModel);
		}
	}

	if (state.providers.providerState.activeModel?.provider === 'ollama') {
		await fetchOllamaContextLength();
	}
	syncContextLength(state.providers.providerState.activeModel);
}

export async function connect(provider: Provider, value?: string) {
	if (provider !== 'ollama') return;
	await connectOllama(value ?? state.providers.providerState.ollamaUrl);
	if (state.providers.providerState.activeModel?.provider === 'ollama') {
		await fetchOllamaContextLength();
	}
}

export async function selectModel(model: ActiveModel) {
	if (model.provider === 'webllm') {
		await loadWebLLMModel_(model.modelId);
		syncContextLength(state.providers.providerState.activeModel);
		workspace.setActiveModel(model);
		return;
	}

	state.providers.selectModel(model);
	workspace.setActiveModel(model);
	if (model.provider === 'ollama') {
		await fetchOllamaContextLength();
	} else {
		syncContextLength(model);
	}
}

export function setContextSize(size: ContextSize) {
	state.providers.providerState.webllmContextSize = size;
	syncContextLength(state.providers.providerState.activeModel);
}

export async function unlockCredentials(password: string) {
	await unlockVault(password);
}

export async function saveCredential(provider: string, credential: string, password: string) {
	if (domain.models.isKeyBasedProvider(provider as domain.models.Provider)) {
		await external.providers.validate.validateApiKey(
			provider as domain.models.KeyBasedProvider,
			credential
		);
	}
	await saveKey(provider, credential, password);
}

export async function lockAllCredentials() {
	await lockVault();
}

export function removeCredential(provider: string) {
	removeKey(provider);
}

export async function removeCachedModel(provider: Provider, modelId: string) {
	if (provider !== 'webllm') return;
	await deleteWebLLMCache(modelId);
	syncContextLength(state.providers.providerState.activeModel);
}

export async function clearCachedModels(provider: Provider) {
	if (provider !== 'webllm') return;
	await deleteAllWebLLMCaches();
	syncContextLength(state.providers.providerState.activeModel);
}

/**
 * Kick off the background download of the embedding library chunk so it's
 * warm by the time the user selects the Embedding Similarity context
 * strategy. Safe to call early at app boot — fails silently.
 */
export function primeEmbeddingLib(): void {
	void external.providers.embedding.primeEmbeddingLib().catch(() => undefined);
}

export function streamText(
	model: ActiveModel,
	history: domain.tree.Message[],
	signal: AbortSignal
) {
	return external.providers.stream.getProviderStream(model, history, signal, {
		apiKey: state.providers.providerState.apiKeys[model.provider] ?? '',
		ollamaUrl: state.providers.providerState.ollamaUrl
	});
}
