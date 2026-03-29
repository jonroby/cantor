export const LOCAL_PROVIDERS = ['ollama', 'webllm'] as const;
export const KEY_BASED_PROVIDERS = [
	'claude',
	'openai',
	'gemini',
	'moonshot',
	'qwen',
	'deepseek',
	'mistral',
	'groq'
] as const;
export const PROVIDERS = [...LOCAL_PROVIDERS, ...KEY_BASED_PROVIDERS] as const;

export type Provider = (typeof PROVIDERS)[number];
export type LocalProvider = (typeof LOCAL_PROVIDERS)[number];
export type KeyBasedProvider = (typeof KEY_BASED_PROVIDERS)[number];

export interface KeyBasedActiveModel {
	provider: KeyBasedProvider;
	modelId: string;
}

export interface LocalActiveModel {
	provider: LocalProvider;
	modelId: string;
}

export type ActiveModel = KeyBasedActiveModel | LocalActiveModel;

export type OllamaStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ProviderModelEntry {
	id: string;
	label: string;
	contextLength: number;
}

export function isKeyBasedProvider(provider: Provider): provider is KeyBasedProvider {
	return KEY_BASED_PROVIDERS.includes(provider as KeyBasedProvider);
}
