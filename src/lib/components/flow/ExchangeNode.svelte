<script lang="ts">
	import Button from '$lib/components/ui/button.svelte';
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';

	interface ExchangeNodeData {
		prompt: string;
		response: string;
		model?: string;
		isActive: boolean;
		isStreaming: boolean;
		canCreateSideChat: boolean;
		hasSideChildren: boolean;
		isSideRoot: boolean;
		canPromote: boolean;
		onSelect: () => void;
		onCreateSideChat: () => void;
		onToggleSideChildren: () => void;
		onPromote: () => void;
		onDelete: () => void;
	}

	let { data }: NodeProps = $props();
	let node = $derived(data as unknown as ExchangeNodeData);
</script>

<Handle type="target" position={Position.Top} />
<div
	class:active-node={node.isActive}
	class="exchange-card flow-node-card"
	role="button"
	tabindex="0"
	onclick={node.onSelect}
	onkeydown={(event) => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			node.onSelect();
		}
	}}
>
	<div class="exchange-actions">
		{#if node.canCreateSideChat}
			<Button class="icon-chip" variant="ghost" size="icon" onclick={(event) => { event.stopPropagation(); node.onCreateSideChat(); }} ariaLabel="Create side chat">
				<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 2v10M2 7h10" stroke-linecap="round" /></svg>
			</Button>
		{/if}
		{#if node.hasSideChildren}
			<Button class="icon-chip" variant="ghost" size="icon" onclick={(event) => { event.stopPropagation(); node.onToggleSideChildren(); }} ariaLabel="Toggle side branches">
				<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 3v8M3 7h4M7 7v4M7 7h4" stroke-linecap="round" stroke-linejoin="round" /></svg>
			</Button>
		{/if}
		{#if node.isSideRoot}
			<Button class="icon-chip" variant="ghost" size="icon" disabled={!node.canPromote} onclick={(event) => { event.stopPropagation(); node.onPromote(); }} ariaLabel="Promote to main">
				<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 12V2M7 2l-2 2M7 2l2 2" stroke-linecap="round" stroke-linejoin="round" /></svg>
			</Button>
		{/if}
		<Button class="icon-chip delete-chip" variant="ghost" size="icon" onclick={(event) => { event.stopPropagation(); node.onDelete(); }} ariaLabel="Delete exchange">
			<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3.5 4.5h7M5.5 4.5v6M8.5 4.5v6M4.5 4.5l.4-1.2A1 1 0 0 1 5.85 2.6h2.3a1 1 0 0 1 .95.7l.4 1.2M4.5 4.5v6.8c0 .39.31.7.7.7h3.6a.7.7 0 0 0 .7-.7V4.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
		</Button>
	</div>

	<div class="exchange-section prompt-section">
		<div class="exchange-kicker">You</div>
		<div class="exchange-prompt">{node.prompt}</div>
	</div>

	<div class="exchange-section response-section">
		<div class="exchange-card-header">
			<div class="exchange-kicker">
				Assistant
				{#if node.model}
					<span class="exchange-model">{node.model}</span>
				{/if}
			</div>
			{#if node.isStreaming}
				<div class="streaming-dot"></div>
			{/if}
		</div>
		<div class="exchange-response">{node.response || 'Waiting for response…'}</div>
	</div>
</div>
<Handle type="source" position={Position.Bottom} />
