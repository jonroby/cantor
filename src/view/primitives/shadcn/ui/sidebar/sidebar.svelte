<script lang="ts">
	import * as Sheet from '@/view/primitives/shadcn/ui/sheet';
	import { cn, type WithElementRef } from '@/view/primitives/shadcn';
	import type { HTMLAttributes } from 'svelte/elements';
	import { SIDEBAR_WIDTH_MOBILE } from './constants.js';
	import { useSidebar } from './context.svelte.js';

	let {
		ref = $bindable(null),
		side = 'left',
		variant = 'sidebar',
		collapsible = 'offcanvas',
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		side?: 'left' | 'right';
		variant?: 'sidebar' | 'floating' | 'inset';
		collapsible?: 'offcanvas' | 'icon' | 'none';
	} = $props();

	const sidebar = useSidebar();
</script>

{#if collapsible === 'none'}
	<div
		class={cn(
			'flex h-full w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground',
			className
		)}
		bind:this={ref}
		{...restProps}
	>
		{@render children?.()}
	</div>
{:else if sidebar.isMobile}
	<Sheet.Root bind:open={() => sidebar.openMobile, (v) => sidebar.setOpenMobile(v)} {...restProps}>
		<Sheet.Content
			bind:ref
			data-sidebar="sidebar"
			data-slot="sidebar"
			data-mobile="true"
			class={cn(
				'w-(--sidebar-width) bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden',
				className
			)}
			style="--sidebar-width: {SIDEBAR_WIDTH_MOBILE};"
			{side}
		>
			<Sheet.Header class="sr-only">
				<Sheet.Title>Sidebar</Sheet.Title>
				<Sheet.Description>Displays the mobile sidebar.</Sheet.Description>
			</Sheet.Header>
			<div class="flex h-full w-full flex-col">
				{@render children?.()}
			</div>
		</Sheet.Content>
	</Sheet.Root>
{:else}
	<div
		bind:this={ref}
		class={cn(
			'group peer hidden h-svh flex-none flex-col text-sidebar-foreground md:flex',
			'transition-[width] duration-200 ease-linear',
			sidebar.state === 'expanded' ? 'w-(--sidebar-width)' : 'w-(--sidebar-width-icon)',
			className
		)}
		data-state={sidebar.state}
		data-collapsible={sidebar.state === 'collapsed' ? collapsible : ''}
		data-variant={variant}
		data-side={side}
		data-slot="sidebar"
		{...restProps}
	>
		<div
			data-sidebar="sidebar"
			data-slot="sidebar-inner"
			class={cn(
				'flex size-full flex-col overflow-hidden border-sidebar-border bg-sidebar',
				side === 'left' ? 'border-e' : 'border-s'
			)}
		>
			{@render children?.()}
		</div>
	</div>
{/if}
