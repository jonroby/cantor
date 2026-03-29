import * as external from '@/external';
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as domain from '@/domain';
import { PROVIDER_LOGOS } from '../logos';

describe('models', () => {
	it('declares unique provider ids with no overlap between local and key-based providers', () => {
		expect(new Set(domain.models.PROVIDERS).size).toBe(domain.models.PROVIDERS.length);
		expect(
			domain.models.LOCAL_PROVIDERS.filter((provider) =>
				domain.models.KEY_BASED_PROVIDERS.includes(provider as never)
			)
		).toEqual([]);
	});

	it('defines usable config and at least one model for every key-based provider', () => {
		for (const provider of domain.models.KEY_BASED_PROVIDERS) {
			expect(
				() => new URL(external.providers.catalog.PROVIDER_CONFIG[provider].baseUrl)
			).not.toThrow();
			expect(
				external.providers.catalog.PROVIDER_CONFIG[provider].name.trim().length
			).toBeGreaterThan(0);
			expect(
				external.providers.catalog.PROVIDER_CONFIG[provider].keyPlaceholder.trim().length
			).toBeGreaterThan(0);
			expect(external.providers.catalog.PROVIDER_MODELS[provider].length).toBeGreaterThan(0);
		}
	});

	it('keeps Claude models in sync with the provider registry', () => {
		expect(external.providers.catalog.CLAUDE_MODELS).toEqual(
			external.providers.catalog.PROVIDER_MODELS.claude
		);
	});

	it('identifies key-based providers precisely', () => {
		for (const provider of domain.models.KEY_BASED_PROVIDERS) {
			expect(domain.models.isKeyBasedProvider(provider)).toBe(true);
		}

		for (const provider of domain.models.LOCAL_PROVIDERS) {
			expect(domain.models.isKeyBasedProvider(provider)).toBe(false);
		}
	});

	it('returns model context length for known key-based models', () => {
		expect(external.providers.catalog.getModelContextLength('openai', 'gpt-4o')).toBe(128_000);
		expect(external.providers.catalog.getModelContextLength('claude', 'claude-haiku-4-5')).toBe(
			200_000
		);
	});

	it('returns null for unknown models or local providers', () => {
		expect(external.providers.catalog.getModelContextLength('openai', 'missing-model')).toBeNull();
		expect(external.providers.catalog.getModelContextLength('ollama', 'anything')).toBeNull();
		expect(external.providers.catalog.getModelContextLength('webllm', 'anything')).toBeNull();
	});

	it('reverse-lookups the provider for every declared key-based model', () => {
		for (const provider of domain.models.KEY_BASED_PROVIDERS) {
			for (const model of external.providers.catalog.PROVIDER_MODELS[provider]) {
				expect(external.providers.catalog.getProviderForModelId(model.id)).toBe(provider);
			}
		}
	});

	it('returns null for unknown model ids', () => {
		expect(external.providers.catalog.getProviderForModelId('missing-model')).toBeNull();
	});

	it('declares globally unique key-based model ids for reverse lookup', () => {
		const ids = domain.models.KEY_BASED_PROVIDERS.flatMap((provider) =>
			external.providers.catalog.PROVIDER_MODELS[provider].map((model) => model.id)
		);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('types getProviderForModelId as KeyBasedProvider | null', () => {
		const result = external.providers.catalog.getProviderForModelId('gpt-4o');
		expect(result).toBe('openai');
		expectTypeOf(result).toEqualTypeOf<domain.models.KeyBasedProvider | null>();
	});

	it('models ActiveModel as a union of key-based and local variants', () => {
		const keyBased: domain.models.KeyBasedActiveModel = {
			provider: 'claude',
			modelId: 'claude-opus-4-6'
		};
		const local: domain.models.LocalActiveModel = { provider: 'ollama', modelId: 'llama3' };
		const models: domain.models.ActiveModel[] = [keyBased, local];

		expect(models).toHaveLength(2);
		expect(domain.models.isKeyBasedProvider(models[0]!.provider)).toBe(true);
		expect(domain.models.isKeyBasedProvider(models[1]!.provider)).toBe(false);
		expectTypeOf<domain.models.KeyBasedActiveModel>().toMatchTypeOf<domain.models.ActiveModel>();
		expectTypeOf<domain.models.LocalActiveModel>().toMatchTypeOf<domain.models.ActiveModel>();
	});

	it('defines a logo for every provider', () => {
		for (const provider of domain.models.PROVIDERS satisfies readonly domain.models.Provider[]) {
			expect(PROVIDER_LOGOS[provider]).toBeTruthy();
		}
	});
});
