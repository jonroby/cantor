<script lang="ts">
	import Input from '@/view/components/custom/input.svelte';
	import type { SearchResult } from '@/domain/search';

	interface Props {
		searchQuery: string;
		searchAllChats: boolean;
		searchItems: SearchResult[];
		onClose: () => void;
		onSelect: (result: SearchResult) => void;
	}

	let {
		searchQuery = $bindable(),
		searchAllChats = $bindable(),
		searchItems,
		onClose,
		onSelect
	}: Props = $props();
</script>

<button class="modal-scrim" type="button" aria-label="Close search" onclick={onClose}></button>
<div class="search-dialog">
	<div class="search-dialog-header">
		<svg
			width="18"
			height="18"
			viewBox="0 0 18 18"
			fill="none"
			stroke="currentColor"
			stroke-width="1.6"
			><circle cx="7.5" cy="7.5" r="5" /><path d="M13 13l3 3" stroke-linecap="round" /></svg
		>
		<Input
			id="search"
			bind:value={searchQuery}
			class="search-input"
			placeholder="Search chats and projects"
		/>
		<label class="check-row compact">
			<input type="checkbox" bind:checked={searchAllChats} />
			<span>All chats</span>
		</label>
	</div>
	<div class="search-results search-dialog-results">
		{#if searchItems.length === 0}
			<div class="search-empty">
				{searchQuery.trim().length > 0 ? 'No results found.' : 'No exchanges yet.'}
			</div>
		{/if}
		{#each searchItems.slice(0, 40) as result (result.chatIndex + ':' + result.exchangeId)}
			<button
				class="search-result"
				type="button"
				onclick={() => {
					onSelect(result);
					onClose();
				}}
			>
				<div class="search-result-title">{result.prompt}</div>
				{#if result.snippets[0]}
					<div class="search-result-snippet">{result.snippets[0].text}</div>
				{/if}
			</button>
		{/each}
	</div>
</div>
