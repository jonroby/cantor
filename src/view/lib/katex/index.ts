import katex from 'katex';
import { Marked, type TokenizerAndRendererExtension } from 'marked';

export interface MarkdownKatexBlock {
	source: string;
	html: string;
}

interface MathToken {
	latex: string;
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

function renderKatex(latex: string, displayMode: boolean): string {
	try {
		return katex.renderToString(latex.trim(), {
			displayMode,
			throwOnError: false,
			output: 'html'
		});
	} catch {
		return escapeHtml(latex);
	}
}

function findClosing(src: string, start: number, delimiter: string): number {
	const idx = src.indexOf(delimiter, start);
	if (idx === -1) return -1;
	return idx;
}

const blockMathDollar: TokenizerAndRendererExtension = {
	name: 'blockMathDollar',
	level: 'block',
	start(src: string) {
		const idx = src.indexOf('$$');
		return idx !== -1 ? idx : undefined;
	},
	tokenizer(src: string) {
		if (!src.startsWith('$$')) return undefined;
		const end = findClosing(src, 2, '$$');
		if (end === -1) return undefined;
		const raw = src.slice(0, end + 2);
		const latex = src.slice(2, end);
		return { type: 'blockMathDollar', raw, latex } as const;
	},
	renderer(token) {
		return renderKatex((token as unknown as MathToken).latex, true);
	}
};

const blockMathBracket: TokenizerAndRendererExtension = {
	name: 'blockMathBracket',
	level: 'block',
	start(src: string) {
		const idx = src.indexOf('\\[');
		return idx !== -1 ? idx : undefined;
	},
	tokenizer(src: string) {
		if (!src.startsWith('\\[')) return undefined;
		const end = findClosing(src, 2, '\\]');
		if (end === -1) return undefined;
		const raw = src.slice(0, end + 2);
		const latex = src.slice(2, end);
		return { type: 'blockMathBracket', raw, latex } as const;
	},
	renderer(token) {
		return renderKatex((token as unknown as MathToken).latex, true);
	}
};

const inlineMathDollar: TokenizerAndRendererExtension = {
	name: 'inlineMathDollar',
	level: 'inline',
	start(src: string) {
		const idx = src.indexOf('$');
		if (idx === -1) return undefined;
		if (src[idx + 1] === '$') return undefined;
		return idx;
	},
	tokenizer(src: string) {
		if (src[0] !== '$' || src[1] === '$') return undefined;
		const end = findClosing(src, 1, '$');
		if (end === -1 || end === 1) return undefined;
		if (src[end + 1] === '$') return undefined;
		const raw = src.slice(0, end + 1);
		const latex = src.slice(1, end);
		return { type: 'inlineMathDollar', raw, latex } as const;
	},
	renderer(token) {
		return renderKatex((token as unknown as MathToken).latex, false);
	}
};

const inlineMathParen: TokenizerAndRendererExtension = {
	name: 'inlineMathParen',
	level: 'inline',
	start(src: string) {
		const idx = src.indexOf('\\(');
		return idx !== -1 ? idx : undefined;
	},
	tokenizer(src: string) {
		if (!src.startsWith('\\(')) return undefined;
		const end = findClosing(src, 2, '\\)');
		if (end === -1) return undefined;
		const raw = src.slice(0, end + 2);
		const latex = src.slice(2, end);
		return { type: 'inlineMathParen', raw, latex } as const;
	},
	renderer(token) {
		return renderKatex((token as unknown as MathToken).latex, false);
	}
};

export const markdownKatexRenderer = new Marked({
	async: false,
	gfm: true,
	breaks: true,
	extensions: [blockMathDollar, blockMathBracket, inlineMathDollar, inlineMathParen]
});

export function renderMarkdownKatexBlocks(text: string): MarkdownKatexBlock[] {
	if (!text) return [];

	const tokens = markdownKatexRenderer.lexer(text);
	const blocks: MarkdownKatexBlock[] = [];

	for (const token of tokens) {
		if (token.type === 'space') continue;

		const html = markdownKatexRenderer.parser([token]) as string;
		blocks.push({
			source: token.raw,
			html
		});
	}

	return blocks;
}

// CLEANUP: Output is rendered via {@html} without sanitization. Add DOMPurify (or similar) after
// the marked + KaTeX pipeline to prevent XSS from user prompts or LLM responses containing HTML.
export function renderRichText(text: string): string {
	if (!text) return '';
	return markdownKatexRenderer.parse(text) as string;
}
