<script lang="ts">
	type Variant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
	type Size = 'default' | 'sm' | 'lg' | 'icon';

	interface Props {
		type?: 'button' | 'submit' | 'reset';
		variant?: Variant;
		size?: Size;
		class?: string;
		disabled?: boolean;
		ariaLabel?: string;
		title?: string;
		onclick?: (event: MouseEvent) => void;
		children?: import('svelte').Snippet;
		[key: string]: unknown;
	}

	let {
		type = 'button',
		variant = 'default',
		size = 'default',
		class: className = '',
		disabled = false,
		ariaLabel,
		title,
		onclick,
		children,
		...restProps
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

	function joinClasses(...classes: Array<string | undefined | false>) {
		return classes.filter(Boolean).join(' ');
	}
</script>

<button
	{type}
	{disabled}
	{title}
	aria-label={ariaLabel}
	class={joinClasses('ui-button', variants[variant], sizes[size], className)}
	{onclick}
	{...restProps}
>
	{@render children?.()}
</button>
