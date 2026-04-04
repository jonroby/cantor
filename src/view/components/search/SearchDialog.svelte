<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { Search } from 'lucide-svelte';
	import { Input } from '@/view/primitives';
	import type * as app from '@/app';

	interface Snippet {
		text: string;
		matchStart: number;
		matchEnd: number;
	}

	export interface SearchResult {
		exchangeId: string;
		chatIndex: number;
		prompt: string;
		snippets: Snippet[];
	}

	const SNIPPET_CONTEXT = 80;
	const TRIGRAM_THRESHOLD = 0.15;

	interface SearchQuery {
		raw: string;
		normalized: string;
		trigrams: Set<string>;
	}

	interface SearchableExchange {
		id: string;
		prompt: string;
		response: string;
	}

	interface Props {
		searchQuery: string;
		searchAllChats: boolean;
		chats: app.chat.Chat[];
		activeChatIndex: number;
		onClose: () => void;
		onSelect: (result: SearchResult) => void;
	}

	let {
		searchQuery = $bindable(),
		searchAllChats = $bindable(),
		chats,
		activeChatIndex,
		onClose,
		onSelect
	}: Props = $props();

	function buildSearchQuery(query: string): SearchQuery {
		const normalized = query.trim().toLowerCase();
		return {
			raw: query.trim(),
			normalized,
			trigrams: buildTrigrams(normalized)
		};
	}

	function buildTrigrams(text: string): Set<string> {
		const result = new SvelteSet<string>();
		for (let index = 0; index <= text.length - 3; index += 1) {
			result.add(text.slice(index, index + 3));
		}
		return result;
	}

	function getSearchableExchanges(chat: app.chat.Chat | undefined): SearchableExchange[] {
		if (!chat) return [];
		return Object.values(chat.exchanges)
			.filter((exchange) => exchange.prompt.text.length > 0)
			.map((exchange) => ({
				id: exchange.id,
				prompt: exchange.prompt.text,
				response: exchange.response?.text ?? ''
			}));
	}

	function scoreText(text: string, query: SearchQuery): number {
		const normalizedText = text.toLowerCase();
		if (query.normalized.length < 3) {
			return normalizedText.includes(query.normalized) ? 1 : 0;
		}

		const textTrigrams = buildTrigrams(normalizedText);
		let matches = 0;
		for (const trigram of query.trigrams) {
			if (textTrigrams.has(trigram)) matches += 1;
		}
		return matches / query.trigrams.size;
	}

	function extractSnippet(text: string, query: SearchQuery): Snippet | null {
		const matchIndex = text.toLowerCase().indexOf(query.normalized);
		if (matchIndex === -1) return null;

		const snippetStart = Math.max(0, matchIndex - SNIPPET_CONTEXT);
		const snippetEnd = Math.min(text.length, matchIndex + query.raw.length + SNIPPET_CONTEXT);
		const prefix = snippetStart > 0 ? '...' : '';
		const suffix = snippetEnd < text.length ? '...' : '';
		return {
			text: `${prefix}${text.slice(snippetStart, snippetEnd)}${suffix}`,
			matchStart: matchIndex - snippetStart + prefix.length,
			matchEnd: matchIndex - snippetStart + query.raw.length + prefix.length
		};
	}

	function buildSnippets(exchange: SearchableExchange, query: SearchQuery): Snippet[] {
		const snippets: Snippet[] = [];
		if (scoreText(exchange.prompt, query) >= TRIGRAM_THRESHOLD) {
			const snippet = extractSnippet(exchange.prompt, query);
			if (snippet) snippets.push(snippet);
		}
		if (scoreText(exchange.response, query) >= TRIGRAM_THRESHOLD) {
			const snippet = extractSnippet(exchange.response, query);
			if (snippet) snippets.push(snippet);
		}
		return snippets;
	}

	function getIndices(): number[] {
		return searchAllChats ? chats.map((_, index) => index) : [activeChatIndex];
	}

	function getDefaultItems(): SearchResult[] {
		return [...new SvelteSet(getIndices())].flatMap((chatIndex) =>
			getSearchableExchanges(chats[chatIndex]).map((exchange) => ({
				exchangeId: exchange.id,
				chatIndex,
				prompt: exchange.prompt,
				snippets: []
			}))
		);
	}

	function searchItemsForQuery(query: string): SearchResult[] {
		const searchQuery = buildSearchQuery(query);
		if (searchQuery.normalized.length === 0) return [];

		return [...new SvelteSet(getIndices())]
			.flatMap((chatIndex) =>
				getSearchableExchanges(chats[chatIndex]).flatMap((exchange) => {
					const score = Math.max(
						scoreText(exchange.prompt, searchQuery),
						scoreText(exchange.response, searchQuery)
					);
					if (score < TRIGRAM_THRESHOLD) return [];
					return [
						{
							exchangeId: exchange.id,
							chatIndex,
							prompt: exchange.prompt,
							snippets: buildSnippets(exchange, searchQuery),
							score
						}
					];
				})
			)
			.sort((left, right) => right.score - left.score)
			.map(({ score: _, ...result }) => result);
	}

	let searchItems = $derived(
		searchQuery.trim() ? searchItemsForQuery(searchQuery.trim()) : getDefaultItems()
	);
