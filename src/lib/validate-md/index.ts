import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';
import { visit } from 'unist-util-visit';
import type { Nodes, Root } from 'mdast';

const ERROR_EMPTY_MATH_BLOCK = 'Empty math block';

type MarkdownNode = Nodes;
type MathNode = Extract<MarkdownNode, { type: 'inlineMath' | 'math' }>;

function isMathNode(node: MarkdownNode): node is MathNode {
	return node.type === 'inlineMath' || node.type === 'math';
}

function parseMarkdown(markdown: string): Root {
	return unified().use(remarkParse).use(remarkMath).parse(markdown);
}

function validateNode(node: MarkdownNode, errors: string[]): void {
	if (isMathNode(node) && node.value.trim().length === 0) {
		errors.push(ERROR_EMPTY_MATH_BLOCK);
	}
}

export function validate(md: string): string[] {
	const errors: string[] = [];

	visit(parseMarkdown(md), (node) => {
		validateNode(node as MarkdownNode, errors);
	});

	return errors;
}
