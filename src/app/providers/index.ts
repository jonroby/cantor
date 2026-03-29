import * as domain from '@/domain';
import * as external from '@/external';
import * as lib from '@/lib';
import * as state from '@/state';
import {
	autoConnectOllama,
	connectOllama,
	deleteAllWebLLMCaches,
	deleteWebLLMCache,
	fetchOllamaContextLength,
	forgetKey,
	loadWebLLMModel_,
	saveKey,
	unlockKeys
} from './commands';
import { initProviders } from './queries';
import type { Provider, ActiveModel, ContextSize, State } from './types';

export type * from './types';

function providerName(provider: domain.models.Provider): string {
	if (provider === 'ollama') return 'Ollama';
	if (provider === 'webllm') return 'WebLLM';
	return external.providers.catalog.PROVIDER_CONFIG[provider].name;
}

function getCredentialState(provider: domain.models.Provider) {
	if (!domain.models.isKeyBasedProvider(provider)) return 'not-required' as const;
	if (state.providers.providerState.apiKeys[provider]) return 'ready' as const;
	if (state.providers.providerState.vaultProviders.includes(provider)) return 'locked' as const;
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
			enabled: provider === 'claude',
			note: provider === 'claude' ? undefined : 'Soon'
		}))
	}));
}

function getLocalProviders(): State['providers'] {
	return [
		{
			id: 'ollama',
			name: 'Ollama',
			kind: 'local' as const,
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

export function getState(): State {
	return {
		activeModel: state.providers.providerState.activeModel,
		contextLength: getContextLength(state.providers.providerState.activeModel),
		providers: [...getRemoteProviders(), ...getLocalProviders()]
	};
}

export async function initialize() {
	await initProviders();
	autoConnectOllama();
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
		return;
	}

	state.providers.selectModel(model);
	syncContextLength(model);
	if (model.provider === 'ollama') {
		await fetchOllamaContextLength();
	}
}

export function setContextSize(size: ContextSize) {
	state.providers.providerState.webllmContextSize = size;
	syncContextLength(state.providers.providerState.activeModel);
}

export async function unlockCredentials(password: string) {
	await unlockKeys(password);
}

export async function saveCredential(provider: string, credential: string, password: string) {
	await saveKey(provider, credential, password);
}

export function clearCredential(provider: string) {
	forgetKey(provider);
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

export function streamText(
	model: ActiveModel,
	history: domain.tree.Message[],
	signal: AbortSignal
) {
	return external.providers.stream.getProviderStream(model, history, signal);
}
