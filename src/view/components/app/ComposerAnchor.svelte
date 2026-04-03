<script lang="ts">
	import { ArrowDown, ArrowRight, ArrowLeft } from 'lucide-svelte';
	import { Composer } from '@/view/components/composer';

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
	class="absolute right-0 bottom-4 left-0 z-[25] px-4 transition-[left,right] duration-[250ms] ease-[ease] {composerSide ===
	'left'
		? 'right-1/2'
		: ''} {composerSide === 'right' ? 'left-1/2' : ''}"
	onmouseenter={() => (composerHovered = true)}
	onmouseleave={() => (composerHovered = false)}
>
	{#if hasChatPanel && chatScrolledAway}
		<button
			class="mx-auto mb-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-[0_1px_3px_hsl(var(--foreground)/0.1)] hover:bg-muted"
			onclick={onScrollToBottom}
			aria-label="Scroll to bottom"
		>
			<ArrowDown size={18} />
		</button>
	{/if}
	<div class="relative mx-auto max-w-[720px]">
		{#if composerHovered && isSplit}
			<button
				class={`absolute top-1/2 z-[30] flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-[0_1px_3px_hsl(var(--foreground)/0.1)] hover:bg-muted ${composerSide === 'right' ? 'left-[calc(-32px-16px)]' : 'right-[calc(-32px-16px)]'}`}
				onclick={() => onComposerPinChange(composerSide === 'right' ? 'left' : 'right')}
				aria-label={composerSide === 'right' ? 'Move composer left' : 'Move composer right'}
			>
				{#if composerSide === 'right'}
					<ArrowLeft size={18} />
				{:else}
					<ArrowRight size={18} />
				{/if}
			</button>
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
</div>
