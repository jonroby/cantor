import { beforeEach, describe, expect, it, vi } from 'vitest';
import { selectExchanges, type ContextBudget } from '../context';
import type * as domain from '@/domain';
import * as external from '@/external';

function makeExchange(
	id: string,
	promptText: string,
	responseText: string,
	promptTokens = 0,
	responseTokens = 0
): domain.tree.Exchange {
	return {
		id,
		parentId: null,
		childIds: [],
		prompt: { text: promptText, tokenCount: promptTokens },
		response: { text: responseText, tokenCount: responseTokens },
		model: 'test-model',
		provider: 'claude',
		createdAt: Date.now()
	};
}

describe('selectExchanges', () => {
	const path = [
		makeExchange('a', 'first message', 'first reply', 100, 100),
		makeExchange('b', 'second message', 'second reply', 100, 100),
		makeExchange('c', 'third message', 'third reply', 100, 100)
	];

	it('full strategy returns all exchanges', async () => {
		const budget: ContextBudget = { strategy: 'full', contextLength: 1000, currentPrompt: 'hi' };
		expect(await selectExchanges(path, budget)).toEqual(path);
	});

	it('full strategy with null contextLength returns all', async () => {
		const budget: ContextBudget = { strategy: 'lru', contextLength: null, currentPrompt: 'hi' };
		expect(await selectExchanges(path, budget)).toEqual(path);
	});

	it('lru with tight budget returns only most recent', async () => {
		const budget: ContextBudget = { strategy: 'lru', contextLength: 500, currentPrompt: 'hi' };
		const result = await selectExchanges(path, budget);
		expect(result).toHaveLength(1);
		expect(result[0]!.id).toBe('c');
	});

	it('lru with large budget returns all', async () => {
		const budget: ContextBudget = { strategy: 'lru', contextLength: 10000, currentPrompt: 'hi' };
		const result = await selectExchanges(path, budget);
		expect(result).toHaveLength(3);
	});

	it('bm25 always includes the last exchange', async () => {
		const budget: ContextBudget = {
			strategy: 'bm25',
			contextLength: 500,
			currentPrompt: 'first'
		};
		const result = await selectExchanges(path, budget);
		expect(result[result.length - 1]!.id).toBe('c');
	});

	it('bm25 selects relevant exchanges within budget', async () => {
		const relevantPath = [
			makeExchange('a', 'the weather is nice today', 'indeed it is', 100, 100),
			makeExchange('b', 'tell me about cats and dogs', 'cats are great', 100, 100),
			makeExchange('c', 'what is the current prompt', 'response here', 100, 100)
		];
		const budget: ContextBudget = {
			strategy: 'bm25',
			contextLength: 700,
			currentPrompt: 'cats'
		};
		const result = await selectExchanges(relevantPath, budget);
		expect(result.some((ex) => ex.id === 'b')).toBe(true);
		expect(result.some((ex) => ex.id === 'c')).toBe(true);
	});

	it('bm25 preserves path order', async () => {
		const budget: ContextBudget = {
			strategy: 'bm25',
			contextLength: 10000,
			currentPrompt: 'message'
		};
		const result = await selectExchanges(path, budget);
		const ids = result.map((ex) => ex.id);
		expect(ids).toEqual(['a', 'b', 'c']);
	});

	it('returns empty array for empty path', async () => {
		const budget: ContextBudget = { strategy: 'lru', contextLength: 1000, currentPrompt: 'hi' };
		expect(await selectExchanges([], budget)).toEqual([]);
	});

	it('returns at least last exchange when budget is very tight', async () => {
		const budget: ContextBudget = { strategy: 'lru', contextLength: 1, currentPrompt: 'hi' };
		const result = await selectExchanges(path, budget);
		expect(result).toHaveLength(1);
		expect(result[0]!.id).toBe('c');
	});

	it('uses estimated tokens when tokenCount is 0', async () => {
		const noTokenPath = [
			makeExchange('a', 'x'.repeat(400), 'y'.repeat(400), 0, 0),
			makeExchange('b', 'small', 'small', 0, 0)
		];
		const budget: ContextBudget = { strategy: 'lru', contextLength: 300, currentPrompt: 'hi' };
		const result = await selectExchanges(noTokenPath, budget);
		expect(result).toHaveLength(2);
	});
});

