<script lang="ts">
	import { Tooltip as TooltipPrimitive } from 'bits-ui';
	import type { ComponentProps } from 'svelte';
	import TooltipPortal from './tooltip-portal.svelte';

	type PortalProps = ComponentProps<typeof TooltipPortal>;

	let {
		ref = $bindable(null),
		class: className = '',
		sideOffset = 8,
		side = 'top',
		children,
		arrowClasses: _arrowClasses,
		portalProps,
		...restProps
	}: TooltipPrimitive.ContentProps & {
		arrowClasses?: string;
		portalProps?: Omit<PortalProps, 'children'>;
	} = $props();
</script>

<TooltipPortal {...portalProps}>
	<TooltipPrimitive.Content
		bind:ref
		data-slot="tooltip-content"
		{sideOffset}
		{side}
		class={`bits-tooltip-content ${typeof className === 'string' ? className : ''}`}
		{...restProps}
	>
		{@render children?.()}
	</TooltipPrimitive.Content>
</TooltipPortal>

<style>
	:global(.bits-tooltip-content) {
		font-size: var(--text-base);
		z-index: 50;
		display: inline-flex;
		width: fit-content;
		max-width: 20rem;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.75rem;
		border-radius: 0.375rem;
		background: var(--tooltip-bg);
		color: var(--tooltip-fg);
		box-shadow: var(--surface-floating-shadow);
		transform-origin: var(--bits-tooltip-content-transform-origin);
	}
</style>
