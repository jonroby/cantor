<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { MessageCircle, X } from 'lucide-svelte';
	import type * as app from '@/app';

	interface SnippetSegment {
		text: string;
		match: boolean;
	}

	interface Snippet {
		field: 'prompt' | 'response';
		segments: SnippetSegment[];
	}

	export interface SearchResult {
		exchangeId: string;
		chatIndex: number;
		prompt: string;
		snippet: Snippet | null;
	}

	const SNIPPET_CONTEXT = 60;
	const TRIGRAM_THRESHOLD = 0.35;
	const SHORT_QUERY_MAX = 2;

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
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const result = new Set<string>();
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

	interface MatchRange {
		start: number;
		end: number;
	}

	interface FieldMatch {
		score: number;
		ranges: MatchRange[];
	}

	function matchShortQuery(normalizedText: string, normalized: string): FieldMatch {
		const ranges: MatchRange[] = [];
		let from = 0;
		while (from <= normalizedText.length - normalized.length) {
			const index = normalizedText.indexOf(normalized, from);
			if (index === -1) break;
			ranges.push({ start: index, end: index + normalized.length });
			from = index + normalized.length;
		}
		return { score: ranges.length > 0 ? 1 : 0, ranges };
	}

	function mergeRanges(ranges: MatchRange[]): MatchRange[] {
		if (ranges.length <= 1) return ranges;
		ranges.sort((a, b) => a.start - b.start);
		const merged: MatchRange[] = [ranges[0]];
		for (let i = 1; i < ranges.length; i++) {
			const last = merged[merged.length - 1];
			const current = ranges[i];
			if (current.start <= last.end) {
				last.end = Math.max(last.end, current.end);
			} else {
				merged.push(current);
			}
		}
		return merged;
	}

	function matchField(text: string, query: SearchQuery): FieldMatch {
		if (text.length === 0 || query.normalized.length === 0) {
			return { score: 0, ranges: [] };
		}
		const normalizedText = text.toLowerCase();
		if (query.normalized.length <= SHORT_QUERY_MAX) {
			return matchShortQuery(normalizedText, query.normalized);
		}
		const ranges: MatchRange[] = [];
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const matchedTrigrams = new Set<string>();
		for (let i = 0; i <= normalizedText.length - 3; i++) {
			const trigram = normalizedText.slice(i, i + 3);
			if (query.trigrams.has(trigram)) {
				ranges.push({ start: i, end: i + 3 });
				matchedTrigrams.add(trigram);
			}
		}
		const score = matchedTrigrams.size / query.trigrams.size;
		return { score, ranges: mergeRanges(ranges) };
	}

	function pickSnippetWindow(
		textLength: number,
		ranges: MatchRange[],
		contextRadius: number
	): { start: number; end: number } {
		if (ranges.length === 0) {
			return { start: 0, end: Math.min(textLength, contextRadius * 2) };
		}
		// Find the densest cluster: walk with a sliding window of width = 2 * contextRadius
		// and pick the window center that covers the most match ranges.
		const windowWidth = contextRadius * 2;
		let bestStart = Math.max(0, ranges[0].start - contextRadius);
		let bestCount = 0;
		for (const range of ranges) {
			const candidateStart = Math.max(0, range.start - contextRadius);
			const candidateEnd = Math.min(textLength, candidateStart + windowWidth);
			let count = 0;
			for (const other of ranges) {
				if (other.start >= candidateStart && other.end <= candidateEnd) count += 1;
			}
			if (count > bestCount) {
				bestCount = count;
				bestStart = candidateStart;
			}
		}
		const start = bestStart;
		const end = Math.min(textLength, start + windowWidth);
		return { start, end };
	}

	function sliceSegments(
		text: string,
		windowStart: number,
		windowEnd: number,
		ranges: MatchRange[]
	): SnippetSegment[] {
		const segments: SnippetSegment[] = [];
		let cursor = windowStart;
		for (const range of ranges) {
			if (range.end <= windowStart) continue;
			if (range.start >= windowEnd) break;
			const matchStart = Math.max(range.start, windowStart);
			const matchEnd = Math.min(range.end, windowEnd);
			if (cursor < matchStart) {
				segments.push({ text: text.slice(cursor, matchStart), match: false });
			}
			segments.push({ text: text.slice(matchStart, matchEnd), match: true });
			cursor = matchEnd;
		}
		if (cursor < windowEnd) {
			segments.push({ text: text.slice(cursor, windowEnd), match: false });
		}
		if (windowStart > 0) segments.unshift({ text: '…', match: false });
		if (windowEnd < text.length) segments.push({ text: '…', match: false });
		return segments;
	}

	function buildSnippet(
		text: string,
		field: 'prompt' | 'response',
		match: FieldMatch
	): Snippet | null {
		if (match.ranges.length === 0) return null;
		const window = pickSnippetWindow(text.length, match.ranges, SNIPPET_CONTEXT);
		const segments = sliceSegments(text, window.start, window.end, match.ranges);
		return { field, segments };
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
				snippet: null
			}))
		);
	}

	function searchItemsForQuery(query: string): SearchResult[] {
		const searchQuery = buildSearchQuery(query);
		if (searchQuery.normalized.length === 0) return [];

		const effectiveThreshold =
			searchQuery.normalized.length <= SHORT_QUERY_MAX ? 1 : TRIGRAM_THRESHOLD;

		return [...new SvelteSet(getIndices())]
			.flatMap((chatIndex) =>
				getSearchableExchanges(chats[chatIndex]).flatMap((exchange) => {
					const promptMatch = matchField(exchange.prompt, searchQuery);
					const responseMatch = matchField(exchange.response, searchQuery);
					const score = Math.max(promptMatch.score, responseMatch.score);
					if (score < effectiveThreshold) return [];
					const snippet =
						promptMatch.score >= responseMatch.score
							? buildSnippet(exchange.prompt, 'prompt', promptMatch)
							: buildSnippet(exchange.response, 'response', responseMatch);
					return [
						{
							exchangeId: exchange.id,
							chatIndex,
							prompt: exchange.prompt,
							snippet,
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

	let debouncedQuery = $state(searchQuery);

	$effect(() => {
		const next = searchQuery;
		if (next === debouncedQuery) return;
		const handle = setTimeout(() => {
			debouncedQuery = next;
		}, 200);
		return () => clearTimeout(handle);
	});

	let searchItems = $derived(
		debouncedQuery.trim() ? searchItemsForQuery(debouncedQuery.trim()) : getDefaultItems()
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
				{debouncedQuery.trim().length > 0 ? 'No results found.' : 'No exchanges yet.'}
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
							{#if result.snippet}
								<div class="search-result-snippet">
									{#if result.snippet.field === 'response'}<span class="search-result-field"
											>Response:</span
										>
									{/if}{#each result.snippet.segments as segment, i (i)}{#if segment.match}<mark
												class="search-result-mark">{segment.text}</mark
											>{:else}{segment.text}{/if}{/each}
								</div>
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
		line-height: 1.4;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		word-break: break-word;
	}

	.search-result-field {
		font-weight: 600;
		color: hsl(var(--muted-foreground) / 0.85);
		margin-right: 0.3rem;
	}

	.search-result-mark {
		background: hsl(var(--accent) / 0.35);
		color: hsl(var(--foreground));
		border-radius: 0.15rem;
		padding: 0 0.1rem;
	}
</style>
