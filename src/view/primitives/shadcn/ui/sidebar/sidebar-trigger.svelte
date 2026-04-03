<script lang="ts">
	import { Button } from '@/view/primitives/shadcn/ui/button';
	import * as Tooltip from '@/view/primitives/shadcn/ui/tooltip';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { SidebarLeftIcon } from '@hugeicons/core-free-icons';
	import { cn } from '@/view/primitives/shadcn';
	import type { ComponentProps } from 'svelte';
	import { useSidebar } from './context.svelte.js';

	let {
		ref = $bindable(null),
		class: className,
		onclick,
		...restProps
	}: ComponentProps<typeof Button> & {
		onclick?: (e: MouseEvent) => void;
	} = $props();

	const sidebar = useSidebar();
</script>

<Tooltip.Root>
	<Tooltip.Trigger>
		{#snippet child({ props })}
			<Button
				bind:ref
				{...props}
				data-sidebar="trigger"
				data-slot="sidebar-trigger"
				variant="ghost"
				size="icon-sm"
				class={cn(
					'cn-sidebar-trigger cursor-pointer rounded-lg hover:bg-sidebar-accent',
					className
				)}
				type="button"
				onclick={(e) => {
					onclick?.(e);
					sidebar.toggle();
				}}
				{...restProps}
			>
				<HugeiconsIcon icon={SidebarLeftIcon} strokeWidth={2} />
				<span class="sr-only">Close sidebar</span>
			</Button>
		{/snippet}
	</Tooltip.Trigger>
	<Tooltip.Content side="right" class="text-xs tooltip-dark">Close sidebar</Tooltip.Content>
</Tooltip.Root>
