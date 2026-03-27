<script lang="ts">
	import { ChatHeader } from '@/features/chat-header';
	import { ChatToolbar } from '@/features/chat-toolbar';
	import { ChatTree } from '@/features/canvas';
	import { ChatInput } from '@/features/chat-input';
	import { getActiveChat, getActiveExchangeId } from '@/state/chats.svelte';
	import { downloadToFile } from '@/services/io.svelte';

	interface Props {
		onSearchOpen: () => void;
	}

	let { onSearchOpen }: Props = $props();

	let chatTreeRef: ReturnType<typeof ChatTree> | null = $state(null);
	let headerVisible = $state(true);
	let headerTimer: ReturnType<typeof setTimeout> | null = $state(null);

	function handleWheel(e: WheelEvent) {
		if (e.deltaY < 0) {
			headerVisible = true;
			if (headerTimer) clearTimeout(headerTimer);
			headerTimer = setTimeout(() => {
				headerVisible = false;
			}, 2000);
		} else if (e.deltaY > 0) {
			if (headerTimer) clearTimeout(headerTimer);
			headerVisible = false;
		}
	}

	export function scrollToNode(nodeId: string | null) {
		chatTreeRef?.scrollToNode(nodeId);
	}

	export function resetUIState() {
		chatTreeRef?.resetUIState();
	}

	$effect(() => {
		headerTimer = setTimeout(() => {
			headerVisible = false;
		}, 2000);
		return () => {
			if (headerTimer) clearTimeout(headerTimer);
		};
	});
</script>

<div class="page-shell" onwheel={handleWheel}>
	<ChatHeader visible={headerVisible} chatName={getActiveChat().name} />

	<ChatToolbar
		onSearch={onSearchOpen}
		onFitView={() => chatTreeRef?.fitView()}
		onGoToTop={() => chatTreeRef?.scrollToTop()}
		onGoToActive={() => chatTreeRef?.scrollToNode(getActiveExchangeId())}
		onDownload={downloadToFile}
	/>

	<ChatTree bind:this={chatTreeRef} />

	<ChatInput
		onScrollToNode={(nodeId) => chatTreeRef?.scrollToNode(nodeId)}
		onExpandSideChat={(exchangeId) => chatTreeRef?.expandSideChat(exchangeId)}
	/>
</div>
