<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	let { class: className = '', children, ...restProps }: HTMLAttributes<HTMLElement> = $props();
</script>

<main data-slot="sidebar-inset" class={`bits-sidebar-inset ${className}`} {...restProps}>
	{@render children?.()}
</main>

<style>
	:global(.bits-sidebar-inset) {
		position: relative;
		display: flex;
		flex: 1;
		flex-direction: column;
		overflow: hidden;
		background: hsl(var(--background));
	}
</style>
