import katex from 'katex';

/**
 * Renders LaTeX math expressions in text using KaTeX.
 * Supports:
 *   - Display math: $$ ... $$ or \[ ... \]
 *   - Inline math:  $ ... $  or \( ... \)
 *
 * Returns an HTML string with math replaced by rendered KaTeX spans.
 * Non-math text is escaped to prevent XSS.
 */
export function renderMath(text: string): string {
	if (!text) return '';

	// Order matters: match display delimiters before inline ones.
	const patterns: { regex: RegExp; displayMode: boolean }[] = [
		// $$ ... $$ (display)
		{ regex: /\$\$([\s\S]+?)\$\$/g, displayMode: true },
		// \[ ... \] (display)
		{ regex: /\\\[([\s\S]+?)\\\]/g, displayMode: true },
		// $ ... $ (inline, not preceded/followed by $)
		{ regex: /(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)/g, displayMode: false },
		// \( ... \) (inline)
		{ regex: /\\\(([\s\S]+?)\\\)/g, displayMode: false }
	];

	// First pass: collect all match ranges to avoid double-processing.
	type Match = { start: number; end: number; latex: string; displayMode: boolean };
	const matches: Match[] = [];

	for (const { regex, displayMode } of patterns) {
		let m: RegExpExecArray | null;
		while ((m = regex.exec(text)) !== null) {
			const start = m.index;
			const end = start + m[0].length;
			// Skip if this range overlaps with an already-captured match.
			if (matches.some((prev) => start < prev.end && end > prev.start)) continue;
			matches.push({ start, end, latex: m[1], displayMode });
		}
	}

	if (matches.length === 0) return escapeHtml(text);

	// Sort by position so we can rebuild the string left-to-right.
	matches.sort((a, b) => a.start - b.start);

	let result = '';
	let cursor = 0;

	for (const match of matches) {
		// Append escaped plain text before this match.
		if (match.start > cursor) {
			result += escapeHtml(text.slice(cursor, match.start));
		}
		try {
			result += katex.renderToString(match.latex.trim(), {
				displayMode: match.displayMode,
				throwOnError: false,
				output: 'html'
			});
		} catch {
			// If KaTeX can't parse it, output the original text escaped.
			result += escapeHtml(text.slice(match.start, match.end));
		}
		cursor = match.end;
	}

	// Append any remaining text after the last match.
	if (cursor < text.length) {
		result += escapeHtml(text.slice(cursor));
	}

	return result;
}

/** Returns true if the text contains any LaTeX math delimiters. */
export function containsMath(text: string): boolean {
	return /\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|(?<!\$)\$(?!\$).+?(?<!\$)\$(?!\$)|\\\([\s\S]+?\\\)/.test(
		text
	);
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}
