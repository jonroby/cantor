import katex from 'katex';
import { Marked } from 'marked';

const marked = new Marked({
	async: false,
	gfm: true,
	breaks: true
});

/**
 * Renders text as rich HTML using marked (markdown) and KaTeX (math).
 *
 * Strategy: extract math delimiters first, replacing them with unique
 * placeholders so marked doesn't mangle them, then run marked, then
 * swap the placeholders back with KaTeX-rendered HTML.
 */
export function renderRichText(text: string): string {
	if (!text) return '';

	const placeholders: Map<string, string> = new Map();
	let counter = 0;

	// Replace math delimiters with placeholders before markdown parsing.
	const mathPatterns: { regex: RegExp; displayMode: boolean }[] = [
		{ regex: /\$\$([\s\S]+?)\$\$/g, displayMode: true },
		{ regex: /\\\[([\s\S]+?)\\\]/g, displayMode: true },
		{ regex: /(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)/g, displayMode: false },
		{ regex: /\\\(([\s\S]+?)\\\)/g, displayMode: false }
	];

	let processed = text;

	for (const { regex, displayMode } of mathPatterns) {
		processed = processed.replace(regex, (_match, latex: string) => {
			const id = `%%MATH_${counter++}%%`;
			let rendered: string;
			try {
				rendered = katex.renderToString(latex.trim(), {
					displayMode,
					throwOnError: false,
					output: 'html'
				});
			} catch {
				rendered = escapeHtml(_match);
			}
			placeholders.set(id, rendered);
			return id;
		});
	}

	// Run marked for markdown rendering.
	let html = marked.parse(processed) as string;

	// Swap placeholders back with rendered KaTeX.
	for (const [id, rendered] of placeholders) {
		html = html.replace(id, rendered);
	}

	return html;
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}
