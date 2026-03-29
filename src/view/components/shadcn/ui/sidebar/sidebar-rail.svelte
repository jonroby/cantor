<script lang="ts">
	import { cn, type WithElementRef } from '@/view/components/shadcn/utils';
	import type { HTMLAttributes } from 'svelte/elements';
	import { useSidebar } from './context.js';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLButtonElement>, HTMLButtonElement> = $props();

	const sidebar = useSidebar();
</script>

<button
	bind:this={ref}
	data-sidebar="rail"
	data-slot="sidebar-rail"
	aria-label="Toggle Sidebar"
	tabindex={-1}
	onclick={sidebar.toggle}
	title="Toggle Sidebar"
	class={cn(
		'hover:after:bg-sidebar-border inset-y-0 w-4 group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:inset-y-0 sm:flex absolute z-20 hidden -translate-x-1/2 transition-all ease-linear after:absolute after:left-1/2 after:w-[2px]',
		'in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize',
		'[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize',
		'hover:group-data-[collapsible=offcanvas]:bg-sidebar group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full',
		'[[data-side=left][data-collapsible=offcanvas]_&]:-right-2',
		'[[data-side=right][data-collapsible=offcanvas]_&]:-left-2',
		className
	)}
	{...restProps}
>
	{@render children?.()}
</button>
