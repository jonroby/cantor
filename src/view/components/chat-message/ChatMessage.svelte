<script lang="ts">
	import DOMPurify from 'dompurify';
	import { GitFork, Trash2, Split, Code, Eye, ClipboardCopy } from 'lucide-svelte';
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
			<svg
				width="16"
				height="16"
				viewBox="0 0 16 16"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				class="shrink-0"
			>
				<path d="M3 2h7l3 3v9H3V2z" />
				<path d="M10 2v3h3" />
			</svg>
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
							<svg
								width="14"
								height="14"
								viewBox="0 0 14 14"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
								><path
									d="M7 12V2M7 2l-2 2M7 2l2 2"
									stroke-linecap="round"
									stroke-linejoin="round"
								/></svg
							>
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
					<span class="action-tip-wrap chatmsg-side-chat-action">
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
		padding: 0.5rem 0 0 0;
		border-radius: 0.5rem;
	}

	.chatmsg-doc-upload {
		gap: 0;
		padding: 0.75rem 0;
	}

	.chatmsg-doc-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		background: hsl(var(--foreground) / 0.05);
		color: hsl(var(--foreground) / 0.6);
		font-size: var(--text-base);
		width: fit-content;
	}

	.chatmsg-toolbar {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.35rem;
		min-height: 1.9rem;
	}

	.chatmsg-side-chat-badge {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.25rem 0.5rem;
		border: 1px solid hsl(var(--foreground) / 0.25);
		border-radius: var(--radius-full);
		background: transparent;
		color: hsl(var(--foreground) / 0.7);
		font-size: var(--text-sm);
		cursor: pointer;
		transition:
			background var(--duration-fast) ease,
			color var(--duration-fast) ease;
	}

	.chatmsg-side-chat-badge:hover {
		background: hsl(var(--foreground) / 0.1);
		color: hsl(var(--foreground));
	}

	.chatmsg-actions {
		display: flex;
		gap: 0.2rem;
	}

	.chatmsg :global(.icon-chip) {
		color: hsl(var(--foreground) / 0.5);
	}

	.chatmsg :global(.icon-chip:hover) {
		color: hsl(var(--foreground));
		background: hsl(var(--foreground) / 0.1);
	}

	.chatmsg-prompt-row {
		display: flex;
		justify-content: flex-end;
	}

	.chatmsg-prompt {
		max-width: 85%;
		padding: 0.75rem 1rem;
		border-radius: 0.75rem;
		background: hsl(0 0% 92%);
		font-size: 0.95rem;
		line-height: 1.55;
		word-break: break-word;
	}

	.chatmsg-prompt :global(p) {
		margin: 0.25em 0;
	}

	.chatmsg-prompt :global(p:first-child) {
		margin-top: 0;
	}

	.chatmsg-prompt :global(p:last-child) {
		margin-bottom: 0;
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
		font-weight: 600;
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
		font-weight: 400;
		letter-spacing: 0;
		text-transform: none;
	}

	.chatmsg-response-plain {
		white-space: pre-wrap;
	}

	.chatmsg-response-source {
		white-space: pre-wrap;
		font-family: var(--font-mono, ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace);
		font-size: 0.85rem;
		line-height: 1.6;
		padding: 0.75rem;
		margin: 0;
		border-radius: 0.5rem;
		background: hsl(var(--muted) / 0.4);
		color: hsl(var(--foreground) / 0.85);
	}

	.chatmsg-block {
		position: relative;
		padding: 0.15rem 0.5rem;
		margin: 0 -0.5rem;
		border-radius: 0.75rem;
		transition:
			background var(--duration-normal) ease,
			border-color var(--duration-normal) ease;
	}

	.chatmsg-block:first-child {
		padding-top: 0;
	}

	.chatmsg-block:last-child {
		padding-bottom: 0;
	}

	.chatmsg-block-askable:hover,
	.chatmsg-block-selected {
		background: hsl(0 0% 92%);
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
		padding: 0.25rem;
		border: 1px solid hsl(var(--border));
		border-radius: 0.5rem;
		background: hsl(var(--popover));
		box-shadow: 0 4px 12px hsl(0 0% 0% / 0.15);
	}

	.chatmsg-context-item {
		display: block;
		width: 100%;
		padding: 0.45rem 0.75rem;
		border: none;
		border-radius: 0.35rem;
		background: transparent;
		color: hsl(var(--popover-foreground));
		font-size: var(--text-base);
		text-align: left;
		cursor: pointer;
	}

	.chatmsg-context-item:hover {
		background: hsl(var(--accent));
		color: hsl(var(--accent-foreground));
	}
</style>
