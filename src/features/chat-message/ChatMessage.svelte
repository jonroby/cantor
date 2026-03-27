<script lang="ts">
	import DOMPurify from 'dompurify';
	import Button from '@/components/custom/button.svelte';
	import { renderRichText } from '@/features/canvas/katex';
	import { PROVIDER_LOGOS } from '@/lib/models/logos';
	import type { ExchangeNodeData } from '@/features/canvas/ExchangeNode.svelte';

	let { data }: { data: ExchangeNodeData } = $props();

	let promptHtml = $derived(DOMPurify.sanitize(renderRichText(data.prompt)));
	let responseHtml = $derived(
		!data.isStreaming ? DOMPurify.sanitize(renderRichText(data.response)) : ''
	);
</script>

<div
	class="chatmsg"
	class:chatmsg-active={data.isActive}
	role="button"
	tabindex="0"
	onclick={data.onSelect}
	onkeydown={(event) => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			data.onSelect();
		}
	}}
>
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
		</div>
		{#if responseHtml}
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- Sanitized by DOMPurify -->
			<div class="chatmsg-response-body">{@html responseHtml}</div>
		{:else}
			<div class="chatmsg-response-body chatmsg-response-plain">
				{data.response || (data.isStreaming ? 'Waiting for response…' : 'Cancelled')}
			</div>
		{/if}
	</div>

	<div class="chatmsg-toolbar">
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
		{/if}

		<div class="chatmsg-actions">
			{#if data.canFork}
				<span class="action-tip-wrap">
					<Button
						class="icon-chip"
						variant="ghost"
						size="icon"
						onclick={(event: MouseEvent) => {
							event.stopPropagation();
							data.onFork();
						}}
						ariaLabel="Fork"
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
					<span class="action-tip">Fork</span>
				</span>
			{/if}
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
	</div>
</div>
