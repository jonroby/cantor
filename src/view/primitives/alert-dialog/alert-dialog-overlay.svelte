<script lang="ts">
	import { AlertDialog as AlertDialogPrimitive } from 'bits-ui';

	let {
		ref = $bindable(null),
		class: className = '',
		...restProps
	}: AlertDialogPrimitive.OverlayProps = $props();
</script>

<AlertDialogPrimitive.Overlay
	bind:ref
	data-slot="alert-dialog-overlay"
	class={`bits-alert-dialog-overlay ${typeof className === 'string' ? className : ''}`}
	{...restProps}
/>

<style>
	:global(.bits-alert-dialog-overlay) {
		position: fixed;
		inset: 0;
		z-index: 50;
		background: var(--surface-overlay-strong);
	}
</style>