</script>

<button class="modal-scrim" type="button" aria-label="Close search" onclick={onClose}></button>
<div class="modal-panel search-panel">
	<div class="search-header">
		<Search size={18} />
		<Input
			id="search"
			bind:value={searchQuery}
			class="search-input"
			placeholder="Search chats and projects"
		/>
		<label class="search-all-label">
			<input type="checkbox" bind:checked={searchAllChats} />
			<span>All chats</span>
		</label>
	</div>
	<div class="search-results">
		{#if searchItems.length === 0}
			<div class="search-empty">
				{searchQuery.trim().length > 0 ? 'No results found.' : 'No exchanges yet.'}
			</div>
		{/if}
		{#each searchItems.slice(0, 40) as result (result.chatIndex + ':' + result.exchangeId)}
			<button
				class="search-result-btn"
				type="button"
				onclick={() => {
					onSelect(result);
					onClose();
				}}
			>
				<div class="search-result-prompt">{result.prompt}</div>
				{#if result.snippets[0]}
					<div class="search-result-snippet">{result.snippets[0].text}</div>
				{/if}
			</button>
		{/each}
	</div>
</div>

<style>
	.search-panel {
		top: 6rem;
		width: min(768px, calc(100vw - 2rem));
		overflow: hidden;
		padding: 0;
	}

	.search-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		border-bottom: 1px solid var(--border-color);
		padding: 1rem 1.2rem;
	}

	.search-all-label {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-size: var(--text-sm);
		white-space: nowrap;
		color: hsl(var(--muted-foreground));
	}

	.search-results {
		display: flex;
		max-height: 28rem;
		flex-direction: column;
		overflow: auto;
		padding: 0.4rem 0;
	}

	.search-empty {
		padding: 2rem 1.2rem;
		text-align: center;
		font-size: var(--text-base);
		color: hsl(var(--muted-foreground));
	}

	.search-result-btn {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		border-radius: 0;
		border: 0;
		background: transparent;
		padding: 0.8rem 1.2rem;
		box-shadow: none;
		text-align: left;
		cursor: pointer;
		width: 100%;
	}

	.search-result-btn:hover {
		background: hsl(var(--muted) / 0.75);
	}

	.search-result-prompt {
		font-size: var(--text-sm);
	}

	.search-result-snippet {
		font-size: var(--text-sm);
		color: hsl(var(--muted-foreground));
	}

	:global(.search-input) {
		border: 0;
		background: transparent;
		box-shadow: none;
	}

	:global(.search-input:focus) {
		border-color: transparent;
		box-shadow: none;
	}
</style>
