<script lang="ts">
	import { onMount } from 'svelte';
	import { useSvelteFlow } from '@xyflow/svelte';

	interface Props {
		register: (api: ReturnType<typeof useSvelteFlow>) => void;
	}

	let { register }: Props = $props();

	onMount(() => {
		register(useSvelteFlow());
	});
</script>
