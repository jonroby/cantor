import { describe, expect, it } from 'vitest';

import {
	CLAUDE_MODELS,
	KEY_BASED_PROVIDERS,
	LOCAL_PROVIDERS,
	PROVIDER_CONFIG,
	PROVIDER_MODELS,
	PROVIDERS,
	getModelContextLength,
	getProviderForModelId,
	isKeyBasedProvider,
	type ActiveModel,
	type KeyBasedActiveModel,
	type KeyBasedProvider,
	type LocalActiveModel,
	type Provider
} from '.';
import { PROVIDER_LOGOS } from './logos';

describe('models', () => {
	it('defines providers as local plus key-based providers', () => {
		expect(PROVIDERS).toEqual([...LOCAL_PROVIDERS, ...KEY_BASED_PROVIDERS]);
	});

	it('keeps provider config and models aligned for every key-based provider', () => {
		for (const provider of KEY_BASED_PROVIDERS) {
			expect(PROVIDER_CONFIG[provider]).toBeDefined();
			expect(PROVIDER_MODELS[provider].length).toBeGreaterThan(0);
		}
	});

	it('exports claude models as an alias of the claude provider list', () => {
		expect(CLAUDE_MODELS).toBe(PROVIDER_MODELS.claude);
	});

	it('identifies key-based providers precisely', () => {
		for (const provider of KEY_BASED_PROVIDERS) {
			expect(isKeyBasedProvider(provider)).toBe(true);
		}

		for (const provider of LOCAL_PROVIDERS) {
			expect(isKeyBasedProvider(provider)).toBe(false);
		}
	});

	it('returns model context length for known key-based models', () => {
		expect(getModelContextLength('openai', 'gpt-4o')).toBe(128_000);
		expect(getModelContextLength('claude', 'claude-haiku-4-5')).toBe(200_000);
	});

	it('returns null for unknown models or local providers', () => {
		expect(getModelContextLength('openai', 'missing-model')).toBeNull();
		expect(getModelContextLength('ollama', 'anything')).toBeNull();
		expect(getModelContextLength('webllm', 'anything')).toBeNull();
	});

	it('reverse-lookups the provider for every declared key-based model', () => {
		for (const provider of KEY_BASED_PROVIDERS) {
			for (const model of PROVIDER_MODELS[provider]) {
				expect(getProviderForModelId(model.id)).toBe(provider);
			}
		}
	});

	it('returns null for unknown model ids', () => {
		expect(getProviderForModelId('missing-model')).toBeNull();
	});

	it('narrows getProviderForModelId to KeyBasedProvider', () => {
		const result = getProviderForModelId('gpt-4o');
		expect(result).toBe('openai');
		// Type-level check: result is KeyBasedProvider | null, not Provider | null
		const _: KeyBasedProvider | null = result;
		expect(_).toBeDefined();
	});

	it('ActiveModel discriminates between key-based and local variants', () => {
		const keyBased: KeyBasedActiveModel = { provider: 'claude', modelId: 'claude-opus-4-6' };
		const local: LocalActiveModel = { provider: 'ollama', modelId: 'llama3' };
		const models: ActiveModel[] = [keyBased, local];

		expect(models).toHaveLength(2);
		expect(isKeyBasedProvider(models[0]!.provider)).toBe(true);
		expect(isKeyBasedProvider(models[1]!.provider)).toBe(false);
	});

	it('defines a logo for every provider', () => {
		for (const provider of PROVIDERS satisfies readonly Provider[]) {
			expect(PROVIDER_LOGOS[provider]).toBeTruthy();
		}
	});
});
