<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
	import type { ComponentProps } from 'svelte';
	import DropdownMenuPortal from './dropdown-menu-portal.svelte';

	type PortalProps = ComponentProps<typeof DropdownMenuPortal>;

	let {
		ref = $bindable(null),
		sideOffset = 4,
		align = 'start',
		portalProps,
		class: className = '',
		children,
		...restProps
	}: DropdownMenuPrimitive.ContentProps & {
		portalProps?: Omit<PortalProps, 'children'>;
	} = $props();
</script>

<DropdownMenuPortal {...portalProps}>
	<DropdownMenuPrimitive.Content
		bind:ref
		data-slot="dropdown-menu-content"
		{sideOffset}
		{align}
		class={`bits-dropdown-menu-content ${typeof className === 'string' ? className : ''}`}
		{...restProps}
	>
		{@render children?.()}
	</DropdownMenuPrimitive.Content>
</DropdownMenuPortal>

<style>
	:global(.bits-dropdown-menu-content) {
		z-index: 50;
		outline: none;
	}
</style>
