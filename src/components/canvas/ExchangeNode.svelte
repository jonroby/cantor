<script lang="ts">
	import DOMPurify from 'dompurify';
	import Button from '@/components/ui/button.svelte';
	import type { Provider } from '@/lib/chat/models';
	import { renderRichText } from '@/lib/chat/katex';
	import { PROVIDER_LOGOS } from '@/lib/chat/logos';

	export interface ExchangeNodeData {
		prompt: string;
		response: string;
		model?: string;
		provider?: Provider | null;
		isActive: boolean;
		isStreaming: boolean;
		canFork: boolean;
		hasSideChildren: boolean;
		isSideRoot: boolean;
		canPromote: boolean;
		onMeasure: (height: number) => void;
		onSelect: () => void;
		onFork: () => void;
		onToggleSideChildren: () => void;
		onPromote: () => void;
		onDelete: () => void;
	}

	let { data }: { data: ExchangeNodeData } = $props();
	let cardElement: HTMLDivElement | null = $state(null);
	let collapsed = $state(false);

	// Render rich text (math + bold/italic) only after streaming is complete.
	let promptHtml = $derived(DOMPurify.sanitize(renderRichText(data.prompt)));
	let responseHtml = $derived(
		!data.isStreaming ? DOMPurify.sanitize(renderRichText(data.response)) : ''
	);

	$effect(() => {
		if (!cardElement || typeof ResizeObserver === 'undefined') return;

		const reportHeight = () => {
			const nextHeight = Math.ceil(cardElement?.offsetHeight ?? 0);
			if (nextHeight > 0) {
				data.onMeasure(nextHeight);
			}
		};

		reportHeight();
		const observer = new ResizeObserver(() => reportHeight());
		observer.observe(cardElement);

		return () => {
			observer.disconnect();
		};
	});
</script>

<div
	bind:this={cardElement}
	class:active-node={data.isActive}
	class="exchange-card flow-node-card"
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
	<div class="exchange-actions">
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
		{#if data.hasSideChildren}
			<span class="action-tip-wrap">
				<Button
					class="icon-chip"
					variant="ghost"
					size="icon"
					onclick={(event: MouseEvent) => {
						event.stopPropagation();
						data.onToggleSideChildren();
					}}
					ariaLabel="Side chats"
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
				<span class="action-tip">Side chats</span>
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

	<div class="exchange-section prompt-section">
		<div class="exchange-kicker">You</div>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- Sanitized by DOMPurify -->
		<div class="exchange-prompt">{@html promptHtml}</div>
	</div>

	<div class="exchange-section response-section">
		<div class="exchange-card-header">
			<div class="exchange-kicker">
				{#if data.provider && PROVIDER_LOGOS[data.provider]}
					<img
						src={PROVIDER_LOGOS[data.provider]}
						alt={data.provider}
						class="exchange-provider-logo"
					/>
				{/if}
				Assistant
				{#if data.model}
					<span class="exchange-model">{data.model}</span>
				{/if}
			</div>
			<div class="response-header-right">
				{#if data.isStreaming}
					<div class="streaming-dot"></div>
				{/if}
				<span class="action-tip-wrap">
					<button
						class="collapse-toggle"
						type="button"
						aria-label={collapsed ? 'Expand' : 'Collapse'}
						onclick={(e: MouseEvent) => {
							e.stopPropagation();
							collapsed = !collapsed;
						}}
					>
						<svg
							width="14"
							height="14"
							viewBox="0 0 14 14"
							fill="none"
							stroke="currentColor"
							stroke-width="1.5"
							stroke-linecap="round"
							stroke-linejoin="round"
							class:collapse-rotated={!collapsed}
						>
							<path d="M4 5.5l3 3 3-3" />
						</svg>
					</button>
					<span class="action-tip">{collapsed ? 'Expand' : 'Collapse'}</span>
				</span>
			</div>
		</div>
		{#if !collapsed}
			{#if responseHtml}
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- Sanitized by DOMPurify -->
				<div class="exchange-response">{@html responseHtml}</div>
			{:else}
				<div class="exchange-response exchange-response-plain">
					{data.response || 'Waiting for response…'}
				</div>
			{/if}
		{/if}
	</div>
</div>
