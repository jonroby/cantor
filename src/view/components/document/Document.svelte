<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { Marked } from 'marked';
	import katex from 'katex';
	import DOMPurify from 'dompurify';
	import { preprocessChartBlocks, mountCharts } from './charts';
	import {
		ArrowLeftRight,
		FileText,
		X,
		MessageSquare,
		Download,
		RotateCcw,
		Check,
		Save,
		Pencil
	} from 'lucide-svelte';
	import * as app from '@/app';
	import { PROVIDER_LOGOS } from '@/view/assets';
	import ConfirmDeleteDialog from '@/view/primitives/confirm-delete-dialog/ConfirmDeleteDialog.svelte';
	import { Header } from '@/view/primitives';

	interface Props {
		title?: string;
		content: string;
		agentStreaming?: boolean;
		agentProvider?: app.providers.Provider | null;
		pendingContent?: string | null;
		resolveAsset?: (name: string) => string | null;
		/** When true, fills its container (no fixed width/height, no border/radius) */
		embedded?: boolean;
		onContentChange?: (content: string) => void;
		onAcceptPending?: () => void;
		onRejectPending?: () => void;
		onClose?: () => void;
		onAddToChat?: () => void;
		onSwap?: () => void;
	}

	let {
		title,
		content,
		agentStreaming = false,
		agentProvider,
		pendingContent = null,
		resolveAsset,
		embedded = false,
		onContentChange,
		onAcceptPending,
		onRejectPending,
		onClose,
		onAddToChat,
		onSwap
	}: Props = $props();

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

	type DiffLineType = 'unchanged' | 'added' | 'removed';

	interface DiffLine {
		type: DiffLineType;
		text: string;
	}

	function diffLines(a: string, b: string): DiffLine[] {
		const aLines = a.split('\n');
		const bLines = b.split('\n');
		const lcs = longestCommonSubsequence(aLines, bLines);

		const result: DiffLine[] = [];
		let ai = 0;
		let bi = 0;

		for (const match of lcs) {
			while (ai < match.ai) {
				result.push({ type: 'removed', text: aLines[ai]! });
				ai++;
			}
			while (bi < match.bi) {
				result.push({ type: 'added', text: bLines[bi]! });
				bi++;
			}
			result.push({ type: 'unchanged', text: aLines[ai]! });
			ai++;
			bi++;
		}

		while (ai < aLines.length) {
			result.push({ type: 'removed', text: aLines[ai]! });
			ai++;
		}
		while (bi < bLines.length) {
			result.push({ type: 'added', text: bLines[bi]! });
			bi++;
		}

		return result;
	}

	interface LCSMatch {
		ai: number;
		bi: number;
	}

	function longestCommonSubsequence(a: string[], b: string[]): LCSMatch[] {
		const m = a.length;
		const n = b.length;
		const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[]);

		for (let i = m - 1; i >= 0; i--) {
			for (let j = n - 1; j >= 0; j--) {
				if (a[i] === b[j]) {
					dp[i]![j] = dp[i + 1]![j + 1]! + 1;
				} else {
					dp[i]![j] = Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
				}
			}
		}

		const matches: LCSMatch[] = [];
		let i = 0;
		let j = 0;
		while (i < m && j < n) {
			if (a[i] === b[j]) {
				matches.push({ ai: i, bi: j });
				i++;
				j++;
			} else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
				i++;
			} else {
				j++;
			}
		}

		return matches;
	}

	let pendingDiff = $derived(pendingContent !== null ? diffLines(content, pendingContent) : null);
	let contentEl: HTMLDivElement | null = $state(null);
	let contentScrollTimer: ReturnType<typeof setTimeout> | null = null;

	function handleContentScroll() {
		contentEl?.classList.add('is-scrolling');
		if (contentScrollTimer) clearTimeout(contentScrollTimer);
		contentScrollTimer = setTimeout(() => {
			contentEl?.classList.remove('is-scrolling');
		}, 1000);
	}

	$effect(() => {
		if (agentStreaming && contentEl) {
			tick().then(() => {
				contentEl?.scrollTo({ top: contentEl.scrollHeight, behavior: 'smooth' });
			});
		}
	});

	$effect(() => {
		void renderedHtml;
		if (!contentEl) return;
		tick().then(() => mountCharts(contentEl!));
	});

	const marked = new Marked({
		breaks: true,
		gfm: true
	});

	let editing = $state(false);
	let draft = $state('');
	let error: string | null = $state(null);

	let dirty = $derived(editing && draft !== content);

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
		// Resolve ![alt](file.svg) references to inline SVG content
		if (resolveAsset) {
			md = md.replace(/!\[([^\]]*)\]\(([^)]+\.svg)\)/gi, (_match, _alt, src) => {
				const name = src.replace(/^\.\//, '');
				const svgContent = resolveAsset(name);
				return svgContent ?? _match;
			});
		}

		md = preprocessChartBlocks(md, renderKatex);

		// Extract SVG blocks before marked mangles them with <p> tags
		const svgBlocks: string[] = [];
		md = md.replace(/<svg[\s\S]*?<\/svg>/gi, (match) => {
			const index = svgBlocks.length;
			svgBlocks.push(match);
			return `\n<p data-svg-placeholder="${index}"></p>\n`;
		});

		// Replace display math $$...$$ before marked processes it
		md = md.replace(/\$\$([\s\S]*?)\$\$/g, (_match, tex) => {
			return `<div class="katex-display">${renderKatex(tex.trim(), true)}</div>`;
		});

		// Replace inline math $...$  (not $$)
		md = md.replace(/(?<!\$)\$(?!\$)((?:[^$\\]|\\.)+?)\$/g, (_match, tex) => {
			return renderKatex(tex.trim(), false);
		});

		let html = marked.parse(md);
		if (typeof html !== 'string') return '';

		// Restore SVG blocks
		html = html.replace(
			/<p data-svg-placeholder="(\d+)"><\/p>/g,
			(_match, index) => svgBlocks[Number(index)] ?? ''
		);

		return html;
	}

	function validate(md: string): string | null {
		const errors = app.documents.validateDocumentMarkdown(md);
		if (errors.length > 0) return errors.join('; ');
		try {
			processContent(md);
			return null;
		} catch (e) {
			return e instanceof Error ? e.message : 'Invalid markdown content';
		}
	}

	let renderedHtml = $derived(
		DOMPurify.sanitize(processContentSafe(content), {
			USE_PROFILES: { html: true, svg: true },
			ADD_ATTR: ['data-plotly-id', 'data-plotly-config', 'data-fplot-id', 'data-fplot-config']
		})
	);

	function processContentSafe(md: string): string {
		try {
			return processContent(md);
		} catch {
			return `<p style="color: hsl(var(--destructive));">Render error</p>`;
		}
	}

	export function isEditing() {
		return editing;
	}

	export function isDirty() {
		return dirty;
	}

	export function enterEditMode() {
		if (!draft) draft = content;
		error = null;
		editing = true;
	}

	export function cancelEdit() {
		editing = false;
		error = null;
	}

	export function revertToSaved() {
		draft = content;
		error = null;
	}

	export function saveEdit() {
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

	export function downloadMarkdown() {
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
	class="document"
	class:drag-over={draggingOver}
	class:document-embedded={embedded}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	onwheel={(e) => e.stopPropagation()}
>
	{#if !embedded}
		<Header>
			<div class="docs-header-inner">
				<FileText size={16} />
				<span>{title || 'Document'}</span>
				{#if dirty}
					<span class="dirty-indicator" title="Unsaved changes">&bull;</span>
				{/if}
				<div class="header-actions">
					{#if pendingDiff}
						<button class="diff-btn diff-accept" onclick={onAcceptPending}>Accept</button>
						<button class="diff-btn diff-reject" onclick={onRejectPending}>Reject</button>
					{/if}
					{#if onSwap}
						<button class="header-btn" onclick={onSwap} title="Swap panels">
							<ArrowLeftRight size={14} />
						</button>
					{/if}
					{#if onClose}
						<button class="header-btn" onclick={requestClose} title="Close">
							<X size={14} />
						</button>
					{/if}
					{#if onAddToChat}
						<button class="header-btn" onclick={onAddToChat} title="Add to chat">
							<MessageSquare size={14} />
						</button>
					{/if}
					<button class="header-btn" onclick={downloadMarkdown} title="Download as Markdown">
						<Download size={14} />
					</button>
					{#if editing}
						{#if dirty}
							<button class="header-btn" onclick={revertToSaved} title="Revert to saved">
								<RotateCcw size={14} />
							</button>
						{/if}
						<button class="header-btn" onclick={cancelEdit} title="Done (Esc)">
							<Check size={14} />
						</button>
						<button class="header-btn save-btn" onclick={saveEdit} title="Save (⌘S)">
							<Save size={14} />
						</button>
					{:else}
						<button class="header-btn" onclick={enterEditMode} title="Edit">
							<Pencil size={14} />
						</button>
					{/if}
				</div>
			</div>
		</Header>
	{/if}
	{#if error}
		<div class="error-bar">{error}</div>
	{/if}
	{#if pendingDiff}
		<div class="docs-diff panel-body" class:panel-body-embedded={embedded}>
			{#each pendingDiff as line, i (i)}
				<div
					class="diff-line"
					class:diff-added={line.type === 'added'}
					class:diff-removed={line.type === 'removed'}
				>
					{line.text || '\u00A0'}
				</div>
			{/each}
		</div>
	{:else if editing}
		<div class="docs-editor-wrap panel-body" class:panel-body-embedded={embedded}>
			<textarea class="docs-editor" bind:value={draft} onkeydown={handleKeydown} spellcheck="false"
			></textarea>
		</div>
	{:else}
		<div
			class="docs-content panel-body"
			class:panel-body-embedded={embedded}
			bind:this={contentEl}
			onscroll={handleContentScroll}
		>
			<div class="docs-content-inner">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- Sanitized by DOMPurify -->
				{@html renderedHtml}
			</div>
			{#if agentStreaming}
				<div class="docs-streaming">
					<div class="docs-streaming-inner">
						<div class="chatmsg-response-header">
							{#if agentProvider && PROVIDER_LOGOS[agentProvider]}
								<img
									src={PROVIDER_LOGOS[agentProvider]}
									alt={agentProvider}
									class="chatmsg-provider-logo"
								/>
							{/if}
							<span class="docs-streaming-text">Waiting for response…</span>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}
	<ConfirmDeleteDialog
		open={showCloseConfirm}
		title="Unsaved changes"
		description="You have unsaved changes. Discard them?"
		onConfirm={confirmClose}
		onCancel={cancelClose}
	/>
</div>

<style>
	.document {
		border: 1px solid var(--border-color);
		border-radius: 12px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		width: 816px;
		height: 1056px;
	}

	/* Fills the parent container — no fixed dimensions, no border/radius */
	.document-embedded {
		width: 100%;
		height: 100%;
		border: none;
		border-radius: 0;
	}

	.panel-body-embedded {
		padding-bottom: 12rem;
	}
	.document.drag-over {
		outline: 2px dashed hsl(var(--primary, 220 90% 56%));
		outline-offset: -4px;
		background: hsl(var(--primary, 220 90% 56%) / 0.04);
	}

	.docs-header-inner {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		max-width: var(--pane-content-width);
		margin: 0 auto;
	}

	.dirty-indicator {
		color: hsl(var(--primary, 220 90% 56%));
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
			background var(--duration-normal),
			color var(--duration-normal);
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
		border-bottom: 1px solid hsl(0 72% 51% / 0.2);
		flex-shrink: 0;
	}

	.docs-diff {
		flex: 1;
		overflow-y: auto;
		padding: 16px 20px;
		font-family: 'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Consolas, monospace;
		line-height: 1.6;
	}

	.diff-line {
		white-space: pre-wrap;
		padding: 0 4px;
		border-radius: 2px;
	}

	.diff-added {
		background: hsl(142 71% 45% / 0.15);
		color: hsl(142 71% 30%);
	}

	.diff-removed {
		background: hsl(0 72% 51% / 0.12);
		color: hsl(0 72% 40%);
		text-decoration: line-through;
	}

	.diff-btn {
		padding: 3px 10px;
		border-radius: 5px;
		border: none;
		font-weight: var(--font-weight-medium);
		cursor: pointer;
		transition:
			background var(--duration-fast) ease,
			color var(--duration-fast) ease;
	}

	.diff-accept {
		background: hsl(142 71% 45%);
		color: white;
	}
	.diff-accept:hover {
		background: hsl(142 71% 38%);
	}

	.diff-reject {
		background: hsl(var(--muted, 0 0% 96%));
		color: hsl(var(--foreground, 0 0% 9%));
	}
	.diff-reject:hover {
		background: hsl(var(--foreground) / 0.1);
	}

	.docs-streaming {
		margin-top: 16px;
	}

	.docs-streaming-inner {
		max-width: var(--pane-content-width);
		margin: 0 auto;
		padding-top: 16px;
		border-top: 1px solid var(--border-color);
	}

	.docs-editor-wrap {
		flex: 1;
		min-height: 0;
		display: flex;
		justify-content: center;
		padding-top: 16px;
		padding-bottom: 12rem;
		padding-left: var(--pane-padding-h);
		padding-right: var(--pane-padding-h);
		overflow-y: auto;
		overflow-x: hidden;
	}

	.docs-editor {
		width: 100%;
		max-width: var(--pane-content-width);
		min-height: 100%;
		border: none;
		outline: none;
		resize: none;
		font-family: 'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Consolas, monospace;
		line-height: 1.6;
		color: hsl(var(--foreground, 0 0% 9%));
		background: transparent;
		tab-size: 2;
	}

	.docs-content {
		flex: 1;
		min-height: 0;
		padding-top: 16px;
		padding-bottom: 12rem;
		padding-left: var(--pane-padding-h);
		padding-right: var(--pane-padding-h);
		overflow-y: auto;
		overflow-x: hidden;
		line-height: 1.7;
		color: hsl(var(--foreground, 0 0% 9%));
	}

	.docs-content-inner {
		max-width: var(--pane-content-width);
		margin: 0 auto;
	}

	.docs-content :global(h1) {
		font-size: 1.5em;
		font-weight: var(--font-weight-bold);
		margin: 0 0 12px 0;
		line-height: 1.3;
	}
	.docs-content :global(h2) {
		font-size: 1.25em;
		font-weight: var(--font-weight-semibold);
		margin: 20px 0 8px 0;
		line-height: 1.3;
	}
	.docs-content :global(h3) {
		font-size: 1.1em;
		font-weight: var(--font-weight-semibold);
		margin: 16px 0 6px 0;
	}
	.docs-content :global(p) {
		margin: 0 0 12px 0;
	}
	.docs-content :global(img) {
		max-width: 100%;
		height: auto;
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
		border-radius: var(--radius-sm);
	}
	.docs-content :global(pre) {
		background: hsl(var(--muted, 0 0% 96%));
		padding: 12px 16px;
		border-radius: var(--radius-md);
		overflow-x: auto;
		margin: 0 0 12px 0;
	}
	.docs-content :global(pre code) {
		background: none;
		padding: 0;
	}
	.docs-content :global(blockquote) {
		border-left: 3px solid var(--border-color);
		margin: 0 0 12px 0;
		padding: 4px 16px;
		color: hsl(var(--muted-foreground, 0 0% 45%));
	}
	.docs-content :global(.katex-display) {
		font-size: 1.03em;
		margin: 24px 0;
	}
	.docs-content :global(table) {
		border-collapse: collapse;
		width: 100%;
		margin: 0 0 12px 0;
	}
	.docs-content :global(th),
	.docs-content :global(td) {
		border: 1px solid var(--border-color);
		padding: 6px 10px;
		text-align: left;
	}
	.docs-content :global(th) {
		background: hsl(var(--muted, 0 0% 96%));
		font-weight: var(--font-weight-semibold);
	}
	.docs-content :global(hr) {
		border: none;
		border-top: 1px solid var(--border-color);
		margin: 16px 0;
	}

	.docs-content-inner :global(svg) {
		max-width: 100%;
		height: auto;
		display: block;
		margin: 16px auto;
		border: 1px solid var(--border-color);
		border-radius: 8px;
		background: hsl(var(--card));
	}
</style>
