<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	let { class: className = '', ...restProps }: HTMLAttributes<HTMLDivElement> = $props();
</script>

<div
	data-slot="sidebar-separator"
	data-sidebar="separator"
	class={`bits-sidebar-separator ${className}`}
	{...restProps}
></div>

<style>
	:global(.bits-sidebar-separator) {
		height: 1px;
		margin: 0 0.5rem;
		background: hsl(var(--sidebar-border));
	}
</style>
