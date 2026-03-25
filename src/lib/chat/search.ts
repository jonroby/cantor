import type { ExchangeMap } from './tree';

const SNIPPET_CONTEXT = 80;
const TRIGRAM_THRESHOLD = 0.15;

export interface Snippet {
	text: string;
	matchStart: number;
	matchEnd: number;
}

export interface SearchResult {
	exchangeId: string;
	rootIndex: number;
	prompt: string;
	snippets: Snippet[];
}

export interface ResultGroup {
	label: string;
	items: SearchResult[];
}

function trigrams(s: string): Set<string> {
	const t = new Set<string>();
	const norm = s.toLowerCase();
	for (let i = 0; i <= norm.length - 3; i++) t.add(norm.slice(i, i + 3));
	return t;
}

function scoreText(text: string, queryTrigrams: Set<string>, query: string): number {
	if (query.length < 3) return text.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
	const textTrigrams = trigrams(text);
	let matches = 0;
	queryTrigrams.forEach((tg) => {
		if (textTrigrams.has(tg)) matches++;
	});
	return matches / queryTrigrams.size;
}

function extractSnippet(text: string, query: string): Snippet | null {
	const idx = text.toLowerCase().indexOf(query.toLowerCase());
	if (idx === -1) return null;
	const start = Math.max(0, idx - SNIPPET_CONTEXT);
	const end = Math.min(text.length, idx + query.length + SNIPPET_CONTEXT);
	const prefix = start > 0 ? '…' : '';
	const suffix = end < text.length ? '…' : '';
	const snippet = prefix + text.slice(start, end) + suffix;
	return {
		text: snippet,
		matchStart: idx - start + prefix.length,
		matchEnd: idx - start + query.length + prefix.length
	};
}

export function searchChats(
	roots: ExchangeMap[],
	query: string,
	indices: number[]
): SearchResult[] {
	const queryTrigrams = trigrams(query);
	const scored: { result: SearchResult; score: number }[] = [];

	indices.forEach((rootIndex) => {
		const exchangeMap = roots[rootIndex];
		if (!exchangeMap) return;

		for (const exchange of Object.values(exchangeMap)) {
			if (exchange.isAnchor) continue;

			const promptScore = scoreText(exchange.prompt, queryTrigrams, query);
			const responseScore = scoreText(exchange.response, queryTrigrams, query);
			const score = Math.max(promptScore, responseScore);
			if (score < TRIGRAM_THRESHOLD) continue;

			const snippets: Snippet[] = [];
			if (promptScore >= TRIGRAM_THRESHOLD) {
				const snippet = extractSnippet(exchange.prompt, query);
				if (snippet) snippets.push(snippet);
			}
			if (responseScore >= TRIGRAM_THRESHOLD) {
				const snippet = extractSnippet(exchange.response, query);
				if (snippet) snippets.push(snippet);
			}

			scored.push({
				result: { exchangeId: exchange.id, rootIndex, prompt: exchange.prompt, snippets },
				score
			});
		}
	});

	return scored.sort((a, b) => b.score - a.score).map((item) => item.result);
}

export function getDefaultItems(
	roots: ExchangeMap[],
	activeRootIndex: number,
	allChats: boolean
): SearchResult[] {
	const indices = allChats ? roots.map((_, i) => i) : [activeRootIndex];
	return indices.flatMap((rootIndex) => {
		const exchangeMap = roots[rootIndex];
		if (!exchangeMap) return [];

		return Object.values(exchangeMap)
			.filter((exchange) => !exchange.isAnchor && exchange.prompt)
			.map((exchange) => ({
				exchangeId: exchange.id,
				rootIndex,
				prompt: exchange.prompt,
				snippets: []
			}));
	});
}

export function groupResults(
	items: SearchResult[],
	roots: ExchangeMap[],
	activeRootIndex: number,
	grouped: boolean,
	allChats: boolean
): ResultGroup[] {
	if (!allChats || !grouped) {
		return [{ label: 'Exchanges', items }];
	}

	const itemsByRootIndex = items.reduce<Map<number, SearchResult[]>>((acc, item) => {
		const groupItems = acc.get(item.rootIndex);
		if (groupItems) {
			groupItems.push(item);
		} else {
			acc.set(item.rootIndex, [item]);
		}
		return acc;
	}, new Map());

	const orderedIndices = [
		activeRootIndex,
		...roots.map((_, i) => i).filter((i) => i !== activeRootIndex)
	];
	return orderedIndices.reduce<ResultGroup[]>((acc, rootIndex) => {
		const groupItems = itemsByRootIndex.get(rootIndex) ?? [];
		if (groupItems.length === 0) return acc;

		const base = rootIndex === 0 ? 'Main Chat' : `Fork ${rootIndex}`;
		const label = rootIndex === activeRootIndex ? `${base} (current)` : base;
		acc.push({ label, items: groupItems });
		return acc;
	}, []);
}
