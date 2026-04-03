<script lang="ts">
	import * as Tooltip from '@/view/primitives/tooltip';
	import type { ComponentProps, Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { useSidebar } from './context.svelte.js';

	let {
		class: className = '',
		children,
		child,
		variant = 'default',
		size = 'default',
		isActive = false,
		tooltipContent,
		tooltipContentProps,
		...restProps
	}: HTMLAttributes<HTMLButtonElement> & {
		isActive?: boolean;
		variant?: 'default' | 'outline';
		size?: 'default' | 'sm' | 'lg';
		tooltipContent?: Snippet | string;
		tooltipContentProps?: Omit<ComponentProps<typeof Tooltip.Content>, 'children'>;
		child?: Snippet<[{ props: Record<string, unknown> }]>;
	} = $props();

	const sidebar = useSidebar();

	function composeHandlers(
		first?: ((event: Event) => void) | null,
		second?: ((event: Event) => void) | null
	) {
		if (!first) return second ?? undefined;
		if (!second) return first;
		return (event: Event) => {
			first(event);
			second(event);
		};
	}

	const buttonProps = $derived({
		class:
			`bits-sidebar-menu-button bits-sidebar-menu-button-${variant} bits-sidebar-menu-button-${size} ${isActive ? 'bits-sidebar-menu-button-active' : ''} ${className}`.trim(),
		'data-slot': 'sidebar-menu-button',
		'data-sidebar': 'menu-button',
		'data-size': size,
		'data-active': isActive,
		...restProps
	});
</script>

{#snippet Button({ props }: { props?: Record<string, unknown> })}
	{@const mergedProps = {
		...buttonProps,
		...props,
		class: `${String(buttonProps.class ?? '')} ${String(props?.class ?? '')}`.trim(),
		onclick: composeHandlers(
			buttonProps.onclick as ((event: Event) => void) | undefined,
			props?.onclick as ((event: Event) => void) | undefined
		)
	}}
	{#if child}
		{@render child({ props: mergedProps })}
	{:else}
		<button {...mergedProps}>
			{@render children?.()}
		</button>
	{/if}
{/snippet}

{#if !tooltipContent}
	{@render Button({})}
{:else}
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				{@render Button({ props })}
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content
			side="right"
			align="center"
			hidden={sidebar.state !== 'collapsed' || sidebar.isMobile}
			{...tooltipContentProps}
		>
			{#if typeof tooltipContent === 'string'}
				{tooltipContent}
			{:else if tooltipContent}
				{@render tooltipContent()}
			{/if}
		</Tooltip.Content>
	</Tooltip.Root>
{/if}

<style>
	:global(.bits-sidebar-menu-button) {
		display: flex;
		width: 100%;
		align-items: center;
		gap: 0.5rem;
		overflow: hidden;
		padding: 0.5rem;
		border: none;
		border-radius: 0.375rem;
		background: transparent;
		text-align: left;
		font-size: var(--text-sm);
		color: inherit;
		cursor: pointer;
		outline: none;
		transition:
			width 150ms ease,
			height 150ms ease,
			padding 150ms ease,
			background 120ms ease,
			color 120ms ease;
	}

	:global(.bits-sidebar-menu-button:hover),
	:global(.bits-sidebar-menu-button[data-active='true']) {
		background: hsl(var(--sidebar-accent));
		color: hsl(var(--sidebar-accent-foreground));
	}

	:global(.bits-sidebar-menu-button-default) {
		height: 2rem;
	}

	:global(.bits-sidebar-menu-button-sm) {
		height: 1.75rem;
		font-size: var(--text-xs);
	}

	:global(.bits-sidebar-menu-button-lg) {
		height: 3rem;
		font-size: var(--text-sm);
	}

	:global(.bits-sidebar-root[data-collapsible='icon'] .bits-sidebar-menu-button) {
		width: 2rem;
		padding: 0.5rem;
	}

	:global(.bits-sidebar-menu-button > span:last-child) {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
