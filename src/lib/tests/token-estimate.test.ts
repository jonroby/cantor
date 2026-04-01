import { describe, expect, it } from 'vitest';
import { estimateTokens } from '../token-estimate';

describe('estimateTokens', () => {
	it('estimates based on chars / 4', () => {
		expect(estimateTokens('hello world')).toBe(3); // 11 chars → ceil(11/4) = 3
	});

	it('returns 0 for empty string', () => {
		expect(estimateTokens('')).toBe(0);
	});

	it('rounds up', () => {
		expect(estimateTokens('hi')).toBe(1); // 2 chars → ceil(2/4) = 1
	});
});
