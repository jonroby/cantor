<script lang="ts">
	import ChatMessage from '@/view/components/chat-message/ChatMessage.svelte';
	import type { ChatCardData } from '@/view/components/chat-card';
	import type * as app from '@/app';

	interface Props {
		exchanges: app.chat.Exchange[];
		sidePanelParentId?: string | null;
		sidePanelOpen?: boolean;
		getNodeData: (exchangeId: string) => ChatCardData | null;
	}

	let { exchanges, sidePanelParentId = null, sidePanelOpen = false, getNodeData }: Props = $props();
</script>

{#each exchanges as exchange (exchange.id)}
	{@const nodeData = getNodeData(exchange.id)}
	{#if nodeData}
		<div
			class="exchange-item"
			class:exchange-item-side-source={sidePanelOpen && sidePanelParentId === exchange.id}
			data-exchange-id={exchange.id}
		>
			<ChatMessage data={nodeData} />
		</div>
	{/if}
{/each}

<style>
	.exchange-item {
		width: 100%;
		scroll-margin-top: 1rem;
		border-bottom: 1px solid var(--border-color);
		padding-bottom: 1.25rem;
	}

	.exchange-item:last-child {
		border-bottom: none;
	}

	.exchange-item-side-source {
		position: relative;
	}
</style>
