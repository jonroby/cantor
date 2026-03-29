import * as domain from '@/domain';
import * as lib from '@/lib';
import * as external from '@/external';
import * as logos from './logos';

export * from './commands';
export * from './queries';
export { initProviders as init } from './queries';

export const PROVIDER_MODELS = external.providers.catalog.PROVIDER_MODELS;
export const PROVIDER_CONFIG = external.providers.catalog.PROVIDER_CONFIG;
export const KEY_BASED_PROVIDERS = domain.models.KEY_BASED_PROVIDERS;
export const PROVIDER_LOGOS = logos.PROVIDER_LOGOS;
export const WEBLLM_CONTEXT_OPTIONS = lib.providerDefaults.WEBLLM_CONTEXT_OPTIONS;

export type Provider = domain.models.Provider;
export type ActiveModel = domain.models.ActiveModel;
