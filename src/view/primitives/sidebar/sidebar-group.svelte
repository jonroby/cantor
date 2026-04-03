<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	let { class: className = '', children, ...restProps }: HTMLAttributes<HTMLElement> = $props();
</script>

<div
	data-slot="sidebar-group"
	data-sidebar="group"
	class={`bits-sidebar-group ${className}`}
	{...restProps}
>
	{@render children?.()}
</div>

<style>
	:global(.bits-sidebar-group) {
		position: relative;
		display: flex;
		width: 100%;
		min-width: 0;
		flex-direction: column;
		padding: 0.5rem;
	}
</style>
