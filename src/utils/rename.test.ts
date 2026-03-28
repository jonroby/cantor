import { describe, expect, it } from 'vitest';
import { renameWithDedup } from './rename';

describe('renameWithDedup', () => {
	it('returns the name as-is when no conflict', () => {
		const result = renameWithDedup('Foo', () => true);
		expect(result).toBe('Foo');
	});

	it('returns null for empty input', () => {
		expect(renameWithDedup('', () => true)).toBeNull();
		expect(renameWithDedup('   ', () => true)).toBeNull();
	});

	it('trims whitespace', () => {
		const result = renameWithDedup('  Foo  ', () => true);
		expect(result).toBe('Foo');
	});

	it('increments from 1 when the name conflicts', () => {
		const existing = new Set(['Foo']);
		const result = renameWithDedup('Foo', (c) => {
			if (existing.has(c)) return false;
			existing.add(c);
			return true;
		});
		expect(result).toBe('Foo 1');
	});

	it('skips existing numbered names', () => {
		const existing = new Set(['Foo', 'Foo 1', 'Foo 2']);
		const result = renameWithDedup('Foo', (c) => {
			if (existing.has(c)) return false;
			existing.add(c);
			return true;
		});
		expect(result).toBe('Foo 3');
	});

	it('handles multiple duplicates in sequence', () => {
		const existing = new Set<string>();
		const tryRename = (c: string) => {
			if (existing.has(c)) return false;
			existing.add(c);
			return true;
		};

		expect(renameWithDedup('Chat', tryRename)).toBe('Chat');
		expect(renameWithDedup('Chat', tryRename)).toBe('Chat 1');
		expect(renameWithDedup('Chat', tryRename)).toBe('Chat 2');
		expect(renameWithDedup('Chat', tryRename)).toBe('Chat 3');
	});
});
