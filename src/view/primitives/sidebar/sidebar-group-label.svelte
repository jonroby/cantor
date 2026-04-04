<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		children,
		child,
		class: className = '',
		...restProps
	}: HTMLAttributes<HTMLElement> & {
		child?: Snippet<[{ props: Record<string, unknown> }]>;
	} = $props();

	const mergedProps = $derived({
		class: `bits-sidebar-group-label ${className}`.trim(),
		'data-slot': 'sidebar-group-label',
		'data-sidebar': 'group-label',
		...restProps
	});
</script>

{#if child}
	{@render child({ props: mergedProps })}
{:else}
	<div {...mergedProps}>
		{@render children?.()}
	</div>
{/if}

<style>
	:global(.bits-sidebar-group-label) {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		height: 2rem;
		padding: 0 0.5rem;
		border-radius: 0.375rem;
		font-size: var(--text-xs);
		font-weight: var(--font-weight-medium);
		color: hsl(var(--sidebar-foreground) / 0.7);
		transition:
			margin 200ms ease,
			opacity 200ms ease;
	}

	:global(.bits-sidebar-root[data-collapsible='icon'] .bits-sidebar-group-label) {
		margin-top: -2rem;
		opacity: 0;
	}
</style>
