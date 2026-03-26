<script lang="ts">
	import { tick } from 'svelte';

	interface Props {
		value: string;
		onCommit: (value: string) => void;
		onCancel: () => void;
	}

	let { value = $bindable(), onCommit, onCancel }: Props = $props();

	function focusAndSelect(node: HTMLInputElement) {
		tick().then(() => {
			node.focus();
			node.select();
		});
	}
</script>

<input
	type="text"
	bind:value
	use:focusAndSelect
	onblur={() => onCommit(value)}
	onkeydown={(e) => {
		if (e.key === 'Enter') onCommit(value);
		if (e.key === 'Escape') onCancel();
	}}
	onclick={(e) => e.stopPropagation()}
	class="text-sm text-sidebar-foreground w-full border-none bg-transparent outline-none"
/>
