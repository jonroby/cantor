import * as app from '@/app';

// CLEANUP: Output is rendered via {@html} without sanitization. Add DOMPurify (or similar) after
// the marked + KaTeX pipeline to prevent XSS from user prompts or LLM responses containing HTML.
export function renderRichText(text: string): string {
	if (!text) return '';
	return app.content.marked.parse(text) as string;
}
