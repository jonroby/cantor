<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	let { class: className = '', children, ...restProps }: HTMLAttributes<HTMLElement> = $props();
</script>

<div
	data-slot="sidebar-header"
	data-sidebar="header"
	class={`bits-sidebar-header ${className}`}
	{...restProps}
>
	{@render children?.()}
</div>

<style>
	:global(.bits-sidebar-header) {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.5rem;
	}
</style>
