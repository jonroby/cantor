<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	let {
		class: className = '',
		children,
		...restProps
	}: HTMLAttributes<HTMLUListElement> = $props();
</script>

<ul
	data-slot="sidebar-menu"
	data-sidebar="menu"
	class={`bits-sidebar-menu ${className}`}
	{...restProps}
>
	{@render children?.()}
</ul>

<style>
	:global(.bits-sidebar-menu) {
		display: flex;
		width: 100%;
		min-width: 0;
		flex-direction: column;
		gap: 0;
	}
</style>
