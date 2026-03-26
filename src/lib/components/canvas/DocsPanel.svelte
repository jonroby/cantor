<script lang="ts">
	import { onMount } from 'svelte';
	import { Marked } from 'marked';
	import katex from 'katex';
	import DOMPurify from 'dompurify';

	interface Props {
		content: string;
		width?: number;
	}

	let { content, width = 600 }: Props = $props();

	const marked = new Marked({
		breaks: true,
		gfm: true
	});

	function renderKatex(tex: string, displayMode: boolean): string {
		try {
			return katex.renderToString(tex, {
				displayMode,
				throwOnError: false,
				output: 'html'
			});
		} catch {
			return `<code>${tex}</code>`;
		}
	}

	function processContent(md: string): string {
		// Replace display math $$...$$ before marked processes it
		md = md.replace(/\$\$([\s\S]*?)\$\$/g, (_match, tex) => {
			return `<div class="katex-display">${renderKatex(tex.trim(), true)}</div>`;
		});

		// Replace inline math $...$  (not $$)
		md = md.replace(/(?<!\$)\$(?!\$)((?:[^$\\]|\\.)+?)\$/g, (_match, tex) => {
			return renderKatex(tex.trim(), false);
		});

		const html = marked.parse(md);
		if (typeof html === 'string') return html;
		return '';
	}

	let renderedHtml = $derived(DOMPurify.sanitize(processContent(content)));

	onMount(() => {
		// Load KaTeX CSS
		if (!document.querySelector('link[href*="katex"]')) {
			const link = document.createElement('link');
			link.rel = 'stylesheet';
			link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.42/dist/katex.min.css';
			document.head.appendChild(link);
		}
	});
</script>

<div class="docs-panel" style="width:{width}px;">
	<div class="docs-header">
		<svg
			width="16"
			height="16"
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
		>
			<path d="M3 2h7l3 3v9H3V2z" />
			<path d="M10 2v3h3" />
			<path d="M5.5 7h5M5.5 9.5h5M5.5 12h3" stroke-linecap="round" />
		</svg>
		<span>Documentation</span>
	</div>
	<div class="docs-content">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- Sanitized by DOMPurify -->
		{@html renderedHtml}
	</div>
</div>

<style>
	.docs-panel {
		background: hsl(var(--card, 0 0% 100%));
		border: 1px solid hsl(var(--border, 0 0% 85%));
		border-radius: 12px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		max-height: 800px;
	}

	.docs-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 16px;
		border-bottom: 1px solid hsl(var(--border, 0 0% 85%));
		font-size: 13px;
		font-weight: 600;
		color: hsl(var(--foreground, 0 0% 9%));
		flex-shrink: 0;
	}

	.docs-content {
		padding: 16px 20px;
		overflow-y: auto;
		font-size: 14px;
		line-height: 1.7;
		color: hsl(var(--foreground, 0 0% 9%));
	}

	.docs-content :global(h1) {
		font-size: 22px;
		font-weight: 700;
		margin: 0 0 12px 0;
		line-height: 1.3;
	}
	.docs-content :global(h2) {
		font-size: 18px;
		font-weight: 600;
		margin: 20px 0 8px 0;
		line-height: 1.3;
	}
	.docs-content :global(h3) {
		font-size: 15px;
		font-weight: 600;
		margin: 16px 0 6px 0;
	}
	.docs-content :global(p) {
		margin: 0 0 12px 0;
	}
	.docs-content :global(ul),
	.docs-content :global(ol) {
		margin: 0 0 12px 0;
		padding-left: 20px;
	}
	.docs-content :global(li) {
		margin: 0 0 4px 0;
	}
	.docs-content :global(code) {
		background: hsl(var(--muted, 0 0% 96%));
		padding: 2px 5px;
		border-radius: 4px;
		font-size: 13px;
	}
	.docs-content :global(pre) {
		background: hsl(var(--muted, 0 0% 96%));
		padding: 12px 16px;
		border-radius: 8px;
		overflow-x: auto;
		margin: 0 0 12px 0;
	}
	.docs-content :global(pre code) {
		background: none;
		padding: 0;
	}
	.docs-content :global(blockquote) {
		border-left: 3px solid hsl(var(--border, 0 0% 85%));
		margin: 0 0 12px 0;
		padding: 4px 16px;
		color: hsl(var(--muted-foreground, 0 0% 45%));
	}
	.docs-content :global(.katex-display) {
		margin: 16px 0;
		overflow-x: auto;
	}
	.docs-content :global(table) {
		border-collapse: collapse;
		width: 100%;
		margin: 0 0 12px 0;
	}
	.docs-content :global(th),
	.docs-content :global(td) {
		border: 1px solid hsl(var(--border, 0 0% 85%));
		padding: 6px 10px;
		text-align: left;
		font-size: 13px;
	}
	.docs-content :global(th) {
		background: hsl(var(--muted, 0 0% 96%));
		font-weight: 600;
	}
	.docs-content :global(hr) {
		border: none;
		border-top: 1px solid hsl(var(--border, 0 0% 85%));
		margin: 16px 0;
	}
</style>
