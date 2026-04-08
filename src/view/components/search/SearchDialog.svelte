<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { MessageCircle, X } from 'lucide-svelte';
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

	let inputEl: HTMLInputElement | null = $state(null);

	$effect(() => {
		inputEl?.focus();
	});

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

	// Group results by chat
	interface ChatGroup {
		chatIndex: number;
		chatName: string;
		results: SearchResult[];
	}

	function groupByChat(items: SearchResult[]): ChatGroup[] {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const map = new Map<number, ChatGroup>();
		for (const item of items) {
			let group = map.get(item.chatIndex);
			if (!group) {
				group = {
					chatIndex: item.chatIndex,
					chatName: chats[item.chatIndex]?.name ?? 'Chat',
					results: []
				};
				map.set(item.chatIndex, group);
			}
			group.results.push(item);
		}
		return [...map.values()];
	}

	let searchItems = $derived(
		searchQuery.trim() ? searchItemsForQuery(searchQuery.trim()) : getDefaultItems()
	);

	let grouped = $derived(groupByChat(searchItems.slice(0, 40)));

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}
</script>

<button class="modal-scrim" type="button" aria-label="Close search" onclick={onClose}></button>

<div class="search-panel" role="dialog" aria-modal="true">
	<div class="search-header">
		<input
			bind:this={inputEl}
			bind:value={searchQuery}
			class="search-input"
			placeholder="Search chats..."
			onkeydown={handleKeydown}
			autocomplete="off"
			spellcheck="false"
		/>
		<div class="search-header-right">
			<label class="search-all-label">
				<input type="checkbox" bind:checked={searchAllChats} />
				<span>All chats</span>
			</label>
			<button class="search-close-btn" type="button" onclick={onClose} aria-label="Close">
				<X size={16} />
			</button>
		</div>
	</div>

	<div class="search-results">
		{#if searchItems.length === 0}
			<div class="search-empty">
				{searchQuery.trim().length > 0 ? 'No results found.' : 'No exchanges yet.'}
			</div>
		{:else}
			{#each grouped as group (group.chatIndex)}
				{#if searchAllChats}
					<div class="search-group-label">{group.chatName}</div>
				{/if}
				{#each group.results as result (result.chatIndex + ':' + result.exchangeId)}
					<button
						class="search-result-btn"
						type="button"
						onclick={() => {
							onSelect(result);
							onClose();
						}}
					>
						<MessageCircle size={16} class="search-result-icon" />
						<div class="search-result-text">
							<div class="search-result-prompt">{result.prompt}</div>
							{#if result.snippets[0] && result.snippets[0].text !== result.prompt}
								<div class="search-result-snippet">{result.snippets[0].text}</div>
							{/if}
						</div>
					</button>
				{/each}
			{/each}
		{/if}
	</div>
</div>

<style>
	.modal-scrim {
		position: fixed;
		inset: 0;
		z-index: 50;
		background: transparent;
		border: none;
		cursor: default;
	}

	.search-panel {
		position: fixed;
		top: 6rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 51;
		width: min(680px, calc(100vw - 2rem));
		background: hsl(var(--card));
		border-radius: 1.25rem;
		box-shadow:
			0 0 0 1px hsl(var(--border) / 0.6),
			0 24px 64px rgba(0, 0, 0, 0.14),
			0 8px 24px rgba(0, 0, 0, 0.08);
		overflow: hidden;
	}

	.search-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 1.1rem 1.4rem;
		border-bottom: 1px solid hsl(var(--border) / 0.6);
	}

	.search-input {
		flex: 1;
		border: none;
		background: transparent;
		outline: none;
		font-size: 1.05rem;
		color: hsl(var(--foreground));
		line-height: 1.4;
	}

	.search-input::placeholder {
		color: hsl(var(--muted-foreground) / 0.6);
	}

	.search-header-right {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-shrink: 0;
	}

	.search-all-label {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.82rem;
		color: hsl(var(--muted-foreground));
		cursor: pointer;
		white-space: nowrap;
	}

	.search-close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.6rem;
		height: 1.6rem;
		border: none;
		border-radius: 0.4rem;
		background: transparent;
		color: hsl(var(--muted-foreground));
		cursor: pointer;
		transition:
			background 120ms,
			color 120ms;
	}

	.search-close-btn:hover {
		background: hsl(var(--muted));
		color: hsl(var(--foreground));
	}

	.search-results {
		display: flex;
		flex-direction: column;
		max-height: 26rem;
		overflow-y: auto;
		padding: 0.5rem 0 0.75rem;
	}

	.search-empty {
		padding: 2.5rem 1.4rem;
		text-align: center;
		color: hsl(var(--muted-foreground));
		font-size: 0.9rem;
	}

	.search-group-label {
		padding: 0.6rem 1.4rem 0.25rem;
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: hsl(var(--muted-foreground) / 0.65);
	}

	.search-result-btn {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		width: 100%;
		padding: 0.7rem 1.4rem;
		border: none;
		border-radius: 0;
		background: transparent;
		text-align: left;
		cursor: pointer;
		transition: background 100ms;
	}

	.search-result-btn:hover {
		background: hsl(var(--muted) / 0.6);
	}

	:global(.search-result-icon) {
		flex-shrink: 0;
		margin-top: 0.15rem;
		color: hsl(var(--muted-foreground) / 0.55);
	}

	.search-result-text {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}

	.search-result-prompt {
		font-size: 0.95rem;
		color: hsl(var(--foreground));
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.search-result-snippet {
		font-size: 0.8rem;
		color: hsl(var(--muted-foreground));
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
