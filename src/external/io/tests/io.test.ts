import { describe, expect, it } from 'vitest';
import { validateChatUpload } from '../io';
import * as domain from '@/domain';

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildValidUploadData() {
	let tree = domain.tree.buildEmptyTree();
	const r1 = domain.tree.addExchange(tree, 'unused', 'hello', 'claude-sonnet-4-6', 'claude');
	tree = r1.tree;
	const exchanges = domain.tree.updateExchangeResponse(tree.exchanges, r1.id, 'response');
	return {
		id: 'chat-1',
		name: 'Test Chat',
		exchanges,
		activeExchangeId: r1.id
	};
}

// ── validateChatUpload ───────────────────────────────────────────────────────

describe('validateChatUpload', () => {
	it('accepts a valid chat object', () => {
		const data = buildValidUploadData();
		const chat = validateChatUpload(data);
		expect(chat.id).toBe('chat-1');
		expect(chat.name).toBe('Test Chat');
		expect(chat.tree.rootId).not.toBeNull();
		expect(Object.keys(chat.tree.exchanges).length).toBeGreaterThan(0);
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
