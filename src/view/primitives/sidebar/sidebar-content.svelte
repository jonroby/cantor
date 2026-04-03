<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	let { class: className = '', children, ...restProps }: HTMLAttributes<HTMLElement> = $props();
</script>

<div
	data-slot="sidebar-content"
	data-sidebar="content"
	class={`bits-sidebar-content ${className}`}
	{...restProps}
>
	{@render children?.()}
</div>

<style>
	:global(.bits-sidebar-content) {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
		overflow: auto;
	}

	:global(.bits-sidebar-root[data-collapsible='icon'] .bits-sidebar-content) {
		overflow: hidden;
	}
</style>
