<script lang="ts">
	import { cn, type WithElementRef } from '@/lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div
	bind:this={ref}
	data-slot="alert-dialog-footer"
	class={cn(
		'bg-muted/50 -mx-4 -mb-4 rounded-b-xl p-4 gap-2 sm:flex-row sm:justify-end flex flex-col-reverse border-t group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2',
		className
	)}
	{...restProps}
>
	{@render children?.()}
</div>
