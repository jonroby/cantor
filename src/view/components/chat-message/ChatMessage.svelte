<script lang="ts">
	import DOMPurify from 'dompurify';
	import { GitFork, Trash2, Split, Code, Eye, ClipboardCopy, FileText, ArrowUp } from 'lucide-svelte';
	import { PROVIDER_LOGOS } from '@/view/assets';
	import { Button } from '@/view/primitives';
	import { renderMarkdownKatexBlocks, renderRichText } from '@/view/lib/katex';
	import type { ChatCardData } from '@/view/components/chat-card';

	let { data }: { data: ChatCardData } = $props();

	let promptHtml = $derived(DOMPurify.sanitize(renderRichText(data.prompt)));
	let responseBlocks = $derived(
		!data.isStreaming
			? renderMarkdownKatexBlocks(data.response).map((block) => ({
					source: block.source,
					html: DOMPurify.sanitize(block.html)
				}))
			: []
	);

	let selectionAnchor: number | null = $state(null);
	let selectionHead: number | null = $state(null);
	let contextMenu: { x: number; y: number } | null = $state(null);

	let selectionRange = $derived.by(() => {
		if (selectionAnchor === null) return null;
		const head = selectionHead ?? selectionAnchor;
		return { start: Math.min(selectionAnchor, head), end: Math.max(selectionAnchor, head) };
	});

	function isBlockSelected(index: number): boolean {
		if (!selectionRange) return false;
		return index >= selectionRange.start && index <= selectionRange.end;
	}

	function handleBlockMouseDown(event: MouseEvent, index: number) {
		if (!data.canQuickAsk) return;
		event.stopPropagation(); // prevent parent closeContextMenu from clearing selection
		if (event.shiftKey && selectionAnchor !== null) {
			event.preventDefault(); // prevent browser text selection
			selectionHead = index;
		} else if (event.button === 0) {
			selectionAnchor = index;
			selectionHead = null;
		}
	}

	function handleBlockContextMenu(event: MouseEvent, index: number) {
		if (!data.canQuickAsk) return;
		event.preventDefault();
		// If right-clicking outside current selection, select just this block
		if (!isBlockSelected(index)) {
			selectionAnchor = index;
			selectionHead = null;
		}
		contextMenu = { x: event.clientX, y: event.clientY };
	}

	function getSelectedSource(): string {
		if (!selectionRange) return '';
		return responseBlocks
			.slice(selectionRange.start, selectionRange.end + 1)
			.map((b) => b.source)
			.join('\n\n');
	}

	function handleQuickAsk() {
		const source = getSelectedSource();
		if (source) data.onQuickAsk(source);
		closeContextMenu();
	}

	function handleQuickAdd() {
		const source = getSelectedSource();
		if (source) data.onQuickAdd(source);
		closeContextMenu();
	}

	function closeContextMenu() {
		contextMenu = null;
		selectionAnchor = null;
		selectionHead = null;
	}

	let showSource = $state(false);
</script>

