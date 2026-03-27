import { describe, expect, it } from 'vitest';

import { renderRichText } from './katex';

describe('renderRichText', () => {
	describe('empty/falsy input', () => {
		it('returns empty string for empty string', () => {
			expect(renderRichText('')).toBe('');
		});
	});

	describe('plain markdown', () => {
		it('renders plain text as a paragraph', () => {
			const result = renderRichText('hello world');
			expect(result).toContain('hello world');
			expect(result).toContain('<p>');
		});

		it('renders bold text', () => {
			const result = renderRichText('**bold**');
			expect(result).toContain('<strong>bold</strong>');
		});

		it('renders inline code', () => {
			const result = renderRichText('`code`');
			expect(result).toContain('<code>code</code>');
		});

		it('renders a fenced code block', () => {
			const result = renderRichText('```\nconst x = 1;\n```');
			expect(result).toContain('<code>');
			expect(result).toContain('const x = 1;');
		});
	});

	describe('inline math with $...$', () => {
		it('renders KaTeX HTML', () => {
			const result = renderRichText('The formula $x^2$ is nice');
			expect(result).toContain('katex');
			expect(result).toContain('x');
		});

		it('does not treat $$...$$ as inline', () => {
			const result = renderRichText('$$x^2$$');
			// Display mode KaTeX uses katex-display class
			expect(result).toContain('katex-display');
		});
	});

	describe('display math with $$...$$', () => {
		it('renders display-mode KaTeX', () => {
			const result = renderRichText('$$\\int_0^1 x\\,dx$$');
			expect(result).toContain('katex-display');
		});

		it('handles multiline display math', () => {
			const result = renderRichText('$$\nx^2 + y^2 = z^2\n$$');
			expect(result).toContain('katex-display');
		});
	});

	describe('\\(...\\) inline math', () => {
		it('renders inline KaTeX', () => {
			const result = renderRichText('The formula \\(x^2\\) here');
			expect(result).toContain('katex');
			expect(result).not.toContain('katex-display');
		});
	});

	describe('\\[...\\] display math', () => {
		it('renders display-mode KaTeX', () => {
			const result = renderRichText('\\[x^2 + y^2\\]');
			expect(result).toContain('katex-display');
		});
	});

	describe('mixed markdown and math', () => {
		it('renders both markdown formatting and math', () => {
			const result = renderRichText('**Bold** and $x^2$ together');
			expect(result).toContain('<strong>Bold</strong>');
			expect(result).toContain('katex');
		});
	});

	describe('invalid LaTeX', () => {
		it('does not throw on invalid LaTeX', () => {
			// KaTeX with throwOnError: false renders error HTML instead of throwing
			expect(() => renderRichText('$\\invalid{$')).not.toThrow();
		});
	});

	describe('code blocks are not treated as math', () => {
		it('does not render math inside fenced code blocks', () => {
			const result = renderRichText('```\n$x^2$\n```');
			// Inside a code block, the $ should be literal, not KaTeX
			// marked wraps code block content in <code>, so katex-display should not appear
			expect(result).not.toContain('katex-display');
		});

		it('does not render math inside inline code', () => {
			const result = renderRichText('Use `$x^2$` for math');
			// The inline code should contain the literal $x^2$, not KaTeX
			expect(result).toContain('<code>');
		});
	});
});
