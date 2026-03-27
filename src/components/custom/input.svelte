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

	let inputEl: HTMLInputElement | undefined = $state();

	export function focus() {
		inputEl?.focus();
	}
</script>

<input
	{id}
	bind:this={inputEl}
	bind:value
	{type}
	{placeholder}
	{disabled}
	class={cn('ui-input', className)}
	autofocus={autofocus ? true : undefined}
	{onkeydown}
/>
