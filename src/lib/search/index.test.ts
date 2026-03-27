import { describe, expect, it } from 'vitest';

import { ROOT_ANCHOR_ID, type Chat, type ExchangeMap } from '@/domain/tree';

import { getDefaultItems, groupResults, searchChats } from '.';

function buildChat(
	id: string,
	name: string,
	exchanges: ExchangeMap,
	activeExchangeId: string | null = null
): Chat {
	return { id, name, exchanges, activeExchangeId };
}

function buildExchanges(entries: Array<{ id: string; prompt: string; response?: string }>): ExchangeMap {
	const exchanges: ExchangeMap = {
		[ROOT_ANCHOR_ID]: {
			id: ROOT_ANCHOR_ID,
			parentId: null,
			prompt: '',
			response: '',
			isAnchor: true,
			childIds: entries.map((entry) => entry.id)
		}
	};

	for (const [index, entry] of entries.entries()) {
		exchanges[entry.id] = {
			id: entry.id,
			parentId: ROOT_ANCHOR_ID,
			prompt: entry.prompt,
			response: entry.response ?? '',
			childIds: [],
			isAnchor: false,
			model: '',
			provider: ''
		};

		if (index > 0) {
			exchanges[entries[index - 1]!.id]!.childIds = [];
		}
	}

	return exchanges;
}

