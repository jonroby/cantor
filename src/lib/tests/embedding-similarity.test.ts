import { describe, expect, it } from 'vitest';
import { cosine, scoreSimilarity } from '../embedding-similarity';

function vec(values: number[]): Float32Array {
	return new Float32Array(values);
}

describe('cosine', () => {
	it('returns 1 for identical vectors', () => {
		expect(cosine(vec([1, 0, 0]), vec([1, 0, 0]))).toBeCloseTo(1);
	});

	it('returns 0 for orthogonal vectors', () => {
		expect(cosine(vec([1, 0]), vec([0, 1]))).toBeCloseTo(0);
	});

	it('returns 0 when either vector is zero', () => {
		expect(cosine(vec([0, 0]), vec([1, 1]))).toBe(0);
	});

	it('returns 0 for mismatched lengths', () => {
		expect(cosine(vec([1, 0]), vec([1, 0, 0]))).toBe(0);
	});
});

describe('scoreSimilarity', () => {
	it('returns empty array for empty items', () => {
		expect(scoreSimilarity(vec([1, 0]), [], () => vec([1, 0]))).toEqual([]);
	});

	it('ranks more similar items higher', () => {
		const items = [
			{ id: 'a', v: vec([1, 0, 0]) },
			{ id: 'b', v: vec([0.9, 0.1, 0]) },
			{ id: 'c', v: vec([0, 1, 0]) }
		];
		const result = scoreSimilarity(vec([1, 0, 0]), items, (x) => x.v);
		expect(result[0]!.item.id).toBe('a');
		expect(result[1]!.item.id).toBe('b');
		expect(result[2]!.item.id).toBe('c');
	});

	it('excludes items with null embeddings', () => {
		const items = [
			{ id: 'a', v: vec([1, 0]) },
			{ id: 'b', v: null as Float32Array | null }
		];
		const result = scoreSimilarity(vec([1, 0]), items, (x) => x.v);
		expect(result).toHaveLength(1);
		expect(result[0]!.item.id).toBe('a');
	});

	it('sorts by score descending', () => {
		const items = [vec([0, 1]), vec([1, 0]), vec([0.5, 0.5])];
		const result = scoreSimilarity(vec([1, 0]), items, (v) => v);
		for (let i = 1; i < result.length; i++) {
			expect(result[i - 1]!.score).toBeGreaterThanOrEqual(result[i]!.score);
		}
	});
});
