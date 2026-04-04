<script lang="ts">
	import { ArrowDown, ArrowRight, ArrowLeft } from 'lucide-svelte';
	import { Composer } from '@/view/components/composer';
	import * as Tooltip from '@/view/primitives/tooltip';

	interface Props {
		composerSide: 'left' | 'right' | null;
		isSplit: boolean;
		hasChatPanel: boolean;
		chatScrolledAway: boolean;
		agentMode: boolean;
		activeDocumentFile: { content: string } | null;
		activeDocumentKey: { folderId: string; fileId: string } | null;
		composerRef: ReturnType<typeof Composer> | undefined;
		toolCallbacks: {
			onOpenDocument: (folderId: string, fileId: string) => void;
			onOpenFolder: (folderId: string) => void;
			onClosePanel: (index: number) => void;
			onToggleSidebar: () => void;
		};
		onScrollToBottom: () => void;
		onToggleMode: () => void;
		onScrollToNode: (nodeId: string | null) => void;
		onExpandSideChat: (exchangeId: string) => void;
		onComposerPinChange: (side: 'left' | 'right') => void;
	}

	let {
		composerSide,
		isSplit,
		hasChatPanel,
		chatScrolledAway,
		agentMode,
		activeDocumentFile,
		activeDocumentKey,
		composerRef = $bindable(),
		toolCallbacks,
		onScrollToBottom,
		onToggleMode,
		onScrollToNode,
		onExpandSideChat,
		onComposerPinChange
	}: Props = $props();

	let composerHovered = $state(false);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="composer-anchor"
	class:composer-left={composerSide === 'left'}
	class:composer-right={composerSide === 'right'}
	onmouseenter={() => (composerHovered = true)}
	onmouseleave={() => (composerHovered = false)}
>
	{#if hasChatPanel}
		<Tooltip.Provider>
			{#if chatScrolledAway}
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<button
								{...props}
								class="scroll-to-bottom-btn"
								onclick={onScrollToBottom}
								aria-label="Scroll to bottom"
							>
								<ArrowDown size={18} />
							</button>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content side="top">Scroll to bottom</Tooltip.Content>
				</Tooltip.Root>
			{/if}
			<div class="composer-wrap">
				{#if composerHovered && isSplit}
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<button
									{...props}
									class="composer-move-btn"
									class:composer-move-left={composerSide === 'right'}
									class:composer-move-right={composerSide !== 'right'}
									onclick={() => onComposerPinChange(composerSide === 'right' ? 'left' : 'right')}
									aria-label={composerSide === 'right'
										? 'Move composer left'
										: 'Move composer right'}
								>
									{#if composerSide === 'right'}
										<ArrowLeft size={18} />
									{:else}
										<ArrowRight size={18} />
									{/if}
								</button>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content side="top">
							{composerSide === 'right' ? 'Move composer left' : 'Move composer right'}
						</Tooltip.Content>
					</Tooltip.Root>
				{/if}
				<Composer
					bind:this={composerRef}
					{agentMode}
					{onToggleMode}
					liveDocumentContent={activeDocumentFile?.content}
					{activeDocumentKey}
					{toolCallbacks}
					{onScrollToNode}
					{onExpandSideChat}
					anchored={true}
				/>
			</div>
		</Tooltip.Provider>
	{/if}
</div>

<style>
	.composer-anchor {
		position: absolute;
		bottom: 1rem;
		left: 0;
		right: 0;
		z-index: 25;
		padding: 0 var(--pane-padding-h);
		transition:
			left 250ms ease,
			right 250ms ease;
	}

	.composer-left {
		right: 50%;
	}

	.composer-right {
		left: 50%;
	}

	.scroll-to-bottom-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		margin: 0 auto 0.5rem;
		border-radius: 50%;
		border: 1px solid var(--border-color);
		background: hsl(var(--background));
		color: hsl(var(--muted-foreground));
		cursor: pointer;
		box-shadow: 0 1px 3px hsl(var(--foreground) / 0.1);
	}

	.scroll-to-bottom-btn:hover {
		background: hsl(var(--muted));
	}

	.composer-wrap {
		position: relative;
		max-width: var(--pane-content-width);
		margin: 0 auto;
	}

	.composer-move-btn {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: 1px solid var(--border-color);
		background: hsl(var(--background));
		color: hsl(var(--muted-foreground));
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		box-shadow: 0 1px 3px hsl(var(--foreground) / 0.1);
		z-index: 30;
	}

	.composer-move-btn:hover {
		background: hsl(var(--muted));
	}

	.composer-move-right {
		right: calc(-32px - 16px);
	}

	.composer-move-right::before {
		content: '';
		position: absolute;
		top: -8px;
		bottom: -8px;
		left: -16px;
		right: -8px;
	}

	.composer-move-left {
		left: calc(-32px - 16px);
	}

	.composer-move-left::before {
		content: '';
		position: absolute;
		top: -8px;
		bottom: -8px;
		left: -8px;
		right: -16px;
	}
</style>
