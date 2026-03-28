<script lang="ts">
	import DOMPurify from 'dompurify';
	import Button from '@/view/components/custom/button.svelte';
	import { renderRichText } from '@/view/shared/katex';
	import { mapDocument } from '@/domain/document-map/index';
	import { PROVIDER_LOGOS } from '@/domain/models/logos';
	import type { ExchangeNodeData } from '@/app/types';

	let { data }: { data: ExchangeNodeData } = $props();

	let promptHtml = $derived(DOMPurify.sanitize(renderRichText(data.prompt)));
	let responseBlocks = $derived(
		!data.isStreaming
			? mapDocument(data.response).map((block) => ({
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
				{#if data.isStreaming}
					<div class="streaming-dot"></div>
				{/if}
				{#if responseBlocks.length > 0}
					<button
						type="button"
						class="chatmsg-source-toggle"
						onclick={() => (showSource = !showSource)}
						aria-label={showSource ? 'Show rendered' : 'Show source'}
					>
						{#if showSource}
							<svg
								width="14"
								height="14"
								viewBox="0 0 14 14"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
							>
								<path d="M1.5 7c0-2.5 2.5-5 5.5-5s5.5 2.5 5.5 5-2.5 5-5.5 5-5.5-2.5-5.5-5z" />
								<circle cx="7" cy="7" r="2" />
							</svg>
						{:else}
							<svg
								width="14"
								height="14"
								viewBox="0 0 14 14"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
							>
								<path
									d="M4.5 2.5l-2 3L4.5 8.5M9.5 2.5l2 3-2 3"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
						{/if}
					</button>
				{/if}
			</div>
			{#if responseBlocks.length > 0}
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
			{:else}
				<div class="chatmsg-response-body chatmsg-response-plain">
					{data.response || (data.isStreaming ? 'Waiting for response…' : 'Cancelled')}
				</div>
			{/if}
		</div>
	{/if}

	<div class="chatmsg-toolbar">
		<div class="chatmsg-actions">
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
					<svg
						width="14"
						height="14"
						viewBox="0 0 14 14"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"><path d="M7 2v10M2 7h10" stroke-linecap="round" /></svg
					>
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
					<svg
						width="14"
						height="14"
						viewBox="0 0 14 14"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						><path
							d="M3.5 4.5h7M5.5 4.5v6M8.5 4.5v6M4.5 4.5l.4-1.2A1 1 0 0 1 5.85 2.6h2.3a1 1 0 0 1 .95.7l.4 1.2M4.5 4.5v6.8c0 .39.31.7.7.7h3.6a.7.7 0 0 0 .7-.7V4.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						/></svg
					>
				</Button>
				<span class="action-tip">Delete</span>
			</span>
		</div>
		{#if !data.isSideRoot}
			{#if data.hasSideChildren}
				<button
					class="chatmsg-branch-badge"
					type="button"
					onclick={(event: MouseEvent) => {
						event.stopPropagation();
						data.onToggleSideChildren();
					}}
				>
					<svg
						width="14"
						height="14"
						viewBox="0 0 14 14"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						><path
							d="M3 3v8M3 7h4M7 7v4M7 7h4"
							stroke-linecap="round"
							stroke-linejoin="round"
						/></svg
					>
					<span>{data.sideChildrenCount}</span>
				</button>
			{:else}
				<span class="action-tip-wrap chatmsg-branch-action">
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
						<svg
							width="14"
							height="14"
							viewBox="0 0 14 14"
							fill="none"
							stroke="currentColor"
							stroke-width="1.5"
							><path
								d="M3 3v8M3 7h4M7 7v4M7 7h4"
								stroke-linecap="round"
								stroke-linejoin="round"
							/></svg
						>
					</Button>
					<span class="action-tip">Side chat</span>
				</span>
			{/if}
		{/if}
	</div>
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
