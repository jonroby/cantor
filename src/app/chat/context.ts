import * as domain from '@/domain';
import * as external from '@/external';
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

function exchangeText(exchange: domain.tree.Exchange): string {
	return exchange.prompt.text + ' ' + (exchange.response?.text ?? '');
}

export async function selectExchanges(
	path: domain.tree.Exchange[],
	budget: ContextBudget
): Promise<domain.tree.Exchange[]> {
	if (budget.strategy === 'embedding') {
		if (budget.contextLength === null || path.length === 0) return path;
		const available = computeAvailable(budget);
		if (available === null) return path.length > 0 ? [path[path.length - 1]!] : [];
		return selectEmbedding(path, available, budget.currentPrompt);
	}
	return selectExchangesSync(path, budget);
}

/**
 * Synchronous selection for the `full`, `lru`, and `bm25` strategies.
 * The embedding strategy can't run synchronously and is not handled here;
 * sync callers (like `getUsedTokens` for the token-usage display) treat it
 * as LRU.
 */
export function selectExchangesSync(
	path: domain.tree.Exchange[],
	budget: ContextBudget
): domain.tree.Exchange[] {
	if (budget.strategy === 'full' || budget.contextLength === null || path.length === 0) {
		return path;
	}

	const available = computeAvailable(budget);
	if (available === null) {
		return path.length > 0 ? [path[path.length - 1]!] : [];
	}

	if (budget.strategy === 'lru') {
		return selectLRU(path, available);
	}

	return selectBM25(path, available, budget.currentPrompt);
}

function computeAvailable(budget: ContextBudget): number | null {
	if (budget.contextLength === null) return null;
	const currentPromptTokens = lib.tokenEstimate.estimateTokens(budget.currentPrompt);
	const reserveForResponse = Math.floor(budget.contextLength * 0.25);
	const available = budget.contextLength - currentPromptTokens - reserveForResponse;
	return available > 0 ? available : null;
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
	const scored = lib.bm25.scoreBM25(query, candidates, exchangeText);

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

async function selectEmbedding(
	path: domain.tree.Exchange[],
	available: number,
	query: string
): Promise<domain.tree.Exchange[]> {
	const last = path[path.length - 1]!;
	if (path.length <= 1) return [last];

	try {
		const modelName = external.providers.embedding.getEmbeddingModelName();
		const candidates = path.slice(0, -1);

		const cached = await external.persistence.getEmbeddingsForExchanges(
			candidates.map((c) => c.id),
			modelName
		);

		const missing = candidates.filter((c) => !cached.has(c.id));
		const toEmbed = [...missing.map(exchangeText), query];
		const vectors = await external.providers.embedding.embed(toEmbed);

		for (let i = 0; i < missing.length; i++) {
			const vec = vectors[i]!;
			cached.set(missing[i]!.id, vec);
			// Fire-and-forget persistence: selection must not block on disk writes.
			void external.persistence.putEmbedding(missing[i]!.id, modelName, vec).catch(() => undefined);
		}

		const queryVector = vectors[vectors.length - 1]!;

		const scored = lib.embeddingSimilarity.scoreSimilarity(
			queryVector,
			candidates,
			(ex) => cached.get(ex.id) ?? null
		);

		const lastCost = exchangeTokens(last);
		let remaining = available - lastCost;
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
	} catch (err) {
		console.warn('[context] embedding selection failed, falling back to BM25', err);
		return selectBM25(path, available, query);
	}
}
