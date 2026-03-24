<script lang="ts">
	import { cn } from '@/lib/utils';

	interface Props {
		class?: string;
		type?: string;
		value?: string;
		placeholder?: string;
		disabled?: boolean;
		id?: string;
	}

	let {
		class: className = '',
		type = 'text',
		value = $bindable(''),
		placeholder,
		disabled = false,
		id
	}: Props = $props();
</script>

<input
	{id}
	bind:value
	{type}
	{placeholder}
	{disabled}
	class={cn('ui-input', className)}
/>
