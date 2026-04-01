import { describe, expect, it } from 'vitest';
import { scoreBM25 } from '../bm25';

describe('scoreBM25', () => {
	it('returns empty array for empty items', () => {
		expect(scoreBM25('hello', [], (s) => s)).toEqual([]);
	});

	it('scores relevant items higher', () => {
		const items = ['the cat sat on the mat', 'the dog ran in the park', 'cats are great pets'];
		const result = scoreBM25('cat pets', items, (s) => s);
		expect(result[0]!.item).toBe('cats are great pets');
	});

	it('returns zero scores for unrelated query', () => {
		const items = ['hello world', 'foo bar'];
		const result = scoreBM25('zzzzz', items, (s) => s);
		expect(result.every((r) => r.score === 0)).toBe(true);
	});

	it('returns all items with zero score for empty query', () => {
		const items = ['a', 'b'];
		const result = scoreBM25('', items, (s) => s);
		expect(result).toHaveLength(2);
		expect(result.every((r) => r.score === 0)).toBe(true);
	});

	it('sorts by score descending', () => {
		const items = ['apple banana', 'apple', 'banana cherry'];
		const result = scoreBM25('apple', items, (s) => s);
		for (let i = 1; i < result.length; i++) {
			expect(result[i - 1]!.score).toBeGreaterThanOrEqual(result[i]!.score);
		}
	});

	it('works with custom getText', () => {
		const items = [{ text: 'hello world' }, { text: 'goodbye world' }];
		const result = scoreBM25('hello', items, (item) => item.text);
		expect(result[0]!.item.text).toBe('hello world');
	});
});
