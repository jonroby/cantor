<script lang="ts">
	import { cn } from '@/components/shadcn/utils';

	interface Props {
		class?: string;
		type?: string;
		value?: string;
		placeholder?: string;
		disabled?: boolean;
		id?: string;
		autofocus?: boolean;
		onkeydown?: (e: KeyboardEvent) => void;
	}

	let {
		class: className = '',
		type = 'text',
		value = $bindable(''),
		placeholder,
		disabled = false,
		id,
		autofocus = false,
		onkeydown
	}: Props = $props();
</script>

<input
	{id}
	bind:value
	{type}
	{placeholder}
	{disabled}
	class={cn('ui-input', className)}
	autofocus={autofocus ? true : undefined}
	{onkeydown}
/>
