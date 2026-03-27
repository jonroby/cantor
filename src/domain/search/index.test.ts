import { describe, expect, it } from 'vitest';

import type { Chat, Exchange, ExchangeMap } from '@/domain/tree';

import { getDefaultItems, groupResults, searchChats } from '.';

const MODEL = 'claude-sonnet-4-6';
const PROVIDER = 'claude';

function makeExchange(
	id: string,
	parentId: string | null,
	prompt: string,
	response = '',
	childIds: string[] = []
): Exchange {
	return {
		id,
		parentId,
		childIds,
		prompt: { text: prompt, tokenCount: 0 },
		response: { text: response, tokenCount: 0 },
		model: MODEL,
		provider: PROVIDER,
		createdAt: 1
	};
}

function buildChat(
	id: string,
	name: string,
	exchanges: ExchangeMap,
	rootId: string,
	activeExchangeId: string | null = null
): Chat {
	return { id, name, rootId, exchanges, activeExchangeId };
}

function buildLinearExchanges(entries: Array<{ id: string; prompt: string; response?: string }>): {
	rootId: string;
	exchanges: ExchangeMap;
} {
	if (entries.length === 0) {
		throw new Error('Expected at least one exchange.');
	}

	const rootId = `root-${entries[0]!.id}`;
	const exchanges: ExchangeMap = {
		[rootId]: makeExchange(
			rootId,
			null,
			'',
			'',
			entries.map((entry, index) => (index === 0 ? entry.id : '')).filter(Boolean)
		)
	};

	for (const [index, entry] of entries.entries()) {
		const childIds = index < entries.length - 1 ? [entries[index + 1]!.id] : [];
		const parentId = index === 0 ? rootId : entries[index - 1]!.id;
		exchanges[entry.id] = makeExchange(
			entry.id,
			parentId,
			entry.prompt,
			entry.response ?? '',
			childIds
		);
	}

	return { rootId, exchanges };
}

describe('search', () => {
	const alphaTree = buildLinearExchanges([
		{ id: 'a1', prompt: 'How do transformers use attention?', response: 'Attention maps tokens.' },
		{ id: 'a2', prompt: 'Explain embeddings', response: 'Embeddings are vectors.' }
	]);
	const betaTree = buildLinearExchanges([
		{
			id: 'b1',
			prompt: 'Attention heads specialize',
			response: 'Each head can focus differently.'
		},
		{ id: 'b2', prompt: '', response: 'empty prompt should not appear by default' }
	]);
	const chats = [
		buildChat('chat-1', 'Alpha', alphaTree.exchanges, alphaTree.rootId),
		buildChat('chat-2', 'Beta', betaTree.exchanges, betaTree.rootId)
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
		expect(
			first!.snippets.some((snippet) => snippet.text.toLowerCase().includes('attention'))
		).toBe(true);
	});

	it('adds ellipses when a snippet is extracted from the middle of long text', () => {
		const longText = `${'x'.repeat(100)} attention ${'y'.repeat(100)}`;
		const longTree = buildLinearExchanges([{ id: 'l1', prompt: longText, response: '' }]);
		const longChats = [buildChat('chat-1', 'Long', longTree.exchanges, longTree.rootId)];

		const results = searchChats(longChats, 'attention', [0]);
		expect(results[0]!.snippets[0]!.text.startsWith('...')).toBe(true);
		expect(results[0]!.snippets[0]!.text.endsWith('...')).toBe(true);
	});

	it('extracts a snippet from the response when only the response matches exactly', () => {
		const responseTree = buildLinearExchanges([
			{ id: 'r1', prompt: 'totally unrelated', response: 'the exact phrase is here' }
		]);
		const responseChats = [
			buildChat('chat-1', 'Responses', responseTree.exchanges, responseTree.rootId)
		];

		const results = searchChats(responseChats, 'exact phrase', [0]);
		expect(results).toHaveLength(1);
		expect(results[0]!.snippets).toHaveLength(1);
		expect(results[0]!.snippets[0]!.text).toContain('exact phrase');
	});

	it('keeps fuzzy response matches even when no exact response snippet exists', () => {
		const responseTree = buildLinearExchanges([
			{ id: 'r1', prompt: 'totally unrelated', response: 'abce' }
		]);
		const responseChats = [
			buildChat('chat-1', 'Responses', responseTree.exchanges, responseTree.rootId)
		];

		const results = searchChats(responseChats, 'abcd', [0]);
		expect(results).toHaveLength(1);
		expect(results[0]!.exchangeId).toBe('r1');
		expect(results[0]!.snippets).toEqual([]);
	});

	it('returns fuzzy matches even when no exact snippet can be extracted', () => {
		const fuzzyTree = buildLinearExchanges([{ id: 'f1', prompt: 'abce', response: '' }]);
		const fuzzyChats = [buildChat('chat-1', 'Fuzzy', fuzzyTree.exchanges, fuzzyTree.rootId)];

		const results = searchChats(fuzzyChats, 'abcd', [0]);
		expect(results).toHaveLength(1);
		expect(results[0]!.exchangeId).toBe('f1');
		expect(results[0]!.snippets).toEqual([]);
	});

	it('ignores missing chats', () => {
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
		const items = [
			{ exchangeId: 'a1', chatIndex: 0, prompt: 'How do transformers use attention?', snippets: [] }
		];

		expect(groupResults(items, chats, 0, true, true)).toEqual([
			{
				label: 'Alpha (current)',
				items
			}
		]);
	});

	it('uses a fallback label when a chat name is blank', () => {
		const unnamedTree = buildLinearExchanges([{ id: 'a1', prompt: 'hello' }]);
		const unnamedChats = [buildChat('chat-1', '', unnamedTree.exchanges, unnamedTree.rootId)];
		const items = [{ exchangeId: 'a1', chatIndex: 0, prompt: 'hello', snippets: [] }];

		expect(groupResults(items, unnamedChats, 0, true, true)).toEqual([
			{
				label: 'Chat 1 (current)',
				items
			}
		]);
	});

	it('searches exchanges that have a null response', () => {
		const tree = buildLinearExchanges([{ id: 'n1', prompt: 'attention query' }]);
		const exchanges = { ...tree.exchanges };
		exchanges['n1'] = { ...exchanges['n1']!, response: null } as Exchange;
		const nullChats = [buildChat('chat-1', 'Null', exchanges, tree.rootId)];

		const results = searchChats(nullChats, 'attention', [0]);
		expect(results).toHaveLength(1);
		expect(results[0]!.exchangeId).toBe('n1');
	});

	it('uses a generated label when a chat has no name property', () => {
		const tree = buildLinearExchanges([{ id: 'u1', prompt: 'hello' }]);
		const unnamedChats = [
			{
				id: 'chat-1',
				rootId: tree.rootId,
				exchanges: tree.exchanges,
				activeExchangeId: null
			} as Chat
		];
		const items = [{ exchangeId: 'u1', chatIndex: 0, prompt: 'hello', snippets: [] }];
		const groups = groupResults(items, unnamedChats, 0, true, true);
		expect(groups[0]!.label).toBe('Chat 1 (current)');
	});

	it('falls back to natural chat order when the active chat index is invalid', () => {
		const items = [
			{
				exchangeId: 'a1',
				chatIndex: 0,
				prompt: 'How do transformers use attention?',
				snippets: []
			},
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
});
