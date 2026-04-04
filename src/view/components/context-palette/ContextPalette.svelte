<script lang="ts">
	import type * as app from '@/app';

	type ContextStrategy = app.chat.ContextStrategy;

	interface Props {
		open: boolean;
		onClose: () => void;
		contextStrategy: ContextStrategy;
		onSelectStrategy: (strategy: ContextStrategy) => void;
		usedTokens: number;
		totalTokens: number;
	}

	let { open, onClose, contextStrategy, onSelectStrategy, usedTokens, totalTokens }: Props =
		$props();

	const strategies: { id: ContextStrategy; label: string; description: string }[] = [
		{
			id: 'full',
			label: 'Full',
			description:
				'Send the entire conversation history on every request. Most accurate, highest token cost.'
		},
		{
			id: 'lru',
			label: 'LRU',
			description:
				'Keep the most recent exchanges that fit in the context window. Drops older history when the window fills up.'
		},
		{
			id: 'bm25',
			label: 'BM25',
			description:
				'Select exchanges most relevant to your current prompt using keyword matching. Useful for long sessions.'
		}
	];
</script>

{#if open}
	<button class="modal-scrim" type="button" aria-label="Close context palette" onclick={onClose}
	></button>
	<div class="modal-panel context-palette-panel">
		<div class="context-palette-header">
			<span class="context-palette-title">Context Settings</span>
		</div>
		<div class="context-palette-body">
			<div class="context-section-label">Strategy</div>
			{#each strategies as strategy (strategy.id)}
				<button
					class="strategy-row"
					class:strategy-row-active={contextStrategy === strategy.id}
					onclick={() => onSelectStrategy(strategy.id)}
				>
					<div class="strategy-row-header">
						<span class="strategy-label">{strategy.label}</span>
						{#if contextStrategy === strategy.id}
							<span class="strategy-active-dot"></span>
						{/if}
					</div>
					<span class="strategy-description">{strategy.description}</span>
				</button>
			{/each}

			<div class="context-divider"></div>

			<div class="context-section-label">Token Usage</div>
			<div class="token-stats">
				<div class="token-stat">
					<span class="token-stat-label">Estimated next context</span>
					<span class="token-stat-value">{usedTokens.toLocaleString()}</span>
				</div>
				<div class="token-stat">
					<span class="token-stat-label">Total session cost</span>
					<span class="token-stat-value">{totalTokens.toLocaleString()}</span>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.context-palette-panel {
		width: min(400px, calc(100vw - 2rem));
		padding: 0;
	}

	.context-palette-header {
		padding: 1rem 1.25rem 0.75rem;
		border-bottom: 1px solid hsl(var(--border));
	}

	.context-palette-title {
		font-size: var(--text-base);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: hsl(var(--muted-foreground));
	}

	.context-palette-body {
		padding: 0.75rem 0 1rem;
	}

	.context-section-label {
		font-size: var(--text-xs);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: hsl(var(--muted-foreground));
		padding: 0 1.25rem 0.5rem;
	}

	.strategy-row {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		width: 100%;
		padding: 0.625rem 1.25rem;
		background: transparent;
		border: none;
		cursor: pointer;
		text-align: left;
		transition: background-color var(--duration-normal);
	}

	.strategy-row:hover {
		background: hsl(var(--muted) / 0.4);
	}

	.strategy-row-active {
		background: hsl(var(--accent));
	}

	.strategy-row-active:hover {
		background: hsl(var(--accent));
	}

	.strategy-row-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.strategy-label {
		font-size: var(--text-md);
		font-weight: 500;
		color: hsl(var(--foreground));
	}

	.strategy-active-dot {
		width: 0.375rem;
		height: 0.375rem;
		border-radius: 50%;
		background: hsl(var(--primary));
	}

	.strategy-description {
		font-size: var(--text-sm);
		color: hsl(var(--muted-foreground));
		line-height: 1.4;
	}

	.context-divider {
		margin: 0.75rem 0;
		border-top: 1px solid hsl(var(--border));
	}

	.token-stats {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0 1.25rem;
	}

	.token-stat {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.token-stat-label {
		font-size: var(--text-sm);
		color: hsl(var(--muted-foreground));
	}

	.token-stat-value {
		font-size: var(--text-sm);
		font-weight: 500;
		color: hsl(var(--foreground));
		font-variant-numeric: tabular-nums;
	}
</style>
