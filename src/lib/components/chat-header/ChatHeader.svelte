<script lang="ts">
	import Button from '$lib/components/ui/button.svelte';

	interface Props {
		visible: boolean;
		rootCount: number;
		activeRootIndex: number;
		onSelectRoot: (index: number) => void;
	}

	let { visible, rootCount, activeRootIndex, onSelectRoot }: Props = $props();
</script>

<div class="chat-header" class:chat-header-hidden={!visible}>
	{#if rootCount > 1}
		<Button
			class="chat-nav"
			variant="outline"
			size="icon"
			disabled={activeRootIndex === 0}
			onclick={() => onSelectRoot(activeRootIndex - 1)}
		>
			<svg
				width="14"
				height="14"
				viewBox="0 0 14 14"
				fill="none"
				stroke="currentColor"
				stroke-width="1.8"
				stroke-linecap="round"><path d="M9 2L4 7l5 5" /></svg
			>
		</Button>
	{/if}
	<div class="chat-header-label">
		{activeRootIndex === 0 ? 'Main Chat' : `Fork ${activeRootIndex}`}
	</div>
	{#if rootCount > 1}
		<Button
			class="chat-nav"
			variant="outline"
			size="icon"
			disabled={activeRootIndex === rootCount - 1}
			onclick={() => onSelectRoot(activeRootIndex + 1)}
		>
			<svg
				width="14"
				height="14"
				viewBox="0 0 14 14"
				fill="none"
				stroke="currentColor"
				stroke-width="1.8"
				stroke-linecap="round"><path d="M5 2l5 5-5 5" /></svg
			>
		</Button>
	{/if}
</div>
