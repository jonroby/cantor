<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	let { class: className = '', children, ...restProps }: HTMLAttributes<HTMLLIElement> = $props();
</script>

<li
	data-slot="sidebar-menu-item"
	data-sidebar="menu-item"
	class={`bits-sidebar-menu-item ${className}`}
	{...restProps}
>
	{@render children?.()}
</li>

<style>
	:global(.bits-sidebar-menu-item) {
		position: relative;
		list-style: none;
	}
</style>
