<script lang="ts">
	import { cn } from '@/lib/utils';

	type Variant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
	type Size = 'default' | 'sm' | 'lg' | 'icon';

	interface Props {
		type?: 'button' | 'submit' | 'reset';
		variant?: Variant;
		size?: Size;
		class?: string;
		disabled?: boolean;
		ariaLabel?: string;
		onclick?: (event: MouseEvent) => void;
		children?: import('svelte').Snippet;
	}

	let {
		type = 'button',
		variant = 'default',
		size = 'default',
		class: className = '',
		disabled = false,
		ariaLabel,
		onclick,
		children
	}: Props = $props();

	const variants: Record<Variant, string> = {
		default: 'ui-button-default',
		secondary: 'ui-button-secondary',
		outline: 'ui-button-outline',
		ghost: 'ui-button-ghost',
		destructive: 'ui-button-destructive'
	};

	const sizes: Record<Size, string> = {
		default: 'ui-button-size-default',
		sm: 'ui-button-size-sm',
		lg: 'ui-button-size-lg',
		icon: 'ui-button-size-icon'
	};
</script>

<button
	{type}
	{disabled}
	aria-label={ariaLabel}
	class={cn('ui-button', variants[variant], sizes[size], className)}
	onclick={onclick}
>
	{@render children?.()}
</button>
