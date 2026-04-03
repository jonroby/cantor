<script lang="ts">
	import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-svelte';
	import { Button, Header } from '@/view/primitives';

	interface Props {
		sideChatIndex: number;
		sideChatCount: number;
		onPrev: () => void;
		onNext: () => void;
		onNew: () => void;
		onClose: () => void;
	}

	let { sideChatIndex, sideChatCount, onPrev, onNext, onNew, onClose }: Props = $props();

	let isNewSideChat = $derived(sideChatIndex >= sideChatCount);
</script>

{#if sideChatCount > 0}
	<Header>
		<Button
			class="ghost-button"
			variant="ghost"
			size="sm"
			disabled={sideChatIndex <= 0}
			onclick={onPrev}
		>
			<ChevronLeft size={14} />
		</Button>
		<span class="chatview-side-counter">
			{#if isNewSideChat}
				New
			{:else}
				{sideChatIndex + 1} / {sideChatCount}
			{/if}
		</span>
		<Button
			class="ghost-button"
			variant="ghost"
			size="sm"
			disabled={sideChatIndex >= sideChatCount - 1}
			onclick={onNext}
		>
			<ChevronRight size={14} />
		</Button>
		<Button
			class="ghost-button"
			variant="ghost"
			size="sm"
			disabled={isNewSideChat}
			onclick={onNew}
			ariaLabel="New side chat"
		>
			<Plus size={14} />
		</Button>
		<Button
			class="ghost-button ml-auto"
			variant="ghost"
			size="sm"
			onclick={onClose}
			ariaLabel="Close side panel"
		>
			<X size={14} />
		</Button>
	</Header>
{:else}
	<Header>
		<span class="chatview-side-counter">New side chat</span>
		<Button
			class="ghost-button ml-auto"
			variant="ghost"
			size="sm"
			onclick={onClose}
			ariaLabel="Close side panel"
		>
			<X size={14} />
		</Button>
	</Header>
{/if}

<style>
	.chatview-side-counter {
		font-size: var(--text-base);
		color: hsl(var(--muted-foreground));
		min-width: 3rem;
		text-align: center;
	}
</style>
