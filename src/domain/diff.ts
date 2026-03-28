export type DiffLineType = 'unchanged' | 'added' | 'removed';

export interface DiffLine {
	type: DiffLineType;
	text: string;
}

/**
 * Simple line-based diff using longest common subsequence.
 * Returns an array of diff lines showing what changed between `a` and `b`.
 */
export function diffLines(a: string, b: string): DiffLine[] {
	const aLines = a.split('\n');
	const bLines = b.split('\n');
	const lcs = longestCommonSubsequence(aLines, bLines);

	const result: DiffLine[] = [];
	let ai = 0;
	let bi = 0;

	for (const match of lcs) {
		while (ai < match.ai) {
			result.push({ type: 'removed', text: aLines[ai]! });
			ai++;
		}
		while (bi < match.bi) {
			result.push({ type: 'added', text: bLines[bi]! });
			bi++;
		}
		result.push({ type: 'unchanged', text: aLines[ai]! });
		ai++;
		bi++;
	}

	while (ai < aLines.length) {
		result.push({ type: 'removed', text: aLines[ai]! });
		ai++;
	}
	while (bi < bLines.length) {
		result.push({ type: 'added', text: bLines[bi]! });
		bi++;
	}

	return result;
}

interface LCSMatch {
	ai: number;
	bi: number;
}

function longestCommonSubsequence(a: string[], b: string[]): LCSMatch[] {
	const m = a.length;
	const n = b.length;
	const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[]);

	for (let i = m - 1; i >= 0; i--) {
		for (let j = n - 1; j >= 0; j--) {
			if (a[i] === b[j]) {
				dp[i]![j] = dp[i + 1]![j + 1]! + 1;
			} else {
				dp[i]![j] = Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
			}
		}
	}

	const matches: LCSMatch[] = [];
	let i = 0;
	let j = 0;
	while (i < m && j < n) {
		if (a[i] === b[j]) {
			matches.push({ ai: i, bi: j });
			i++;
			j++;
		} else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
			i++;
		} else {
			j++;
		}
	}

	return matches;
}
