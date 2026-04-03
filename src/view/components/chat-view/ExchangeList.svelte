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
			class="chatview-exchange-wrap"
			class:chatview-side-chat-source={sidePanelOpen && sidePanelParentId === exchange.id}
			data-exchange-id={exchange.id}
		>
			<ChatMessage data={nodeData} />
		</div>
	{/if}
{/each}
