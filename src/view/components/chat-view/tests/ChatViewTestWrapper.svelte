<script lang="ts">
	import ChatView from '../ChatView.svelte';
	import { Composer } from '@/view/components/composer';

	let chatViewRef: ReturnType<typeof ChatView> | null = $state(null);
	let composerRef: ReturnType<typeof Composer> | undefined = $state();

	export function revealExchange(exchangeId: string) {
		return chatViewRef?.revealExchange(exchangeId);
	}

	export function showDocument(folderId: string, fileId: string) {
		chatViewRef?.showDocument(folderId, fileId);
	}

	export function resetUIState() {
		chatViewRef?.resetUIState();
	}
</script>

<ChatView bind:this={chatViewRef} onFocusComposer={() => composerRef?.focus()} />
<Composer
	bind:this={composerRef}
	onScrollToNode={(nodeId) => chatViewRef?.scrollToNode(nodeId)}
	onExpandSideChat={(exchangeId) => chatViewRef?.expandSideChat(exchangeId)}
/>
