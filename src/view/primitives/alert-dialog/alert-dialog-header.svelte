<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	let { class: className = '', children, ...restProps }: HTMLAttributes<HTMLDivElement> = $props();
</script>

<div class={`bits-alert-dialog-header ${className}`} data-slot="alert-dialog-header" {...restProps}>
	{@render children?.()}
</div>

<style>
	:global(.bits-alert-dialog-header) {
		display: flex;
		flex-direction: column;
	}
</style>
