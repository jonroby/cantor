<script lang="ts">
	interface Props {
		class?: string;
		type?: string;
		value?: string;
		placeholder?: string;
		disabled?: boolean;
		id?: string;
		onkeydown?: (e: KeyboardEvent) => void;
	}

	let {
		class: className = '',
		type = 'text',
		value = $bindable(''),
		placeholder,
		disabled = false,
		id,
		onkeydown
	}: Props = $props();

	let inputEl: HTMLInputElement | undefined = $state();

	export function focus() {
		inputEl?.focus();
	}

	function joinClasses(...classes: Array<string | undefined | false>) {
		return classes.filter(Boolean).join(' ');
	}
</script>

<input
	{id}
	bind:this={inputEl}
	bind:value
	{type}
	{placeholder}
	{disabled}
	class={joinClasses('ui-input', className)}
	{onkeydown}
/>
