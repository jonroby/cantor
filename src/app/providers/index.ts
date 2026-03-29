import * as domain from '@/domain';
import * as lib from '@/lib';

export * from './commands';
export * from './queries';
export { initProviders as init } from './queries';

export const PROVIDER_MODELS = domain.PROVIDER_MODELS;
export const PROVIDER_CONFIG = domain.PROVIDER_CONFIG;
export const KEY_BASED_PROVIDERS = domain.KEY_BASED_PROVIDERS;
export const PROVIDER_LOGOS = domain.PROVIDER_LOGOS;
export const WEBLLM_CONTEXT_OPTIONS = lib.WEBLLM_CONTEXT_OPTIONS;

export type Provider = domain.Provider;
export type ActiveModel = domain.ActiveModel;
