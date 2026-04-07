<script lang="ts">
	import { tick } from 'svelte';
	import ComposerInput from '@/view/components/composer-input/ComposerInput.svelte';
	import { ModelPalette } from '@/view/components/model-palette';
	import { AgentPalette } from '@/view/components/agent-palette';
	import { ContextPalette } from '@/view/components/context-palette';
	import * as app from '@/app';

	interface Props {
		onScrollToNode: (nodeId: string | null) => void;
		onExpandSideChat: (parentExchangeId: string, targetExchangeId: string) => void;
		agentMode?: boolean;
		liveDocumentContent?: string;
		activeDocumentKey?: { folderId: string; fileId: string } | null;
		onToggleMode?: () => void;
		toolCallbacks?: app.chat.SubmitOptions['toolCallbacks'];
		anchored?: boolean;
	}

	let {
		onScrollToNode,
		onExpandSideChat,
		agentMode = false,
		liveDocumentContent,
		activeDocumentKey = null,
		onToggleMode,
		toolCallbacks,
		anchored = false
	}: Props = $props();

	let composerValue = $state('');
	let pendingImages: app.chat.ImageAttachment[] = $state([]);
	let paletteOpen = $state(false);
	let agentPaletteOpen = $state(false);
	let contextPaletteOpen = $state(false);
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
		activeExchangeId
			? app.chat.getUsedTokens(
					activeTree,
					activeExchangeId,
					contextStrategy,
					providerState.contextLength
				)
			: 0
	);
	let totalTokens = $derived(
		activeExchangeId ? app.chat.getTotalTokens(activeTree, activeExchangeId) : 0
	);
	let activeNodeStreaming = $derived.by(() => {
		const id = activeExchangeId;
		if (!id) return false;
		return app.chat.isStreaming(id);
	});
	let submitDisabledReason = $derived(
		!providerState.activeModel
			? 'Select a model first.'
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
					enabledToolNames: app.chat.getEnabledToolNames(),
					toolCallbacks
				}
			);
		} catch (error) {
			operationError = error instanceof Error ? error.message : 'Failed to create exchange.';
			return;
		}

		if (result.hasSideChildren) {
			onExpandSideChat(result.parentId, result.id);
		}

		composerValue = '';
		pendingImages = [];
		if (!result.hasSideChildren) {
			await tick();
			onScrollToNode(result.id);
		}
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
	{anchored}
	inputMessage={null}
	{submitDisabledReason}
	streaming={activeNodeStreaming}
	activeModelLabel={providerState.activeModelLabel}
	activeProvider={providerState.activeModel?.provider ?? null}
	{usedTokens}
	{totalTokens}
	contextLength={providerState.contextLength}
	{contextStrategy}
	onSubmit={submitPrompt}
	onStop={() => {
		if (activeExchangeId) {
			app.chat.stopStream(activeExchangeId);
		}
	}}
	onOpenPalette={() => (paletteOpen = true)}
	onOpenContextPalette={() => (contextPaletteOpen = true)}
	onToggleMode={() => onToggleMode?.()}
	onOpenAgentPalette={() => (agentPaletteOpen = true)}
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

<AgentPalette
	open={agentPaletteOpen}
	onClose={() => (agentPaletteOpen = false)}
	enabledToolNames={app.chat.getEnabledToolNames()}
	onToggleTool={(name) => {
		const caps = app.agent.getCapabilities();
		const allNames = caps.flatMap((c) => c.tools.map((t) => t.name));
		const current = app.chat.getEnabledToolNames();
		const enabled = current ?? allNames;
		const next = enabled.includes(name) ? enabled.filter((x) => x !== name) : [...enabled, name];
		app.chat.setEnabledToolNames(next.length === allNames.length ? null : next);
	}}
	onToggleCapability={(id) => {
		const caps = app.agent.getCapabilities();
		const allNames = caps.flatMap((c) => c.tools.map((t) => t.name));
		const cap = caps.find((c) => c.id === id);
		if (!cap) return;
		const capNames = cap.tools.map((t) => t.name);
		const current = app.chat.getEnabledToolNames();
		const enabledArr = current ?? allNames;
		const allCapEnabled = capNames.every((n) => enabledArr.includes(n));
		const next = allCapEnabled
			? enabledArr.filter((n) => !capNames.includes(n))
			: [...enabledArr, ...capNames.filter((n) => !enabledArr.includes(n))];
		app.chat.setEnabledToolNames(next.length === allNames.length ? null : next);
	}}
	onToggleAll={() => {
		const caps = app.agent.getCapabilities();
		const allNames = caps.flatMap((c) => c.tools.map((t) => t.name));
		const current = app.chat.getEnabledToolNames();
		const allEnabled = current === null || current.length === allNames.length;
		app.chat.setEnabledToolNames(allEnabled ? [] : null);
	}}
/>

<ContextPalette
	open={contextPaletteOpen}
	onClose={() => (contextPaletteOpen = false)}
	{contextStrategy}
	onSelectStrategy={app.chat.setContextStrategy}
	{usedTokens}
	{totalTokens}
/>
