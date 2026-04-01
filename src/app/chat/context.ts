import * as domain from '@/domain';
import * as lib from '@/lib';
import * as state from '@/state';

type ContextStrategy = state.chats.ContextStrategy;

export interface ContextBudget {
	contextLength: number | null;
	strategy: ContextStrategy;
	currentPrompt: string;
}

function exchangeTokens(exchange: domain.tree.Exchange): number {
	const promptTokens =
		exchange.prompt.tokenCount || lib.tokenEstimate.estimateTokens(exchange.prompt.text);
	const responseTokens = exchange.response
		? exchange.response.tokenCount || lib.tokenEstimate.estimateTokens(exchange.response.text)
		: 0;
	return promptTokens + responseTokens;
}

export function selectExchanges(
	path: domain.tree.Exchange[],
	budget: ContextBudget
): domain.tree.Exchange[] {
	if (budget.strategy === 'full' || budget.contextLength === null || path.length === 0) {
		return path;
	}

	const currentPromptTokens = lib.tokenEstimate.estimateTokens(budget.currentPrompt);
	const reserveForResponse = Math.floor(budget.contextLength * 0.25);
	const available = budget.contextLength - currentPromptTokens - reserveForResponse;

	if (available <= 0) {
		return path.length > 0 ? [path[path.length - 1]!] : [];
	}

	if (budget.strategy === 'lru') {
		return selectLRU(path, available);
	}

	return selectBM25(path, available, budget.currentPrompt);
}

function selectLRU(path: domain.tree.Exchange[], available: number): domain.tree.Exchange[] {
	const selected: domain.tree.Exchange[] = [];
	let used = 0;
	for (let i = path.length - 1; i >= 0; i--) {
		const cost = exchangeTokens(path[i]!);
		if (used + cost > available && selected.length > 0) break;
		selected.unshift(path[i]!);
		used += cost;
	}
	return selected;
}

function selectBM25(
	path: domain.tree.Exchange[],
	available: number,
	query: string
): domain.tree.Exchange[] {
	const last = path[path.length - 1]!;
	const lastCost = exchangeTokens(last);
	let remaining = available - lastCost;

	if (path.length <= 1) return [last];

	const candidates = path.slice(0, -1);
	const scored = lib.bm25.scoreBM25(
		query,
		candidates,
		(ex) => ex.prompt.text + ' ' + (ex.response?.text ?? '')
	);

	const selectedSet = new Set<string>();
	for (const { item } of scored) {
		const cost = exchangeTokens(item);
		if (remaining - cost < 0) continue;
		selectedSet.add(item.id);
		remaining -= cost;
	}

	const selected = candidates.filter((ex) => selectedSet.has(ex.id));
	selected.push(last);
	return selected;
}
