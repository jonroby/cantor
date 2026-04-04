<script lang="ts">
	interface TocEntry {
		id: string;
		text: string;
		level: number;
	}

	interface Props {
		content: string;
		scrollEl: HTMLElement | null;
	}

	let { content, scrollEl }: Props = $props();

	let entries: TocEntry[] = $derived(parseHeadings(content));
	let activeId: string | null = $state(null);
	let observer: IntersectionObserver | null = null;

	function slugify(text: string, seen: Map<string, number>): string {
		const base = text
			.toLowerCase()
			.replace(/[^\w\s-]/g, '')
			.trim()
			.replace(/\s+/g, '-');
		const count = seen.get(base) ?? 0;
		seen.set(base, count + 1);
		return count === 0 ? base : `${base}-${count}`;
	}

	function parseHeadings(md: string): TocEntry[] {
		const lines = md.split('\n');
		const seen = new Map<string, number>();
		const result: TocEntry[] = [];
		for (const line of lines) {
			const m = line.match(/^(#{1,3})\s+(.+)/);
			if (!m) continue;
			const level = m[1]!.length;
			const text = m[2]!.trim();
			const id = slugify(text, seen);
			result.push({ id, text, level });
		}
		return result;
	}

	function setupObserver(root: HTMLElement) {
		observer?.disconnect();
		if (entries.length === 0) return;

		// Assign IDs to heading elements matching our entries
		const headings = root.querySelectorAll('h1, h2, h3');
		const seen = new Map<string, number>();
		for (const h of headings) {
			const text = h.textContent?.trim() ?? '';
			const id = slugify(text, seen);
			if (!h.id) h.id = id;
		}

		observer = new IntersectionObserver(
			(changes) => {
				for (const change of changes) {
					if (change.isIntersecting) {
						activeId = (change.target as HTMLElement).id || null;
					}
				}
			},
			{ root: scrollEl, rootMargin: '-5% 0px -75% 0px', threshold: 0 }
		);

		for (const h of headings) {
			observer.observe(h);
		}
	}

	$effect(() => {
		void entries;
		if (!scrollEl) return;
		// Wait for DOM to reflect new content
		Promise.resolve().then(() => {
			const inner = scrollEl!.querySelector('.docs-content-inner') as HTMLElement | null;
			if (inner) setupObserver(inner);
		});
		return () => observer?.disconnect();
	});

	function scrollTo(id: string) {
		if (!scrollEl) return;
		const el = scrollEl.querySelector(`#${CSS.escape(id)}`);
		el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		activeId = id;
	}
</script>

{#if entries.length > 0}
	<nav class="doc-toc">
		<span class="doc-toc-title">Table of Contents</span>
		<ul class="doc-toc-list">
			{#each entries as entry (entry.id)}
				<li
					class="doc-toc-item"
					class:doc-toc-h2={entry.level === 2}
					class:doc-toc-h3={entry.level === 3}
				>
					<button
						class="doc-toc-link"
						class:doc-toc-active={activeId === entry.id}
						onclick={() => scrollTo(entry.id)}
					>
						{entry.text}
					</button>
				</li>
			{/each}
		</ul>
	</nav>
{/if}

<style>
	.doc-toc {
		display: none;
		position: absolute;
		top: calc(var(--pane-header-height) + 16px + 28px + 5px);
		right: calc((100% - var(--pane-content-width)) / 4 - 80px);
		width: 160px;
		max-height: calc(100% - 100px);
		overflow-y: auto;
		flex-direction: column;
		gap: 8px;
	}

	.doc-toc-title {
		font-size: 11px;
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: hsl(var(--muted-foreground));
		padding-left: 8px;
	}

	.doc-toc-list {
		list-style: none;
		margin: 0;
		padding: 0;
		border-left: 1px solid var(--border-color);
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.doc-toc-item {
		display: flex;
	}

	.doc-toc-h3 {
		padding-left: 10px;
	}

	.doc-toc-link {
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		padding: 3px 8px;
		font-size: 12px;
		line-height: 1.4;
		color: hsl(var(--muted-foreground));
		border-radius: 3px;
		width: 100%;
		transition: color 120ms;
	}

	.doc-toc-link:hover {
		color: hsl(var(--foreground));
	}

	.doc-toc-active {
		color: hsl(var(--foreground));
		font-weight: var(--font-weight-medium);
	}

	@media (min-width: 1400px) {
		.doc-toc {
			display: flex;
		}
	}
</style>
