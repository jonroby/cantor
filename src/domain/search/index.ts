import type { Chat, Exchange } from '@/domain/tree';

const SNIPPET_CONTEXT = 80;
const TRIGRAM_THRESHOLD = 0.15;
const SEARCH_RESULTS_LABEL = 'Exchanges';

export interface Snippet {
	text: string;
	matchStart: number;
	matchEnd: number;
}

export interface SearchResult {
	exchangeId: string;
	chatIndex: number;
	prompt: string;
	snippets: Snippet[];
}

export interface ResultGroup {
	label: string;
	items: SearchResult[];
}

interface SearchQuery {
	raw: string;
	normalized: string;
	trigrams: Set<string>;
}

interface SearchableExchange {
	id: string;
	prompt: string;
	response: string;
}

interface ScoredSearchResult {
	result: SearchResult;
	score: number;
}

function buildSearchQuery(query: string): SearchQuery {
	const normalized = query.trim().toLowerCase();
	return {
		raw: query.trim(),
		normalized,
		trigrams: buildTrigrams(normalized)
	};
}

function buildTrigrams(text: string): Set<string> {
	const result = new Set<string>();
	for (let index = 0; index <= text.length - 3; index += 1) {
		result.add(text.slice(index, index + 3));
	}
	return result;
}

function isSearchableExchange(exchange: Exchange): boolean {
	return exchange.parentId !== null;
}

function getSearchableExchanges(chat: Chat | undefined): SearchableExchange[] {
	if (!chat) {
		return [];
	}

	return Object.values(chat.exchanges)
		.filter(isSearchableExchange)
		.map((exchange) => ({
			id: exchange.id,
			prompt: exchange.prompt.text,
			response: exchange.response?.text ?? ''
		}));
}

function dedupeIndices(indices: number[]): number[] {
	return [...new Set(indices)];
}

function scoreText(text: string, query: SearchQuery): number {
	const normalizedText = text.toLowerCase();
	if (query.normalized.length < 3) {
		return normalizedText.includes(query.normalized) ? 1 : 0;
	}

	const textTrigrams = buildTrigrams(normalizedText);
	let matches = 0;
	for (const trigram of query.trigrams) {
		if (textTrigrams.has(trigram)) {
			matches += 1;
		}
	}

	return matches / query.trigrams.size;
}

function extractSnippet(text: string, query: SearchQuery): Snippet | null {
	const matchIndex = text.toLowerCase().indexOf(query.normalized);
	if (matchIndex === -1) {
		return null;
	}

	const snippetStart = Math.max(0, matchIndex - SNIPPET_CONTEXT);
	const snippetEnd = Math.min(text.length, matchIndex + query.raw.length + SNIPPET_CONTEXT);
	const prefix = snippetStart > 0 ? '...' : '';
	const suffix = snippetEnd < text.length ? '...' : '';
	const snippetText = `${prefix}${text.slice(snippetStart, snippetEnd)}${suffix}`;

	return {
		text: snippetText,
		matchStart: matchIndex - snippetStart + prefix.length,
		matchEnd: matchIndex - snippetStart + query.raw.length + prefix.length
	};
}

function buildSnippets(exchange: SearchableExchange, query: SearchQuery): Snippet[] {
	const promptScore = scoreText(exchange.prompt, query);
	const responseScore = scoreText(exchange.response, query);
	const snippets: Snippet[] = [];

	if (promptScore >= TRIGRAM_THRESHOLD) {
		const snippet = extractSnippet(exchange.prompt, query);
		if (snippet) {
			snippets.push(snippet);
		}
	}

	if (responseScore >= TRIGRAM_THRESHOLD) {
		const snippet = extractSnippet(exchange.response, query);
		if (snippet) {
			snippets.push(snippet);
		}
	}

	return snippets;
}

function buildSearchResult(
	exchange: SearchableExchange,
	chatIndex: number,
	query: SearchQuery
): ScoredSearchResult | null {
	const promptScore = scoreText(exchange.prompt, query);
	const responseScore = scoreText(exchange.response, query);
	const score = Math.max(promptScore, responseScore);
	if (score < TRIGRAM_THRESHOLD) {
		return null;
	}

	return {
		result: {
			exchangeId: exchange.id,
			chatIndex,
			prompt: exchange.prompt,
			snippets: buildSnippets(exchange, query)
		},
		score
	};
}

function getOrderedGroupIndices(chats: Chat[], activeChatIndex: number): number[] {
	const allIndices = chats.map((_, index) => index);
	if (activeChatIndex < 0 || activeChatIndex >= chats.length) {
		return allIndices;
	}

	return [activeChatIndex, ...allIndices.filter((index) => index !== activeChatIndex)];
}

function getChatLabel(chats: Chat[], chatIndex: number, activeChatIndex: number): string {
	const chatName = chats[chatIndex]?.name ?? `Chat ${chatIndex + 1}`;
	return chatIndex === activeChatIndex ? `${chatName} (current)` : chatName;
}

export function searchChats(chats: Chat[], query: string, indices: number[]): SearchResult[] {
	const searchQuery = buildSearchQuery(query);
	if (searchQuery.normalized.length === 0) {
		return [];
	}

	const scoredResults = dedupeIndices(indices).flatMap((chatIndex) =>
		getSearchableExchanges(chats[chatIndex])
			.map((exchange) => buildSearchResult(exchange, chatIndex, searchQuery))
			.filter((result): result is ScoredSearchResult => result !== null)
	);

	return scoredResults.sort((left, right) => right.score - left.score).map(({ result }) => result);
}

export function getDefaultItems(
	chats: Chat[],
	activeChatIndex: number,
	allChats: boolean
): SearchResult[] {
	const indices = allChats ? chats.map((_, index) => index) : [activeChatIndex];

	return dedupeIndices(indices).flatMap((chatIndex) =>
		getSearchableExchanges(chats[chatIndex])
			.filter((exchange) => exchange.prompt.length > 0)
			.map((exchange) => ({
				exchangeId: exchange.id,
				chatIndex,
				prompt: exchange.prompt,
				snippets: []
			}))
	);
}

export function groupResults(
	items: SearchResult[],
	chats: Chat[],
	activeChatIndex: number,
	grouped: boolean,
	allChats: boolean
): ResultGroup[] {
	if (!allChats || !grouped) {
		return [{ label: SEARCH_RESULTS_LABEL, items }];
	}

	const itemsByChatIndex = items.reduce<Map<number, SearchResult[]>>((groups, item) => {
		const nextGroup = groups.get(item.chatIndex) ?? [];
		nextGroup.push(item);
		groups.set(item.chatIndex, nextGroup);
		return groups;
	}, new Map());

	return getOrderedGroupIndices(chats, activeChatIndex).flatMap((chatIndex) => {
		const groupItems = itemsByChatIndex.get(chatIndex);
		if (!groupItems || groupItems.length === 0) {
			return [];
		}

		return [
			{
				label: getChatLabel(chats, chatIndex, activeChatIndex),
				items: groupItems
			}
		];
	});
}