describe('selectExchanges - embedding strategy', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('always includes the last exchange', async () => {
		const embedPath = [
			makeExchange('a', 'apples are red', 'indeed', 100, 100),
			makeExchange('b', 'bananas are yellow', 'correct', 100, 100),
			makeExchange('c', 'what color is grass', 'green', 100, 100)
		];
		vi.spyOn(external.providers.embedding, 'getEmbeddingModelName').mockReturnValue('test-model');
		vi.spyOn(external.persistence, 'getEmbeddingsForExchanges').mockResolvedValue(new Map());
		// One vector per candidate + one for the query.
		vi.spyOn(external.providers.embedding, 'embed').mockResolvedValue([
			new Float32Array([1, 0, 0]),
			new Float32Array([0, 1, 0]),
			new Float32Array([1, 0, 0])
		]);
		vi.spyOn(external.persistence, 'putEmbedding').mockResolvedValue(undefined);

		const budget: ContextBudget = {
			strategy: 'embedding',
			contextLength: 10000,
			currentPrompt: 'red'
		};
		const result = await selectExchanges(embedPath, budget);
		expect(result[result.length - 1]!.id).toBe('c');
	});

	it('ranks semantically closer exchanges first under a tight budget', async () => {
		const embedPath = [
			makeExchange('a', 'about apples', 'response', 100, 100),
			makeExchange('b', 'about bananas', 'response', 100, 100),
			makeExchange('c', 'current prompt', 'response', 100, 100)
		];
		vi.spyOn(external.providers.embedding, 'getEmbeddingModelName').mockReturnValue('test-model');
		vi.spyOn(external.persistence, 'getEmbeddingsForExchanges').mockResolvedValue(new Map());
		// 'a' is orthogonal, 'b' matches query direction; query is last.
		vi.spyOn(external.providers.embedding, 'embed').mockResolvedValue([
			new Float32Array([1, 0]), // a
			new Float32Array([0, 1]), // b
			new Float32Array([0, 1]) // query
		]);
		vi.spyOn(external.persistence, 'putEmbedding').mockResolvedValue(undefined);

		// Budget 700: 25% reserve = 175, available ~524. Last = 200, remaining 324.
		// Room for exactly one candidate (200 tokens each).
		const budget: ContextBudget = {
			strategy: 'embedding',
			contextLength: 700,
			currentPrompt: 'bananas'
		};
		const result = await selectExchanges(embedPath, budget);
		expect(result.map((ex) => ex.id)).toEqual(['b', 'c']);
	});

	it('reuses cached embeddings and only embeds missing ones + query', async () => {
		const embedPath = [
			makeExchange('a', 'cached exchange', 'response', 100, 100),
			makeExchange('b', 'needs embedding', 'response', 100, 100),
			makeExchange('c', 'last', 'response', 100, 100)
		];
		const cached = new Map<string, Float32Array>([['a', new Float32Array([1, 0])]]);
		vi.spyOn(external.providers.embedding, 'getEmbeddingModelName').mockReturnValue('test-model');
		vi.spyOn(external.persistence, 'getEmbeddingsForExchanges').mockResolvedValue(cached);
		const embedSpy = vi
			.spyOn(external.providers.embedding, 'embed')
			.mockResolvedValue([new Float32Array([0, 1]), new Float32Array([1, 0])]);
		vi.spyOn(external.persistence, 'putEmbedding').mockResolvedValue(undefined);

		const budget: ContextBudget = {
			strategy: 'embedding',
			contextLength: 10000,
			currentPrompt: 'anything'
		};
		await selectExchanges(embedPath, budget);
		// Only 'b' (missing) and the query get embedded — 'a' was cached.
		expect(embedSpy).toHaveBeenCalledOnce();
		const texts = embedSpy.mock.calls[0]![0];
		expect(texts).toHaveLength(2);
	});

	it('falls back to BM25 when embedding throws', async () => {
		const embedPath = [
			makeExchange('a', 'about apples', 'response', 100, 100),
			makeExchange('b', 'about bananas', 'response', 100, 100),
			makeExchange('c', 'last', 'response', 100, 100)
		];
		vi.spyOn(external.providers.embedding, 'getEmbeddingModelName').mockReturnValue('test-model');
		vi.spyOn(external.persistence, 'getEmbeddingsForExchanges').mockResolvedValue(new Map());
		vi.spyOn(external.providers.embedding, 'embed').mockRejectedValue(new Error('boom'));
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

		const budget: ContextBudget = {
			strategy: 'embedding',
			contextLength: 10000,
			currentPrompt: 'bananas'
		};
		const result = await selectExchanges(embedPath, budget);
		// BM25 fallback always includes the tail.
		expect(result[result.length - 1]!.id).toBe('c');
		expect(warn).toHaveBeenCalled();
	});
});
