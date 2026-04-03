<script lang="ts">
	import { AlertDialog as AlertDialogPrimitive } from 'bits-ui';

	let {
		ref = $bindable(null),
		class: className = '',
		children,
		...restProps
	}: AlertDialogPrimitive.CancelProps = $props();
</script>

<AlertDialogPrimitive.Cancel
	bind:ref
	data-slot="alert-dialog-cancel"
	class={`bits-alert-dialog-cancel ${typeof className === 'string' ? className : ''}`}
	{...restProps}
>
	{@render children?.()}
</AlertDialogPrimitive.Cancel>
