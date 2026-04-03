<script lang="ts">
	import { AlertDialog as AlertDialogPrimitive } from 'bits-ui';
	import type { ComponentProps } from 'svelte';
	import AlertDialogPortal from './alert-dialog-portal.svelte';
	import AlertDialogOverlay from './alert-dialog-overlay.svelte';

	type PortalProps = ComponentProps<typeof AlertDialogPortal>;

	let {
		ref = $bindable(null),
		class: className = '',
		portalProps,
		children,
		...restProps
	}: AlertDialogPrimitive.ContentProps & {
		portalProps?: Omit<PortalProps, 'children'>;
	} = $props();
</script>

<AlertDialogPortal {...portalProps}>
	<AlertDialogOverlay />
	<AlertDialogPrimitive.Content
		bind:ref
		data-slot="alert-dialog-content"
		class={`bits-alert-dialog-content ${typeof className === 'string' ? className : ''}`}
		{...restProps}
	>
		{@render children?.()}
	</AlertDialogPrimitive.Content>
</AlertDialogPortal>

<style>
	:global(.bits-alert-dialog-content) {
		position: fixed;
		top: 50%;
		left: 50%;
		z-index: 50;
		transform: translate(-50%, -50%);
		outline: none;
	}
</style>