<div class="chatmsg" class:chatmsg-doc-upload={data.label}>
	{#if data.label}
		<div class="chatmsg-doc-label">
			<FileText size={16} class="shrink-0" />
			<span>{data.label}</span>
		</div>
	{:else}
		<div class="chatmsg-prompt-row">
			<div class="chatmsg-prompt">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- Sanitized by DOMPurify -->
				{@html promptHtml}
			</div>
		</div>

		<div class="chatmsg-response">
			<div class="chatmsg-response-header">
				{#if data.provider && PROVIDER_LOGOS[data.provider]}
					<img
						src={PROVIDER_LOGOS[data.provider]}
						alt={data.provider}
						class="chatmsg-provider-logo"
					/>
				{/if}
				{#if data.model}
					<span class="chatmsg-model">{data.model}</span>
				{/if}
			</div>
			{#if data.isStreaming && !data.response}
				<div class="chatmsg-response-body docs-streaming-text">Waiting for response…</div>
			{:else if data.isStreaming && data.response}
				<div class="chatmsg-response-body docs-streaming-text">{data.response.trimStart()}</div>
			{:else if responseBlocks.length > 0}
				{#if showSource}
					<pre class="chatmsg-response-body chatmsg-response-source">{data.response}</pre>
				{:else}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="chatmsg-response-body" onmousedown={closeContextMenu}>
						{#each responseBlocks as block, i (i)}
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								class="chatmsg-block"
								class:chatmsg-block-askable={data.canQuickAsk}
								class:chatmsg-block-selected={isBlockSelected(i)}
								onmousedown={(e) => handleBlockMouseDown(e, i)}
								oncontextmenu={(e) => handleBlockContextMenu(e, i)}
							>
								<!-- eslint-disable-next-line svelte/no-at-html-tags -- Sanitized by DOMPurify -->
								{@html block.html}
							</div>
						{/each}
					</div>
				{/if}
			{:else if data.response}
				<div class="chatmsg-response-body chatmsg-response-plain">{data.response}</div>
			{:else if !data.isStreaming}
				<div class="chatmsg-response-body chatmsg-response-plain">Cancelled</div>
			{/if}
		</div>
	{/if}

	{#if !data.isStreaming}
		<div class="chatmsg-toolbar">
			<div class="chatmsg-actions">
				<span class="action-tip-wrap">
					<Button
						class="icon-chip delete-chip"
						variant="ghost"
						size="icon"
						onclick={(event: MouseEvent) => {
							event.stopPropagation();
							data.onDelete();
						}}
						ariaLabel="Delete"
					>
						<Trash2 size={15} />
					</Button>
					<span class="action-tip">Delete</span>
				</span>
				<span class="action-tip-wrap">
					<Button
						class="icon-chip"
						variant="ghost"
						size="icon"
						onclick={(event: MouseEvent) => {
							event.stopPropagation();
							data.onCopy();
						}}
						ariaLabel="Copy"
					>
						<GitFork size={15} />
					</Button>
					<span class="action-tip">Copy</span>
				</span>
				{#if data.isSideRoot}
					<span class="action-tip-wrap">
						<Button
							class="icon-chip"
							variant="ghost"
							size="icon"
							disabled={!data.canPromote}
							onclick={(event: MouseEvent) => {
								event.stopPropagation();
								data.onPromote();
							}}
							ariaLabel="Promote"
						>
							<ArrowUp size={14} />
						</Button>
						<span class="action-tip">Promote</span>
					</span>
				{/if}
				{#if responseBlocks.length > 0}
					<span class="action-tip-wrap">
						<Button
							class="icon-chip"
							variant="ghost"
							size="icon"
							onclick={(event: MouseEvent) => {
								event.stopPropagation();
								showSource = !showSource;
							}}
							ariaLabel={showSource ? 'Show rendered' : 'Show source'}
						>
							{#if showSource}
								<Eye size={15} />
							{:else}
								<Code size={15} />
							{/if}
						</Button>
						<span class="action-tip">{showSource ? 'Rendered' : 'Source'}</span>
					</span>
					<span class="action-tip-wrap">
						<Button
							class="icon-chip"
							variant="ghost"
							size="icon"
							onclick={(event: MouseEvent) => {
								event.stopPropagation();
								navigator.clipboard.writeText(data.response);
							}}
							ariaLabel="Copy text"
						>
							<ClipboardCopy size={15} />
						</Button>
						<span class="action-tip">Copy text</span>
					</span>
				{/if}
			</div>
			{#if !data.isSideRoot}
				{#if data.hasSideChildren}
					<button
						class="chatmsg-side-chat-badge"
						type="button"
						onclick={(event: MouseEvent) => {
							event.stopPropagation();
							data.onToggleSideChildren();
						}}
					>
						<span style="display:inline-flex;transform:scaleY(-1)"><Split size={15} /></span>
						<span>{data.sideChildrenCount}</span>
					</button>
				{:else}
					<span class="action-tip-wrap">
						<Button
							class="icon-chip"
							variant="ghost"
							size="icon"
							disabled={!data.canCreateSideChat}
							onclick={(event: MouseEvent) => {
								event.stopPropagation();
								data.onToggleSideChildren();
							}}
							ariaLabel="Side chat"
						>
							<span style="display:inline-flex;transform:scaleY(-1)"><Split size={15} /></span>
						</Button>
						<span class="action-tip">Side chat</span>
					</span>
				{/if}
			{/if}
		</div>
	{/if}
</div>

{#if contextMenu}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="chatmsg-context-scrim" onmousedown={closeContextMenu}></div>
	<div class="chatmsg-context-menu" style="left: {contextMenu.x}px; top: {contextMenu.y}px;">
		<button type="button" class="chatmsg-context-item" onclick={handleQuickAsk}> Quick Ask </button>
		{#if data.canQuickAdd}
			<button type="button" class="chatmsg-context-item" onclick={handleQuickAdd}>
				Quick Add
			</button>
		{/if}
	</div>
{/if}

<style>
	.chatmsg {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		border-radius: 0.5rem;
		padding-top: 0.5rem;
	}

	/* doc-upload variant */
	.chatmsg-doc-upload {
		gap: 0;
		padding: 0.75rem 0;
	}

	.chatmsg-doc-label {
		display: flex;
		width: fit-content;
		align-items: center;
		gap: 0.5rem;
		border-radius: 0.5rem;
		background: hsl(var(--foreground) / 0.05);
		padding: 0.5rem 0.75rem;
		font-size: var(--text-base);
		color: hsl(var(--foreground) / 0.6);
	}

	.chatmsg-prompt-row {
		display: flex;
		justify-content: flex-end;
	}

	.chatmsg-prompt {
		max-width: 85%;
		border-radius: 0.75rem;
		background: hsl(var(--secondary));
		padding: 0.75rem 1rem;
		font-size: var(--text-sm);
		line-height: 1.55;
		word-break: break-word;
	}

	.chatmsg-response {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.chatmsg-response-header {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: var(--text-sm);
		font-weight: var(--font-weight-semibold);
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: hsl(var(--muted-foreground));
	}

	.chatmsg-provider-logo {
		height: 1.15rem;
		width: 1.15rem;
		object-fit: contain;
	}

	.chatmsg-model {
		font-weight: var(--font-weight-normal);
		letter-spacing: normal;
		text-transform: none;
	}

	.chatmsg-block {
		position: relative;
		margin: 0 -0.5rem;
		border-radius: 0.75rem;
		padding: 0.15rem 0.5rem;
		transition:
			background 150ms ease,
			border-color 150ms ease;
	}

	.chatmsg-block:first-child {
		padding-top: 0;
	}

	.chatmsg-block:last-child {
		padding-bottom: 0;
	}

	/* askable block hover/selected */
	.chatmsg-block-askable:hover,
	.chatmsg-block-selected {
		background: var(--surface-tint);
	}

	.chatmsg-response-source {
		margin: 0;
		border-radius: 0.5rem;
		background: hsl(var(--muted) / 0.4);
		padding: 0.75rem;
		font-size: 0.85em;
		line-height: 1.6;
		font-family: var(--font-mono, ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace);
		white-space: pre-wrap;
		color: hsl(var(--foreground) / 0.85);
	}

	.chatmsg-response-plain {
		white-space: pre-wrap;
	}

	.chatmsg-toolbar {
		display: flex;
		min-height: 1.9rem;
		align-items: center;
		justify-content: flex-end;
		gap: 0.35rem;
	}

	.chatmsg-actions {
		display: flex;
		gap: 0.2rem;
	}

	.chatmsg-side-chat-badge {
		display: flex;
		cursor: pointer;
		align-items: center;
		gap: 0.3rem;
		border-radius: 999px;
		border: 1px solid var(--border-color);
		background: transparent;
		padding: 0.25rem 0.5rem;
		font-size: var(--text-sm);
		color: var(--icon-muted);
		transition:
			background 120ms ease,
			color 120ms ease;
	}

	.chatmsg-side-chat-badge:hover {
		background: var(--surface-tint);
		color: var(--icon-strong);
	}

	.chatmsg-context-scrim {
		position: fixed;
		inset: 0;
		z-index: 999;
	}

	.chatmsg-context-menu {
		position: fixed;
		z-index: 1000;
		min-width: 160px;
		border-radius: 0.5rem;
		border: 1px solid var(--border-color);
		background: var(--surface-floating);
		padding: 0.25rem;
		box-shadow: var(--surface-floating-shadow);
	}

	.chatmsg-context-item {
		display: block;
		width: 100%;
		cursor: pointer;
		border-radius: 0.35rem;
		border: none;
		background: transparent;
		padding: 0.45rem 0.75rem;
		text-align: left;
		font-size: var(--text-base);
		color: hsl(var(--popover-foreground));
	}

	.chatmsg-context-item:hover {
		background: var(--surface-tint);
		color: hsl(var(--accent-foreground));
	}

	/* icon-chip colors — passed as class prop to Button, must be :global() */
	:global(.icon-chip) {
		color: var(--icon-muted);
	}

	:global(.icon-chip:hover) {
		color: var(--icon-strong);
		background: var(--surface-tint);
	}

	/* prompt paragraph margins — rendered via {@html}, must be :global() */
	:global(.chatmsg-response-body p) {
		margin: 0.75em 0;
	}

	:global(.chatmsg-response-body p:first-child),
	:global(.chatmsg-response-body .chatmsg-block:first-child p:first-child) {
		margin-top: 0;
	}

	:global(.chatmsg-response-body p:last-child),
	:global(.chatmsg-response-body .chatmsg-block:last-child p:last-child) {
		margin-bottom: 0;
	}

	/* Markdown headings — rendered HTML, must be :global() */
	:global(.chatmsg-response-body h1),
	:global(.chatmsg-response-body h2),
	:global(.chatmsg-response-body h3),
	:global(.chatmsg-response-body h4),
	:global(.chatmsg-response-body h5),
	:global(.chatmsg-response-body h6) {
		margin: 1.25em 0 0.5em;
		font-weight: var(--font-weight-bold);
		line-height: 1.3;
		color: hsl(var(--foreground));
	}

	:global(.chatmsg-response-body h1:first-child),
	:global(.chatmsg-response-body h2:first-child),
	:global(.chatmsg-response-body h3:first-child) {
		margin-top: 0;
	}

	:global(.chatmsg-response-body h1) {
		font-size: 1.35em;
	}

	:global(.chatmsg-response-body h2) {
		font-size: 1.2em;
	}

	:global(.chatmsg-response-body h3) {
		font-size: 1.08em;
	}

	:global(.chatmsg-response-body h4) {
		font-size: 1em;
	}

	:global(.chatmsg-response-body strong) {
		font-weight: var(--font-weight-bold);
	}

	:global(.chatmsg-response-body ul),
	:global(.chatmsg-response-body ol) {
		margin: 0.75em 0;
		padding-left: 1.5em;
	}

	:global(.chatmsg-response-body li) {
		margin: 0.4em 0;
	}

	:global(.chatmsg-response-body li > ul),
	:global(.chatmsg-response-body li > ol) {
		margin: 0.25em 0;
	}

	:global(.chatmsg-response-body blockquote) {
		margin: 0.75em 0;
		padding: 0.5em 1em;
		border-left: 3px solid var(--border-color);
		color: hsl(var(--muted-foreground));
	}

	:global(.chatmsg-response-body hr) {
		margin: 1.25em 0;
		border: none;
		border-top: 1px solid var(--border-color);
	}

	:global(.chatmsg-response-body pre) {
		margin: 1em 0;
		padding: 0.85em 1em;
		border-radius: 0.5rem;
		background: hsl(var(--muted) / 0.5);
		overflow-x: auto;
		font-size: 0.85em;
	}

	:global(.chatmsg-response-body code) {
		padding: 0.15em 0.35em;
		border-radius: 0.25rem;
		background: hsl(var(--muted) / 0.5);
		font-size: 0.88em;
	}

	:global(.chatmsg-response-body pre code) {
		padding: 0;
		background: none;
	}

	:global(.chatmsg-response-body .katex-display) {
		margin: 0.5em 0;
		padding: 0.4em 0;
		overflow-x: auto;
	}

	:global(.chatmsg-response-body .katex) {
		font-size: var(--text-xl);
		line-height: normal;
	}
</style>
