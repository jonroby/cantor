<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';

	let {
		ref = $bindable(null),
		class: className = '',
		children,
		...restProps
	}: DropdownMenuPrimitive.ItemProps = $props();
</script>

<DropdownMenuPrimitive.Item
	bind:ref
	data-slot="dropdown-menu-item"
	class={`bits-dropdown-menu-item ${typeof className === 'string' ? className : ''}`}
	{...restProps}
>
	{@render children?.()}
</DropdownMenuPrimitive.Item>
