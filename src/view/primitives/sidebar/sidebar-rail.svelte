<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { useSidebar } from './context.svelte.js';

	let {
		class: className = '',
		children,
		...restProps
	}: HTMLAttributes<HTMLButtonElement> = $props();
	const sidebar = useSidebar();
</script>

<button
	data-sidebar="rail"
	data-slot="sidebar-rail"
	aria-label="Toggle Sidebar"
	tabindex={-1}
	onclick={sidebar.toggle}
	title="Toggle Sidebar"
	class={`bits-sidebar-rail ${className}`}
	{...restProps}
>
	{@render children?.()}
</button>

<style>
	:global(.bits-sidebar-rail) {
		position: absolute;
		inset-block: 0;
		right: -0.5rem;
		z-index: 20;
		display: none;
		width: 1rem;
		background: transparent;
		border: none;
		cursor: ew-resize;
	}

	:global(.bits-sidebar-rail::after) {
		content: '';
		position: absolute;
		inset-block: 0;
		left: 50%;
		width: 2px;
	}

	:global(.bits-sidebar-rail:hover::after) {
		background: hsl(var(--sidebar-border));
	}

	@media (min-width: 640px) {
		:global(.bits-sidebar-rail) {
			display: block;
		}
	}
</style>
