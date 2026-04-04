<script lang="ts">
	import * as Tooltip from '@/view/primitives/tooltip';
	import type { HTMLAttributes } from 'svelte/elements';
	import { setSidebar } from './context.svelte.js';

	let {
		open = $bindable(true),
		onOpenChange = () => {},
		class: className = '',
		style = '',
		children,
		...restProps
	}: HTMLAttributes<HTMLDivElement> & {
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
	} = $props();

	const sidebar = setSidebar({
		open: () => open,
		setOpen: (value: boolean) => {
			open = value;
			onOpenChange(value);
		}
	});
</script>

<svelte:window onkeydown={sidebar.handleShortcutKeydown} />

<Tooltip.Provider delayDuration={0}>
	<div
		data-slot="sidebar-wrapper"
		style={`--sidebar-width: 260px; --sidebar-width-icon: 3rem; ${style}`}
		class={`bits-sidebar-wrapper ${className}`}
		{...restProps}
	>
		{@render children?.()}
	</div>
</Tooltip.Provider>

<style>
	:global(.bits-sidebar-wrapper) {
		display: flex;
		flex-direction: row;
		width: 100%;
		height: 100vh;
		overflow: hidden;
	}
</style>
