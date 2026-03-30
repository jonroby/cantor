<script lang="ts">
	interface SearchResult {
		exchangeId: string;
		chatIndex: number;
		prompt: string;
		snippets: { text: string; matchStart: number; matchEnd: number }[];
	}

	let {
		chats,
		activeChatIndex,
		searchQuery,
		searchAllChats,
		onSelect,
		onClose
	}: {
		chats: unknown[];
		activeChatIndex: number;
		searchQuery: string;
		searchAllChats: boolean;
		onSelect: (result: SearchResult) => void;
		onClose: () => void;
	} = $props();

	let searchItems = $derived.by(() => {
		void searchAllChats;
		return chats.length
			? [
					{
						exchangeId: 'exchange-1',
						chatIndex: activeChatIndex,
						prompt: searchQuery || 'Result',
						snippets: []
					}
				]
			: [];
	});
</script>

<div data-testid="search-dialog-mock">
	<button
		onclick={() => {
			onSelect(searchItems[0]);
			onClose();
		}}
	>
		Choose result
	</button>
</div>
