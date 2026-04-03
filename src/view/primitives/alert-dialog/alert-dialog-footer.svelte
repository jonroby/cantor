<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	let { class: className = '', children, ...restProps }: HTMLAttributes<HTMLDivElement> = $props();
</script>

<div class={`bits-alert-dialog-footer ${className}`} data-slot="alert-dialog-footer" {...restProps}>
	{@render children?.()}
</div>

<style>
	:global(.bits-alert-dialog-footer) {
		display: flex;
	}
</style>
