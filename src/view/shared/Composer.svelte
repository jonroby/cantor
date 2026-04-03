<script lang="ts">
	import { tick } from 'svelte';
	import ComposerInput from './ComposerInput.svelte';
	import { ModelPalette } from '@/view/features/model-palette';
	import * as app from '@/app';

	interface Props {
		onScrollToNode: (nodeId: string | null) => void;
		onExpandSideChat: (exchangeId: string) => void;
		agentMode?: boolean;
		liveDocumentContent?: string;
		activeDocumentKey?: { folderId: string; fileId: string } | null;
		onToggleMode?: () => void;
		toolCallbacks?: app.chat.SubmitOptions['toolCallbacks'];
	}

	let {
		onScrollToNode,
		onExpandSideChat,
		agentMode = false,
		liveDocumentContent,
		activeDocumentKey = null,
		onToggleMode,
		toolCallbacks
	}: Props = $props();

	let composerValue = $state('');
	let pendingImages: app.chat.ImageAttachment[] = $state([]);
	let paletteOpen = $state(false);
	let operationError: string | null = $state(null);
	let composerRef: ReturnType<typeof ComposerInput> | undefined = $state();
	let providerState = $derived(app.providers.getState());
	let activeChat = $derived(app.chat.getChat());

	export function focus() {
		composerRef?.focus();
	}

	let activeExchanges = $derived(activeChat.exchanges);
	let activeTree = $derived({ rootId: activeChat.rootId, exchanges: activeChat.exchanges });
	let activeExchangeId = $derived(app.chat.getActiveExchangeId());
	let contextStrategy = $derived(app.chat.getContextStrategy());
	let usedTokens = $derived(
		activeExchangeId ? app.chat.getUsedTokens(activeTree, activeExchangeId) : 0
	);
	let activeNodeStreaming = $derived.by(() => {
		const id = activeExchangeId;
		if (!id) return false;
		return app.chat.isStreaming(id);
	});
	let submitDisabledReason = $derived(
		!providerState.activeModel
			? 'Select a model first.'
			: activeNodeStreaming
				? 'Waiting for response…'
				: activeExchangeId && !app.chat.canSubmitPrompt(activeTree, activeExchangeId)
					? 'Choose a side-chat tip or main-chain node to continue.'
					: null
	);

	let activeChatId = $derived(activeChat.id);
	$effect(() => {
		void activeChatId;
		tick().then(() => composerRef?.focus());
	});

	async function submitPrompt() {
		const prompt = composerValue.trim();
		if (
			(!prompt && pendingImages.length === 0) ||
			!activeExchanges ||
			submitDisabledReason ||
			!providerState.activeModel
		)
			return;

		operationError = null;

		const tree = { rootId: activeChat.rootId, exchanges: activeExchanges };

		let result;
		try {
			result = app.chat.submitPrompt(
				activeChat.id,
				tree,
				activeExchangeId,
				prompt,
				providerState.activeModel,
				{
					liveDocumentContent,
					contextStrategy,
					contextLength: providerState.contextLength,
					images: pendingImages.length > 0 ? pendingImages : undefined,
					agentMode,
					activeDocumentKey,
					toolCallbacks
				}
			);
		} catch (error) {
			operationError = error instanceof Error ? error.message : 'Failed to create exchange.';
			return;
		}

		if (result.hasSideChildren) {
			onExpandSideChat(result.parentId);
		}

		composerValue = '';
		pendingImages = [];
		await tick();
		onScrollToNode(result.id);
	}
</script>

{#if operationError}
	<div class="error-banner">{operationError}</div>
{/if}

<ComposerInput
	bind:this={composerRef}
	bind:composerValue
	bind:pendingImages
	{agentMode}
	inputMessage={null}
	{submitDisabledReason}
	streaming={activeNodeStreaming}
	activeModelLabel={providerState.activeModelLabel}
	activeProvider={providerState.activeModel?.provider ?? null}
	{usedTokens}
	contextLength={providerState.contextLength}
	{contextStrategy}
	onCycleStrategy={() => {
		const next = contextStrategy === 'full' ? 'lru' : contextStrategy === 'lru' ? 'bm25' : 'full';
		app.chat.setContextStrategy(next);
	}}
	onSubmit={submitPrompt}
	onStop={() => {
		if (activeExchangeId) {
			app.chat.stopStream(activeExchangeId);
		}
	}}
	onOpenPalette={() => (paletteOpen = true)}
	onToggleMode={() => onToggleMode?.()}
/>

<ModelPalette
	open={paletteOpen}
	onClose={() => {
		paletteOpen = false;
	}}
	state={providerState}
	onSelectModel={app.providers.selectModel}
	onConnect={app.providers.connect}
	onUnlockCredentials={app.providers.unlockCredentials}
	onSaveCredential={app.providers.saveCredential}
	onLockVault={app.providers.lockAllCredentials}
	onRemoveCredential={app.providers.removeCredential}
	onSetContextSize={app.providers.setContextSize}
	onRemoveCachedModel={app.providers.removeCachedModel}
	onClearCachedModels={app.providers.clearCachedModels}
/>

<style>
</style>
