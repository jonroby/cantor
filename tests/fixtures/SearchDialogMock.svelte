<script lang="ts">
	import type { SearchResult } from '@/domain/search';

	let {
		searchItems,
		onSelect,
		onClose
	}: {
		searchItems: SearchResult[];
		onSelect: (result: SearchResult) => void;
		onClose: () => void;
	} = $props();
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