describe('search', () => {
	const chats = [
		buildChat(
			'chat-1',
			'Alpha',
			buildExchanges([
				{ id: 'a1', prompt: 'How do transformers use attention?', response: 'Attention maps tokens.' },
				{ id: 'a2', prompt: 'Explain embeddings', response: 'Embeddings are vectors.' }
			])
		),
		buildChat(
			'chat-2',
			'Beta',
			buildExchanges([
				{ id: 'b1', prompt: 'Attention heads specialize', response: 'Each head can focus differently.' },
				{ id: 'b2', prompt: '', response: 'empty prompt should not appear by default' }
			])
		)
	];

	it('returns no results for a blank query', () => {
		expect(searchChats(chats, '   ', [0, 1])).toEqual([]);
	});

	it('deduplicates chat indices before searching', () => {
		const results = searchChats(chats, 'attention', [0, 0, 1, 1]);
		expect(results.map((result) => result.exchangeId)).toEqual(['a1', 'b1']);
	});

	it('matches short queries by substring instead of trigram score', () => {
		const results = searchChats(chats, 've', [0]);
		expect(results.map((result) => result.exchangeId)).toContain('a2');
	});

	it('builds snippets from both prompt and response matches', () => {
		const results = searchChats(chats, 'attention', [0, 1]);
		const first = results[0];

		expect(first).toBeDefined();
		expect(first!.snippets.length).toBeGreaterThan(0);
		expect(first!.snippets.some((snippet) => snippet.text.toLowerCase().includes('attention'))).toBe(
			true
		);
	});

	it('adds ellipses when a snippet is extracted from the middle of long text', () => {
		const longText = `${'x'.repeat(100)} attention ${'y'.repeat(100)}`;
		const longChats = [
			buildChat(
				'chat-1',
				'Long',
				buildExchanges([{ id: 'l1', prompt: longText, response: '' }])
			)
		];

		const results = searchChats(longChats, 'attention', [0]);
		expect(results[0]!.snippets[0]!.text.startsWith('...')).toBe(true);
		expect(results[0]!.snippets[0]!.text.endsWith('...')).toBe(true);
	});

	it('extracts a snippet from the response when only the response matches exactly', () => {
		const responseChats = [
			buildChat(
				'chat-1',
				'Responses',
				buildExchanges([{ id: 'r1', prompt: 'totally unrelated', response: 'the exact phrase is here' }])
			)
		];

		const results = searchChats(responseChats, 'exact phrase', [0]);
		expect(results).toHaveLength(1);
		expect(results[0]!.snippets).toHaveLength(1);
		expect(results[0]!.snippets[0]!.text).toContain('exact phrase');
	});

	it('keeps fuzzy response matches even when no exact response snippet exists', () => {
		const responseChats = [
			buildChat(
				'chat-1',
				'Responses',
				buildExchanges([{ id: 'r1', prompt: 'totally unrelated', response: 'abce' }])
			)
		];

		const results = searchChats(responseChats, 'abcd', [0]);
		expect(results).toHaveLength(1);
		expect(results[0]!.exchangeId).toBe('r1');
		expect(results[0]!.snippets).toEqual([]);
	});

	it('returns fuzzy matches even when no exact snippet can be extracted', () => {
		const fuzzyChats = [
			buildChat(
				'chat-1',
				'Fuzzy',
				buildExchanges([{ id: 'f1', prompt: 'abce', response: '' }])
			)
		];

		const results = searchChats(fuzzyChats, 'abcd', [0]);
		expect(results).toHaveLength(1);
		expect(results[0]!.exchangeId).toBe('f1');
		expect(results[0]!.snippets).toEqual([]);
	});

	it('ignores anchor exchanges and missing chats', () => {
		const results = searchChats(chats, 'attention', [99]);
		expect(results).toEqual([]);
	});

	it('returns default items for the active chat only', () => {
		const results = getDefaultItems(chats, 1, false);
		expect(results.map((result) => result.exchangeId)).toEqual(['b1']);
	});

	it('returns default items across all chats and excludes blank prompts', () => {
		const results = getDefaultItems(chats, 0, true);
		expect(results.map((result) => result.exchangeId)).toEqual(['a1', 'a2', 'b1']);
	});

	it('returns one flat group when grouping is disabled', () => {
		const items = getDefaultItems(chats, 0, true);
		expect(groupResults(items, chats, 0, false, true)).toEqual([{ label: 'Exchanges', items }]);
	});

	it('groups results by chat and puts the active chat first', () => {
		const items = [
			{ exchangeId: 'b1', chatIndex: 1, prompt: 'Attention heads specialize', snippets: [] },
			{ exchangeId: 'a1', chatIndex: 0, prompt: 'How do transformers use attention?', snippets: [] }
		];

		expect(groupResults(items, chats, 1, true, true)).toEqual([
			{
				label: 'Beta (current)',
				items: [items[0]!]
			},
			{
				label: 'Alpha',
				items: [items[1]!]
			}
		]);
	});

	it('omits chats that have no grouped items', () => {
		const items = [{ exchangeId: 'a1', chatIndex: 0, prompt: 'How do transformers use attention?', snippets: [] }];

		expect(groupResults(items, chats, 0, true, true)).toEqual([
			{
				label: 'Alpha (current)',
				items
			}
		]);
	});

	it('uses a fallback label when a chat name is missing', () => {
		const unnamedChats = [buildChat('chat-1', '', buildExchanges([{ id: 'a1', prompt: 'hello' }]))];
		const items = [{ exchangeId: 'a1', chatIndex: 0, prompt: 'hello', snippets: [] }];

		expect(groupResults(items, unnamedChats, 0, true, true)).toEqual([
			{
				label: ' (current)',
				items
			}
		]);
	});

	it('falls back to natural chat order when the active chat index is invalid', () => {
		const items = [
			{ exchangeId: 'a1', chatIndex: 0, prompt: 'How do transformers use attention?', snippets: [] },
			{ exchangeId: 'b1', chatIndex: 1, prompt: 'Attention heads specialize', snippets: [] }
		];

		expect(groupResults(items, chats, 99, true, true)).toEqual([
			{
				label: 'Alpha',
				items: [items[0]!]
			},
			{
				label: 'Beta',
				items: [items[1]!]
			}
		]);
	});

	it('uses a generated fallback label when a grouped chat index is out of range', () => {
		const items = [{ exchangeId: 'ghost', chatIndex: 3, prompt: 'orphaned result', snippets: [] }];
		const sparseChats = [
			buildChat('chat-1', 'Alpha', buildExchanges([{ id: 'a1', prompt: 'hello' }])),
			buildChat('chat-2', 'Beta', buildExchanges([{ id: 'b1', prompt: 'world' }])),
			buildChat('chat-3', 'Gamma', buildExchanges([{ id: 'c1', prompt: '!' }]))
		];

		expect(groupResults(items, sparseChats, 99, true, true)).toEqual([]);

		const chatsWithHole = [
			undefined,
			buildChat('chat-2', 'Beta', buildExchanges([{ id: 'b1', prompt: 'world' }]))
		] as unknown as Chat[];
		const holeItems = [{ exchangeId: 'ghost', chatIndex: 0, prompt: 'orphaned result', snippets: [] }];

		expect(groupResults(holeItems, chatsWithHole, 0, true, true)).toEqual([
			{
				label: 'Chat 1 (current)',
				items: holeItems
			}
		]);
	});
});
