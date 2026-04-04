<script lang="ts">
	import { Info } from 'lucide-svelte';
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
					<span class="token-stat-label-row">
						<span>Estimated next context window</span>
						<span class="token-stat-info">
							<Info size={12} />
							<span class="token-stat-tooltip"
								>LRU and BM25 only reduce this when history exceeds the context window. With room to
								spare, all strategies show the same estimate.</span
							>
						</span>
					</span>
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
		border-bottom: 1px solid var(--border-color);
	}

	.context-palette-title {
		font-size: var(--text-base);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: hsl(var(--muted-foreground));
	}

	.context-palette-body {
		padding: 0.75rem 0 1rem;
	}

	.context-section-label {
		font-size: var(--text-xs);
		font-weight: var(--font-weight-semibold);
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
		font-size: var(--text-sm);
		font-weight: var(--font-weight-medium);
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
		border-top: 1px solid var(--border-color);
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

	.token-stat-label-row {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		font-size: var(--text-sm);
		color: hsl(var(--muted-foreground));
	}

	.token-stat-info {
		position: relative;
		display: flex;
		align-items: center;
		color: hsl(var(--muted-foreground) / 0.6);
		cursor: default;
	}

	.token-stat-tooltip {
		display: none;
		position: absolute;
		bottom: calc(100% + 0.4rem);
		left: 50%;
		transform: translateX(-50%);
		width: 220px;
		padding: 0.5rem 0.625rem;
		border-radius: var(--radius-md);
		background: hsl(var(--popover));
		border: 1px solid var(--border-color);
		box-shadow: 0 4px 12px hsl(var(--foreground) / 0.1);
		font-size: var(--text-xs);
		color: hsl(var(--muted-foreground));
		line-height: 1.4;
		white-space: normal;
		z-index: 50;
		pointer-events: none;
	}

	.token-stat-info:hover .token-stat-tooltip {
		display: block;
	}

	.token-stat-value {
		font-size: var(--text-sm);
		font-weight: var(--font-weight-medium);
		color: hsl(var(--foreground));
		font-variant-numeric: tabular-nums;
	}
</style>
