import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';
import { visit } from 'unist-util-visit';

export function validate(md: string): string[] {
	const tree = unified().use(remarkParse).use(remarkMath).parse(md);

	const errors: string[] = [];

	visit(tree, (node) => {
		// forbid raw HTML
		if (node.type === 'html') {
			errors.push('Raw HTML not allowed');
		}

		// check math blocks exist
		if (node.type === 'inlineMath' || node.type === 'math') {
			if (!('value' in node) || !(node.value as string).trim()) {
				errors.push('Empty math block');
			}
		}
	});

	return errors;
}
