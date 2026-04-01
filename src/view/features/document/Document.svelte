<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { Marked } from 'marked';
	import katex from 'katex';
	import DOMPurify from 'dompurify';
	import * as app from '@/app';
	import { PROVIDER_LOGOS } from '@/view/assets';
	import ConfirmDeleteDialog from '@/view/shared/ConfirmDeleteDialog.svelte';

	interface Props {
		title?: string;
		content: string;
		agentStreaming?: boolean;
		agentModel?: string;
		agentProvider?: app.providers.Provider | null;
		pendingContent?: string | null;
		onContentChange?: (content: string) => void;
		onAcceptPending?: () => void;
		onRejectPending?: () => void;
		onClose?: () => void;
		onAddToChat?: () => void;
	}

	let {
		title,
		content,
		agentStreaming = false,
		agentModel,
		agentProvider,
		pendingContent = null,
		onContentChange,
		onAcceptPending,
		onRejectPending,
		onClose,
		onAddToChat
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

	$effect(() => {
		if (agentStreaming && contentEl) {
			tick().then(() => {
				contentEl?.scrollTo({ top: contentEl.scrollHeight, behavior: 'smooth' });
			});
		}
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
		const errors = app.documents.validateDocumentMarkdown(md);
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
	class="document"
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
			{#if pendingDiff}
				<button class="diff-btn diff-accept" onclick={onAcceptPending}>Accept</button>
				<button class="diff-btn diff-reject" onclick={onRejectPending}>Reject</button>
			{/if}
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
			{#if onAddToChat}
				<button class="header-btn" onclick={onAddToChat} title="Add to chat">
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
						<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
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
	{#if pendingDiff}
		<div class="docs-diff panel-body">
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
		<textarea
			class="docs-editor panel-body"
			bind:value={draft}
			onkeydown={handleKeydown}
			spellcheck="false"
		></textarea>
	{:else}
		<div class="docs-content panel-body" bind:this={contentEl}>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- Sanitized by DOMPurify -->
			{@html renderedHtml}
			{#if agentStreaming}
				<div class="docs-streaming">
					<div class="chatmsg-response-header">
						{#if agentProvider && PROVIDER_LOGOS[agentProvider]}
							<img
								src={PROVIDER_LOGOS[agentProvider]}
								alt={agentProvider}
								class="chatmsg-provider-logo"
							/>
						{/if}
						{#if agentModel}
							<span class="chatmsg-model">{agentModel}</span>
						{/if}
						<div class="streaming-dot"></div>
					</div>
					<div class="chatmsg-response-body chatmsg-response-plain">Waiting for response…</div>
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
		background: hsl(var(--card, 0 0% 100%));
		border: 1px solid hsl(var(--border, 0 0% 85%));
		border-radius: 12px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		width: 816px;
		height: 1056px;
	}
	.document.drag-over {
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

	.docs-diff {
		flex: 1;
		overflow-y: auto;
		padding: 16px 20px;
		font-family: 'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Consolas, monospace;
		font-size: 13px;
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

	:global(.dark) .diff-added {
		background: hsl(142 71% 45% / 0.12);
		color: hsl(142 71% 65%);
	}

	.diff-removed {
		background: hsl(0 72% 51% / 0.12);
		color: hsl(0 72% 40%);
		text-decoration: line-through;
	}

	:global(.dark) .diff-removed {
		background: hsl(0 72% 51% / 0.1);
		color: hsl(0 72% 65%);
	}

	.diff-btn {
		padding: 3px 10px;
		border-radius: 5px;
		border: none;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition:
			background 120ms ease,
			color 120ms ease;
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
		padding-top: 16px;
		border-top: 1px solid hsl(var(--border, 0 0% 85%));
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
</style>
