<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn, type WithElementRef } from '@/view/components/shadcn/utils';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLSpanElement>> = $props();
</script>

<span
	bind:this={ref}
	data-slot="dropdown-menu-shortcut"
	class={cn(
		'text-muted-foreground group-focus/dropdown-menu-item:text-accent-foreground text-xs tracking-widest ml-auto',
		className
	)}
	{...restProps}
>
	{@render children?.()}
</span>
