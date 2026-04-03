<script lang="ts">
	import { cn, type WithElementRef } from '@/view/primitives/shadcn';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLElement>> = $props();
</script>

<main
	bind:this={ref}
	data-slot="sidebar-inset"
	class={cn('bg-background relative flex flex-1 flex-col overflow-hidden', className)}
	{...restProps}
>
	{@render children?.()}
</main>
