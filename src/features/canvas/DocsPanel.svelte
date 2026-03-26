<script lang="ts">
	import { onMount } from 'svelte';
	import { Marked } from 'marked';
	import katex from 'katex';
	import DOMPurify from 'dompurify';
	import { validate as validateMd } from '@/lib/validate-md';

	interface Props {
		title?: string;
		content: string;
		onContentChange?: (content: string) => void;
		onClose?: () => void;
	}

	let { title, content, onContentChange, onClose }: Props = $props();

	let showCloseConfirm = $state(false);

	function requestClose() {
		if (dirty) {
			showCloseConfirm = true;
		} else {
			onClose?.();
		}
	}

	function confirmClose() {
		showCloseConfirm = false;
		onClose?.();
	}

	function cancelClose() {
		showCloseConfirm = false;
	}

	const marked = new Marked({
		breaks: true,
		gfm: true
	});

	let editing = $state(false);
	let draft = $state('');
	let error: string | null = $state(null);

	let dirty = $derived(!!draft && draft !== content);

	function renderKatex(tex: string, displayMode: boolean): string {
		try {
			return katex.renderToString(tex, {
				displayMode,
				throwOnError: true,
				output: 'html'
			});
		} catch {
			throw new Error(`Invalid math expression: ${tex}`);
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

	function validate(md: string): string | null {
		const errors = validateMd(md);
		if (errors.length > 0) return errors.join('; ');
		try {
			processContent(md);
			return null;
		} catch (e) {
			return e instanceof Error ? e.message : 'Invalid markdown content';
		}
	}

	let renderedHtml = $derived(DOMPurify.sanitize(processContentSafe(content)));

	function processContentSafe(md: string): string {
		try {
			return processContent(md);
		} catch {
			return `<p style="color: red;">Render error</p>`;
		}
	}

	function enterEditMode() {
		if (!draft) draft = content;
		error = null;
		editing = true;
	}

	function cancelEdit() {
		editing = false;
		error = null;
	}

	function revertToSaved() {
		draft = content;
		error = null;
	}

	function saveEdit() {
		const validationError = validate(draft);
		if (validationError) {
			error = validationError;
			return;
		}
		error = null;
		onContentChange?.(draft);
		draft = '';
		editing = false;
	}

	function downloadMarkdown() {
		const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'document.md';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		setTimeout(() => URL.revokeObjectURL(url), 100);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			cancelEdit();
		} else if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			saveEdit();
		}
	}

	let draggingOver = $state(false);

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
		draggingOver = true;
	}

	function handleDragLeave(e: DragEvent) {
		const panel = e.currentTarget as HTMLElement;
		if (e.relatedTarget && panel.contains(e.relatedTarget as Node)) return;
		draggingOver = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		draggingOver = false;
		const file = e.dataTransfer?.files?.[0];
		if (!file || !file.name.endsWith('.md')) return;
		const reader = new FileReader();
		reader.onload = () => {
			if (typeof reader.result === 'string') {
				onContentChange?.(reader.result);
			}
		};
		reader.readAsText(file);
	}

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

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="docs-panel"
	class:drag-over={draggingOver}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	onwheel={(e) => e.stopPropagation()}
