import * as domain from '@/domain';
import * as lib from '@/lib';
import * as external from '@/external';
import * as state from '@/state';
import * as logos from './logos';

export * from './commands';
export * from './queries';

export const PROVIDER_MODELS = external.providers.catalog.PROVIDER_MODELS;
export const PROVIDER_CONFIG = external.providers.catalog.PROVIDER_CONFIG;
export const KEY_BASED_PROVIDERS = domain.models.KEY_BASED_PROVIDERS;
export const PROVIDER_LOGOS = logos.PROVIDER_LOGOS;
export const WEBLLM_CONTEXT_OPTIONS = lib.providerDefaults.WEBLLM_CONTEXT_OPTIONS;
export const getState = () => state.providers.providerState;
export const selectModel = state.providers.selectModel;
export const updateContextLength = state.providers.updateContextLength;
export const getProviderStream = external.providers.stream.getProviderStream;
export function setWebLLMContextSize(size: state.providers.WebLLMContextSize) {
	state.providers.providerState.webllmContextSize = size;
}

export type Provider = domain.models.Provider;
export type ActiveModel = domain.models.ActiveModel;
export type OllamaStatus = state.providers.OllamaStatus;
export type WebLLMStatus = state.providers.WebLLMStatus;
export type WebLLMModelEntry = state.providers.WebLLMModelEntry;
export type WebLLMContextSize = state.providers.WebLLMContextSize;
