<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { useSidebar } from './context.svelte.js';

	let {
		class: className = '',
		side = 'left',
		variant = 'sidebar',
		collapsible = 'offcanvas',
		children,
		...restProps
	}: HTMLAttributes<HTMLDivElement> & {
		side?: 'left' | 'right';
		variant?: 'sidebar' | 'floating' | 'inset';
		collapsible?: 'offcanvas' | 'icon' | 'none';
	} = $props();

	const sidebar = useSidebar();
</script>

<div
	data-state={sidebar.state}
	data-collapsible={sidebar.state === 'collapsed' ? collapsible : ''}
	data-variant={variant}
	data-side={side}
	data-slot="sidebar"
	class={`bits-sidebar-root ${className}`}
	{...restProps}
>
	<div data-sidebar="sidebar" data-slot="sidebar-inner" class="bits-sidebar-inner">
		{@render children?.()}
	</div>
</div>

<style>
	:global(.bits-sidebar-root) {
		display: flex;
		flex: none;
		flex-direction: column;
		height: 100vh;
		font-size: var(--text-sidebar);
		color: hsl(var(--sidebar-foreground));
		transition: width 200ms ease;
	}

	:global(.bits-sidebar-root[data-collapsible='icon']) {
		width: var(--sidebar-width-icon);
	}

	:global(.bits-sidebar-root:not([data-collapsible='icon'])) {
		width: var(--sidebar-width);
	}

	:global(.bits-sidebar-inner) {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: hsl(var(--sidebar));
		border-right: 1px solid var(--border-color);
	}

	:global(.bits-sidebar-root[data-collapsible='icon'] .bits-sidebar-inner) {
		border-right: none;
	}

	:global(.bits-sidebar-root[data-side='right'] .bits-sidebar-inner) {
		border-right: none;
		border-left: 1px solid var(--border-color);
	}
</style>
