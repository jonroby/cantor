export interface ScoredItem<T> {
	item: T;
	score: number;
}

export function cosine(a: Float32Array, b: Float32Array): number {
	if (a.length !== b.length) return 0;
	let dot = 0;
	let normA = 0;
	let normB = 0;
	for (let i = 0; i < a.length; i++) {
		const ai = a[i]!;
		const bi = b[i]!;
		dot += ai * bi;
		normA += ai * ai;
		normB += bi * bi;
	}
	if (normA === 0 || normB === 0) return 0;
	return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Rank items by cosine similarity to a query embedding.
 * Items whose `getEmbedding` returns `null` are excluded from the result,
 * matching how bm25 callers expect missing entries to be skipped rather
 * than ranked at score 0.
 */
export function scoreSimilarity<T>(
	queryEmbedding: Float32Array,
	items: T[],
	getEmbedding: (item: T) => Float32Array | null
): ScoredItem<T>[] {
	const scored: ScoredItem<T>[] = [];
	for (const item of items) {
		const vec = getEmbedding(item);
		if (!vec) continue;
		scored.push({ item, score: cosine(queryEmbedding, vec) });
	}
	scored.sort((a, b) => b.score - a.score);
	return scored;
}
