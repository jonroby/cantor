import { describe, it, expect } from 'vitest';
import { validate } from '../index';

describe('validate', () => {
	it('returns no errors for plain markdown', () => {
		const md = `# Hello World

This is a paragraph with **bold** and *italic* text.

- Item 1
- Item 2
`;
		expect(validate(md)).toEqual([]);
	});

	it('returns no errors for markdown with inline math', () => {
		const md = `The variance of the dot product is $\\sqrt{d_k}$.`;
		expect(validate(md)).toEqual([]);
	});

	it('returns no errors for markdown with block math', () => {
		const md = `The attention output is:

$$
\\text{Attention}(Q, K, V) = \\text{softmax}\\!\\left(\\frac{QK^\\top}{\\sqrt{d_k}}\\right)V
$$
`;
		expect(validate(md)).toEqual([]);
	});

	it('returns no errors for seed data (attention mechanism response)', () => {
		const md = `Attention is the core innovation that makes transformers so powerful.

**Scaled dot-product attention**

Given an input sequence, we project each token embedding into three vectors:

$$
Q = XW^Q, \\quad K = XW^K, \\quad V = XW^V
$$

where $X \\in \\mathbb{R}^{n \\times d_{\\text{model}}}$ is the sequence of token embeddings.

The attention output is then:

$$
\\text{Attention}(Q, K, V) = \\text{softmax}\\!\\left(\\frac{QK^\\top}{\\sqrt{d_k}}\\right)V
$$

**Multi-head attention**

$$
\\text{MultiHead}(Q,K,V) = \\text{Concat}(\\text{head}_1, \\ldots, \\text{head}_h)\\,W^O
$$
`;
		expect(validate(md)).toEqual([]);
	});

	it('returns no errors for seed data (Bayes theorem response)', () => {
		const md = `**The theorem**

$$
P(H \\mid E) = \\frac{P(E \\mid H)\\, P(H)}{P(E)}
$$

**MAP estimation**

$$
\\hat{\\theta}_{\\text{MAP}} = \\arg\\max_\\theta P(\\theta \\mid \\mathcal{D}) = \\arg\\max_\\theta \\bigl[\\log P(\\mathcal{D} \\mid \\theta) + \\log P(\\theta)\\bigr]
$$

**Full Bayesian inference**

$$
P(y^* \\mid x^*, \\mathcal{D}) = \\int P(y^* \\mid x^*, \\theta)\\, P(\\theta \\mid \\mathcal{D})\\, d\\theta
$$
`;
		expect(validate(md)).toEqual([]);
	});

	it('returns no errors for seed data (KL divergence response)', () => {
		const md = `**Definition**

$$
D_{\\text{KL}}(P \\| Q) = \\sum_x P(x) \\log \\frac{P(x)}{Q(x)}
$$

**Why it's non-negative: Jensen's inequality**

$$
D_{\\text{KL}}(P \\| Q) = \\mathbb{E}_P\\!\\left[\\log\\frac{P(x)}{Q(x)}\\right] \\geq 0
$$

**ELBO**

$$
\\mathcal{L}(\\phi) = \\mathbb{E}_{q_\\phi}[\\log P(\\mathcal{D} \\mid \\theta)] - D_{\\text{KL}}(q_\\phi(\\theta) \\| P(\\theta))
$$
`;
		expect(validate(md)).toEqual([]);
	});

	it('allows raw HTML (sanitized at render time)', () => {
		const md = `# Title

<div>some html</div>

Some text.
`;
		expect(validate(md)).toEqual([]);
	});

	it('allows SVG elements', () => {
		const md = `# Diagram

<svg width="200" height="100" viewBox="0 0 200 100">
  <rect x="10" y="10" width="80" height="40" fill="#eee" stroke="#333"/>
  <text x="50" y="35" text-anchor="middle">Hello</text>
</svg>
`;
		expect(validate(md)).toEqual([]);
	});

	it('rejects empty block math', () => {
		expect(validate('$$\n$$')).toContain('Empty math block');
	});

	it('rejects empty block math surrounded by text', () => {
		const md = `Some text.

$$
$$

More text.
`;
		const errors = validate(md);
		expect(errors).toContain('Empty math block');
	});

	it('rejects whitespace-only inline math', () => {
		expect(validate('$   $')).toContain('Empty math block');
	});

	it('rejects whitespace-only block math', () => {
		const md = `$$

$$`;
		const errors = validate(md);
		expect(errors).toContain('Empty math block');
	});

	it('returns no errors for empty input', () => {
		expect(validate('')).toEqual([]);
	});

	it('returns no errors for code blocks with HTML-like content', () => {
		const md = `\`\`\`html
<div>this is fine in a code block</div>
\`\`\``;
		expect(validate(md)).toEqual([]);
	});

	it('returns no errors for inline code with HTML', () => {
		expect(validate('Use `<div>` for layout')).toEqual([]);
	});
});
