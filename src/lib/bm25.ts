export interface ScoredItem<T> {
	item: T;
	score: number;
}

function tokenize(text: string): string[] {
	return text.toLowerCase().split(/\s+/).filter(Boolean);
}

export function scoreBM25<T>(
	query: string,
	items: T[],
	getText: (item: T) => string,
	k1 = 1.5,
	b = 0.75
): ScoredItem<T>[] {
	if (items.length === 0) return [];

	const queryTerms = tokenize(query);
	if (queryTerms.length === 0) return items.map((item) => ({ item, score: 0 }));

	const docs = items.map((item) => tokenize(getText(item)));
	const avgDl = docs.reduce((sum, d) => sum + d.length, 0) / docs.length;
	const n = docs.length;

	const df = new Map<string, number>();
	for (const doc of docs) {
		const seen = new Set(doc);
		for (const term of seen) {
			df.set(term, (df.get(term) ?? 0) + 1);
		}
	}

	return docs
		.map((doc, i) => {
			const tf = new Map<string, number>();
			for (const term of doc) {
				tf.set(term, (tf.get(term) ?? 0) + 1);
			}

			let score = 0;
			for (const term of queryTerms) {
				const termDf = df.get(term) ?? 0;
				if (termDf === 0) continue;
				const idf = Math.log((n - termDf + 0.5) / (termDf + 0.5) + 1);
				const termTf = tf.get(term) ?? 0;
				score += idf * ((termTf * (k1 + 1)) / (termTf + k1 * (1 - b + b * (doc.length / avgDl))));
			}

			return { item: items[i], score };
		})
		.sort((a, b) => b.score - a.score);
}