>
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
		<span>{title || 'Document'}</span>
		{#if dirty}
			<span class="dirty-indicator" title="Unsaved changes">&bull;</span>
		{/if}
		<div class="header-actions">
			{#if onClose}
				<button class="header-btn" onclick={requestClose} title="Close">
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
					>
						<path d="M18 6L6 18M6 6l12 12" />
					</svg>
				</button>
			{/if}
			<button class="header-btn" onclick={downloadMarkdown} title="Download as Markdown">
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
					<polyline points="7 10 12 15 17 10" />
					<line x1="12" y1="15" x2="12" y2="3" />
				</svg>
			</button>
			{#if editing}
				{#if dirty}
					<button class="header-btn" onclick={revertToSaved} title="Revert to saved">
						<svg
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<polyline points="1 4 1 10 7 10" />
							<path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
						</svg>
					</button>
				{/if}
				<button class="header-btn" onclick={cancelEdit} title="Done (Esc)">
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M5 12l5 5L20 7" />
					</svg>
				</button>
				<button class="header-btn save-btn" onclick={saveEdit} title="Save (⌘S)">
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
						<polyline points="17 21 17 13 7 13 7 21" />
						<polyline points="7 3 7 8 15 8" />
					</svg>
				</button>
			{:else}
				<button class="header-btn" onclick={enterEditMode} title="Edit">
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M12 20h9" />
						<path
							d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"
						/>
					</svg>
				</button>
			{/if}
		</div>
	</div>
	{#if error}
		<div class="error-bar">{error}</div>
	{/if}
	{#if editing}
		<textarea class="docs-editor" bind:value={draft} onkeydown={handleKeydown} spellcheck="false"
		></textarea>
	{:else}
		<div class="docs-content">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- Sanitized by DOMPurify -->
			{@html renderedHtml}
		</div>
	{/if}
	{#if showCloseConfirm}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="close-confirm-overlay" onclick={cancelClose}>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="close-confirm-dialog" onclick={(e) => e.stopPropagation()}>
				<p>You have unsaved changes. Discard them?</p>
				<div class="close-confirm-actions">
					<button class="confirm-btn cancel" onclick={cancelClose}>Cancel</button>
					<button class="confirm-btn discard" onclick={confirmClose}>Discard</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.docs-panel {
		background: hsl(var(--card, 0 0% 100%));
		border: 1px solid hsl(var(--border, 0 0% 85%));
		border-radius: 12px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		width: 816px;
		height: 1056px;
	}
	.docs-panel.drag-over {
		outline: 2px dashed hsl(var(--primary, 220 90% 56%));
		outline-offset: -4px;
		background: hsl(var(--primary, 220 90% 56%) / 0.04);
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

	.dirty-indicator {
		color: hsl(var(--primary, 220 90% 56%));
		font-size: 20px;
		line-height: 1;
		margin-left: -4px;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-left: auto;
	}

	.header-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 6px;
		border: none;
		background: transparent;
		color: hsl(var(--muted-foreground, 0 0% 45%));
		cursor: pointer;
		transition:
			background 0.15s,
			color 0.15s;
	}
	.header-btn:hover {
		background: hsl(var(--muted, 0 0% 96%));
		color: hsl(var(--foreground, 0 0% 9%));
	}

	.save-btn {
		color: hsl(var(--primary, 220 90% 56%));
	}
	.save-btn:hover {
		background: hsl(var(--primary, 220 90% 56%) / 0.1);
		color: hsl(var(--primary, 220 90% 56%));
	}

	.error-bar {
		padding: 8px 16px;
		background: hsl(0 72% 51% / 0.1);
		color: hsl(0 72% 51%);
		font-size: 12px;
		border-bottom: 1px solid hsl(0 72% 51% / 0.2);
		flex-shrink: 0;
	}

	.docs-editor {
		flex: 1;
		padding: 16px 20px;
		border: none;
		outline: none;
		resize: none;
		font-family: 'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Consolas, monospace;
		font-size: 13px;
		line-height: 1.6;
		color: hsl(var(--foreground, 0 0% 9%));
		background: hsl(var(--card, 0 0% 100%));
		overflow-y: auto;
		tab-size: 2;
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

	.close-confirm-overlay {
		position: absolute;
		inset: 0;
		background: hsl(0 0% 0% / 0.3);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10;
		border-radius: 12px;
	}

	.close-confirm-dialog {
		background: hsl(var(--card, 0 0% 100%));
		border: 1px solid hsl(var(--border, 0 0% 85%));
		border-radius: 10px;
		padding: 20px 24px;
		box-shadow: 0 8px 24px hsl(0 0% 0% / 0.15);
		max-width: 300px;
	}

	.close-confirm-dialog p {
		margin: 0 0 16px 0;
		font-size: 14px;
		color: hsl(var(--foreground, 0 0% 9%));
	}

	.close-confirm-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}

	.confirm-btn {
		padding: 6px 14px;
		border-radius: 6px;
		border: 1px solid hsl(var(--border, 0 0% 85%));
		font-size: 13px;
		cursor: pointer;
		transition:
			background 0.15s,
			color 0.15s;
	}

	.confirm-btn.cancel {
		background: transparent;
		color: hsl(var(--foreground, 0 0% 9%));
	}
	.confirm-btn.cancel:hover {
		background: hsl(var(--muted, 0 0% 96%));
	}

	.confirm-btn.discard {
		background: hsl(0 72% 51%);
		color: white;
		border-color: hsl(0 72% 51%);
	}
	.confirm-btn.discard:hover {
		background: hsl(0 72% 45%);
	}
</style>
