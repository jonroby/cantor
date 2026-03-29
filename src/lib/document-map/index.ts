import katex from 'katex';
import { Marked, type TokenizerAndRendererExtension } from 'marked';

export interface DocumentBlock {
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

export const marked = new Marked({
	async: false,
	gfm: true,
	breaks: true,
	extensions: [blockMathDollar, blockMathBracket, inlineMathDollar, inlineMathParen]
});

/**
 * Maps each top-level block in a markdown+KaTeX document to its rendered HTML.
 * Returns a 1:1 array: one entry per top-level block element (paragraph, list, heading, code block, etc.).
 */
export function mapDocument(text: string): DocumentBlock[] {
	if (!text) return [];

	const tokens = marked.lexer(text);
	const blocks: DocumentBlock[] = [];

	for (const token of tokens) {
		if (token.type === 'space') continue;

		const html = marked.parser([token]) as string;
		blocks.push({
			source: token.raw,
			html
		});
	}

	return blocks;
}
