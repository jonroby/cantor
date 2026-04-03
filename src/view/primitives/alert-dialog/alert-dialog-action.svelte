<script lang="ts">
	import { AlertDialog as AlertDialogPrimitive } from 'bits-ui';

	let {
		ref = $bindable(null),
		class: className = '',
		children,
		...restProps
	}: AlertDialogPrimitive.ActionProps = $props();
</script>

<AlertDialogPrimitive.Action
	bind:ref
	data-slot="alert-dialog-action"
	class={`bits-alert-dialog-action ${typeof className === 'string' ? className : ''}`}
	{...restProps}
>
	{@render children?.()}
</AlertDialogPrimitive.Action>
