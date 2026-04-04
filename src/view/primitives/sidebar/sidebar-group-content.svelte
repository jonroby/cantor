<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	let { class: className = '', children, ...restProps }: HTMLAttributes<HTMLDivElement> = $props();
</script>

<div
	data-slot="sidebar-group-content"
	data-sidebar="group-content"
	class={`bits-sidebar-group-content ${className}`}
	{...restProps}
>
	{@render children?.()}
</div>

<style>
	:global(.bits-sidebar-group-content) {
		width: 100%;
	}
</style>
