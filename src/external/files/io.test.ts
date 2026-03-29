import { describe, expect, it } from 'vitest';
import { findRootId, deduplicateName, validateChatUpload } from './io';
import * as domain from '@/domain';

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildValidUploadData() {
	let tree = domain.tree.buildEmptyTree();
	const r1 = domain.tree.addExchangeResult(tree, 'unused', 'hello', 'claude-sonnet-4-6', 'claude');
	tree = { rootId: r1.rootId, exchanges: r1.exchanges };
	const exchanges = domain.tree.updateExchangeResponse(tree.exchanges, r1.id, 'response');
	return {
		id: 'chat-1',
		name: 'Test Chat',
		exchanges,
		activeExchangeId: r1.id
	};
}

// ── findRootId ───────────────────────────────────────────────────────────────

describe('findRootId', () => {
	it('returns the id of the exchange with null parentId', () => {
		const data = buildValidUploadData();
		expect(findRootId(data.exchanges)).not.toBeNull();
	});

	it('returns null for empty exchanges', () => {
		expect(findRootId({})).toBeNull();
	});

	it('returns null when no exchange has null parentId', () => {
		const exchanges: domain.tree.ExchangeMap = {
			a: {
				id: 'a',
				parentId: 'b',
				childIds: [],
				prompt: { text: 'x', tokenCount: 0 },
				response: null,
				model: 'm',
				provider: 'claude',
				createdAt: 0
			}
		};
		expect(findRootId(exchanges)).toBeNull();
	});
});

// ── deduplicateName ──────────────────────────────────────────────────────────

describe('deduplicateName', () => {
	it('returns the name unchanged when no conflict', () => {
		expect(deduplicateName('file.md', ['other.md'])).toBe('file.md');
	});

	it('returns the name unchanged for empty list', () => {
		expect(deduplicateName('file.md', [])).toBe('file.md');
	});

	it('appends (1) on first conflict', () => {
		expect(deduplicateName('file.md', ['file.md'])).toBe('file (1).md');
	});

	it('increments the counter past existing duplicates', () => {
		expect(deduplicateName('file.md', ['file.md', 'file (1).md'])).toBe('file (2).md');
	});

	it('handles names without extensions', () => {
		expect(deduplicateName('readme', ['readme'])).toBe('readme (1)');
	});

	it('handles names with multiple dots', () => {
		expect(deduplicateName('my.file.txt', ['my.file.txt'])).toBe('my.file (1).txt');
	});

	it('handles deep conflict chains', () => {
		const existing = ['doc.md', 'doc (1).md', 'doc (2).md', 'doc (3).md'];
		expect(deduplicateName('doc.md', existing)).toBe('doc (4).md');
	});
});

// ── validateChatUpload ───────────────────────────────────────────────────────

describe('validateChatUpload', () => {
	it('accepts a valid chat object', () => {
		const data = buildValidUploadData();
		const chat = validateChatUpload(data);
		expect(chat.id).toBe('chat-1');
		expect(chat.name).toBe('Test Chat');
		expect(chat.rootId).not.toBeNull();
		expect(Object.keys(chat.exchanges).length).toBeGreaterThan(0);
	});

	it('sets activeExchangeId from data when provided', () => {
		const data = buildValidUploadData();
		const chat = validateChatUpload(data);
		expect(chat.activeExchangeId).toBe(data.activeExchangeId);
	});

	it('computes activeExchangeId via getMainChatTail when not provided', () => {
		const data = buildValidUploadData();
		const { activeExchangeId: _, ...withoutActive } = data;
		const chat = validateChatUpload(withoutActive);
		expect(chat.activeExchangeId).not.toBeNull();
	});

	it('supports legacy roots[] format', () => {
		const data = buildValidUploadData();
		const legacy = {
			id: 'legacy-1',
			name: 'Legacy',
			roots: [data.exchanges],
			activeRootIndex: 0
		};
		const chat = validateChatUpload(legacy);
		expect(chat.id).toBe('legacy-1');
		expect(Object.keys(chat.exchanges).length).toBeGreaterThan(0);
	});

	it('throws for non-object input', () => {
		expect(() => validateChatUpload(null)).toThrow('Upload must be a JSON object');
		expect(() => validateChatUpload('string')).toThrow('Upload must be a JSON object');
		expect(() => validateChatUpload([])).toThrow('Upload must be a JSON object');
	});

	it('throws for missing id', () => {
		expect(() => validateChatUpload({ name: 'x', exchanges: {} })).toThrow('missing a valid "id"');
	});

	it('throws for missing name', () => {
		expect(() => validateChatUpload({ id: 'x', exchanges: {} })).toThrow('missing a valid "name"');
	});

	it('throws for missing exchanges', () => {
		expect(() => validateChatUpload({ id: 'x', name: 'y' })).toThrow(
			'Chat must have an "exchanges" map'
		);
	});

	it('throws for empty exchanges', () => {
		expect(() => validateChatUpload({ id: 'x', name: 'y', exchanges: {} })).toThrow(
			'Exchanges map is empty'
		);
	});

	it('throws for exchange missing id field', () => {
		expect(() =>
			validateChatUpload({
				id: 'x',
				name: 'y',
				exchanges: { a: { prompt: { text: 'hi', tokenCount: 0 } } }
			})
		).toThrow('missing an "id"');
	});

	it('throws for exchange missing prompt', () => {
		expect(() =>
			validateChatUpload({
				id: 'x',
				name: 'y',
				exchanges: { a: { id: 'a' } }
			})
		).toThrow('missing a "prompt"');
	});

	it('throws for invalid exchange value', () => {
		expect(() =>
			validateChatUpload({
				id: 'x',
				name: 'y',
				exchanges: { a: null }
			})
		).toThrow('not a valid object');
	});

	it('throws for structurally invalid tree (broken parent/child links)', () => {
		expect(() =>
			validateChatUpload({
				id: 'x',
				name: 'y',
				exchanges: {
					a: {
						id: 'a',
						parentId: null,
						childIds: ['b'],
						prompt: { text: 'hi', tokenCount: 0 },
						response: null,
						model: 'm',
						provider: 'claude',
						createdAt: 0
					}
				}
			})
		).toThrow();
	});
});
