<script lang="ts">
	import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-svelte';
	import { Button, Header } from '@/view/primitives';
	import * as Tooltip from '@/view/primitives/tooltip';

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

<Tooltip.Provider>
{#if sideChatCount > 0}
	<Header>
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						class="ghost-button"
						variant="ghost"
						size="sm"
						disabled={sideChatIndex <= 0}
						onclick={onPrev}
					>
						<ChevronLeft size={14} />
					</Button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content>Previous</Tooltip.Content>
		</Tooltip.Root>
		<span class="chatview-side-counter">
			{#if isNewSideChat}
				New
			{:else}
				{sideChatIndex + 1} / {sideChatCount}
			{/if}
		</span>
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						class="ghost-button"
						variant="ghost"
						size="sm"
						disabled={sideChatIndex >= sideChatCount - 1}
						onclick={onNext}
					>
						<ChevronRight size={14} />
					</Button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content>Next</Tooltip.Content>
		</Tooltip.Root>
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						class="ghost-button"
						variant="ghost"
						size="sm"
						disabled={isNewSideChat}
						onclick={onNew}
						ariaLabel="New side chat"
					>
						<Plus size={14} />
					</Button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content>New side chat</Tooltip.Content>
		</Tooltip.Root>
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						class="ghost-button sidepanel-close-btn"
						variant="ghost"
						size="sm"
						onclick={onClose}
						ariaLabel="Close side panel"
					>
						<X size={14} />
					</Button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content>Close</Tooltip.Content>
		</Tooltip.Root>
	</Header>
{:else}
	<Header>
		<span class="chatview-side-counter">New side chat</span>
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						class="ghost-button sidepanel-close-btn"
						variant="ghost"
						size="sm"
						onclick={onClose}
						ariaLabel="Close side panel"
					>
						<X size={14} />
					</Button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content>Close</Tooltip.Content>
		</Tooltip.Root>
	</Header>
{/if}
</Tooltip.Provider>

<style>
	.chatview-side-counter {
		color: hsl(var(--muted-foreground));
		min-width: 3rem;
		text-align: center;
		font-size: 12px;
	}

	:global(.sidepanel-close-btn) {
		margin-left: auto;
	}
</style>
