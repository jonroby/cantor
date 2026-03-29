import { describe, expect, it } from 'vitest';

import { mapDocument } from './index';

describe('mapDocument', () => {
	it('returns empty array for empty string', () => {
		expect(mapDocument('')).toEqual([]);
	});

	it('maps a single paragraph', () => {
		const result = mapDocument('Hello world');
		expect(result).toHaveLength(1);
		expect(result[0].source).toBe('Hello world');
		expect(result[0].html).toContain('<p>');
		expect(result[0].html).toContain('Hello world');
	});

	it('maps multiple paragraphs', () => {
		const result = mapDocument('First paragraph\n\nSecond paragraph\n\nThird paragraph');
		expect(result).toHaveLength(3);
		expect(result[0].source).toContain('First paragraph');
		expect(result[1].source).toContain('Second paragraph');
		expect(result[2].source).toContain('Third paragraph');
		for (const block of result) {
			expect(block.html).toContain('<p>');
		}
	});

	it('maps a heading', () => {
		const result = mapDocument('# Title\n\nSome text');
		expect(result).toHaveLength(2);
		expect(result[0].html).toContain('<h1>');
		expect(result[1].html).toContain('<p>');
	});

	it('maps an ordered list as one block', () => {
		const result = mapDocument('Some text\n\n1. First\n2. Second\n3. Third\n\nMore text');
		expect(result).toHaveLength(3);
		expect(result[0].html).toContain('<p>');
		expect(result[1].html).toContain('<ol>');
		expect(result[2].html).toContain('<p>');
	});

	it('maps an unordered list as one block', () => {
		const result = mapDocument('Intro\n\n- a\n- b\n- c\n\nOutro');
		expect(result).toHaveLength(3);
		expect(result[1].html).toContain('<ul>');
	});

	it('maps a fenced code block', () => {
		const result = mapDocument('Before\n\n```js\nconst x = 1;\n```\n\nAfter');
		expect(result).toHaveLength(3);
		expect(result[1].html).toContain('<pre><code');
		expect(result[1].source).toContain('const x = 1;');
	});

	it('maps paragraphs with inline KaTeX', () => {
		const result = mapDocument('The formula $x^2$ is nice\n\nAnother paragraph');
		expect(result).toHaveLength(2);
		expect(result[0].html).toContain('katex');
		expect(result[1].html).toContain('Another paragraph');
	});

	it('maps display math as a block', () => {
		const result = mapDocument('Before\n\n$$x^2 + y^2 = z^2$$\n\nAfter');
		expect(result).toHaveLength(3);
		expect(result[1].html).toContain('katex');
	});

	it('preserves source text for each block', () => {
		const input = '# Heading\n\nParagraph one\n\n- item a\n- item b';
		const result = mapDocument(input);
		expect(result).toHaveLength(3);
		expect(result[0].source).toContain('# Heading');
		expect(result[1].source).toContain('Paragraph one');
		expect(result[2].source).toContain('- item a');
	});
});
