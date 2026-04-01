import { describe, expect, it } from 'vitest';
import { selectExchanges, type ContextBudget } from '../context';
import type * as domain from '@/domain';

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

	it('full strategy returns all exchanges', () => {
		const budget: ContextBudget = { strategy: 'full', contextLength: 1000, currentPrompt: 'hi' };
		expect(selectExchanges(path, budget)).toEqual(path);
	});

	it('full strategy with null contextLength returns all', () => {
		const budget: ContextBudget = { strategy: 'lru', contextLength: null, currentPrompt: 'hi' };
		expect(selectExchanges(path, budget)).toEqual(path);
	});

	it('lru with tight budget returns only most recent', () => {
		// budget: 500 total, 25% reserve = 375 available, minus prompt estimate ~1 = 374
		// each exchange is 200 tokens, so only 1 fits
		const budget: ContextBudget = { strategy: 'lru', contextLength: 500, currentPrompt: 'hi' };
		const result = selectExchanges(path, budget);
		expect(result).toHaveLength(1);
		expect(result[0]!.id).toBe('c');
	});

	it('lru with large budget returns all', () => {
		const budget: ContextBudget = { strategy: 'lru', contextLength: 10000, currentPrompt: 'hi' };
		const result = selectExchanges(path, budget);
		expect(result).toHaveLength(3);
	});

	it('bm25 always includes the last exchange', () => {
		const budget: ContextBudget = {
			strategy: 'bm25',
			contextLength: 500,
			currentPrompt: 'first'
		};
		const result = selectExchanges(path, budget);
		expect(result[result.length - 1]!.id).toBe('c');
	});

	it('bm25 selects relevant exchanges within budget', () => {
		const relevantPath = [
			makeExchange('a', 'the weather is nice today', 'indeed it is', 100, 100),
			makeExchange('b', 'tell me about cats and dogs', 'cats are great', 100, 100),
			makeExchange('c', 'what is the current prompt', 'response here', 100, 100)
		];
		// Budget allows 2 exchanges (last always included + 1 from candidates)
		const budget: ContextBudget = {
			strategy: 'bm25',
			contextLength: 700,
			currentPrompt: 'cats'
		};
		const result = selectExchanges(relevantPath, budget);
		expect(result.some((ex) => ex.id === 'b')).toBe(true);
		expect(result.some((ex) => ex.id === 'c')).toBe(true);
	});

	it('bm25 preserves path order', () => {
		const budget: ContextBudget = {
			strategy: 'bm25',
			contextLength: 10000,
			currentPrompt: 'message'
		};
		const result = selectExchanges(path, budget);
		const ids = result.map((ex) => ex.id);
		expect(ids).toEqual(['a', 'b', 'c']);
	});

	it('returns empty array for empty path', () => {
		const budget: ContextBudget = { strategy: 'lru', contextLength: 1000, currentPrompt: 'hi' };
		expect(selectExchanges([], budget)).toEqual([]);
	});

	it('returns at least last exchange when budget is very tight', () => {
		const budget: ContextBudget = { strategy: 'lru', contextLength: 1, currentPrompt: 'hi' };
		const result = selectExchanges(path, budget);
		expect(result).toHaveLength(1);
		expect(result[0]!.id).toBe('c');
	});

	it('uses estimated tokens when tokenCount is 0', () => {
		const noTokenPath = [
			makeExchange('a', 'x'.repeat(400), 'y'.repeat(400), 0, 0), // ~200 estimated tokens
			makeExchange('b', 'small', 'small', 0, 0) // ~3 estimated tokens
		];
		// Budget: 300 total, 75 reserve, ~1 for prompt = ~224 available
		// exchange 'a' costs ~200, exchange 'b' costs ~3
		// LRU: walk backward — 'b' fits (3), then 'a' fits (203 < 224)
		const budget: ContextBudget = { strategy: 'lru', contextLength: 300, currentPrompt: 'hi' };
		const result = selectExchanges(noTokenPath, budget);
		expect(result).toHaveLength(2);
	});
});
