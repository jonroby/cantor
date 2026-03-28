<script lang="ts">
	import { tick } from 'svelte';
	import Composer from './Composer.svelte';
	import { ModelPalette } from '@/view/features/model-palette';
	import { canAcceptNewChat, getPathTokenTotal } from '@/domain/tree';
	import { getActiveChat, getActiveExchanges, getActiveExchangeId } from '@/state/chats.svelte';
	import {
		providerState,
		WEBLLM_CONTEXT_OPTIONS,
		selectModel,
		updateContextLength
	} from '@/state/providers.svelte';
	import {
		connectOllama,
		loadWebLLMModel_ as loadWebLLMModel,
		deleteWebLLMCache,
		deleteAllWebLLMCaches,
		unlockKeys,
		saveKey,
		forgetKey,
		fetchOllamaContextLength
	} from '@/app/providers';
	import { performSubmitPrompt } from '@/app/chat-actions';
	import { isStreaming, cancelStream } from '@/state/services/streams';

	interface Props {
		onScrollToNode: (nodeId: string | null) => void;
		onExpandSideChat: (exchangeId: string) => void;
	}

	let { onScrollToNode, onExpandSideChat }: Props = $props();

	let composerValue = $state('');
	let canvasMode = $state(false);
	let paletteOpen = $state(false);
	let operationError: string | null = $state(null);
	let composerRef: ReturnType<typeof Composer> | undefined = $state();

	export function focus() {
		composerRef?.focus();
	}

	let activeExchanges = $derived(getActiveExchanges());
	let activeExchangeId = $derived(getActiveExchangeId());
	let usedTokens = $derived(
		activeExchanges && activeExchangeId ? getPathTokenTotal(activeExchanges, activeExchangeId) : 0
	);
	let activeNodeStreaming = $derived.by(() => {
		const id = activeExchangeId;
		if (!id) return false;
		return isStreaming(id);
	});
	let submitDisabledReason = $derived(
		!providerState.activeModel
			? 'Select a model first.'
			: activeExchangeId && activeExchanges && !canAcceptNewChat(activeExchanges, activeExchangeId)
				? 'Choose a branch tip or main-chain node to continue.'
				: null
	);

	$effect(() => {
		void getActiveChat().id;
		tick().then(() => composerRef?.focus());
	});

	$effect(() => {
		updateContextLength();
	});

	$effect(() => {
		fetchOllamaContextLength();
	});

	async function submitPrompt() {
		const prompt = composerValue.trim();
		if (!prompt || !activeExchanges || submitDisabledReason || !providerState.activeModel) return;

		operationError = null;

		const activeChat = getActiveChat();
		const tree = { rootId: activeChat.rootId, exchanges: activeExchanges };

		let result;
		try {
			result = performSubmitPrompt(
				activeChat.id,
				tree,
				activeExchangeId,
				prompt,
				providerState.activeModel
			);
		} catch (error) {
			operationError = error instanceof Error ? error.message : 'Failed to create exchange.';
			return;
		}

		if (result.hasSideChildren && activeExchangeId) {
			onExpandSideChat(activeExchangeId);
		}

		composerValue = '';
		await tick();
		onScrollToNode(result.id);
	}
</script>

{#if operationError}
	<div class="error-banner">{operationError}</div>
{/if}

<Composer
	bind:this={composerRef}
	bind:composerValue
	bind:canvasMode
	{submitDisabledReason}
	streaming={activeNodeStreaming}
	activeModelId={providerState.activeModel?.modelId ?? null}
	{usedTokens}
	contextLength={providerState.contextLength}
	onSubmit={submitPrompt}
	onStop={() => {
		if (activeExchangeId) cancelStream(activeExchangeId);
	}}
	onToggleCanvasMode={() => (canvasMode = !canvasMode)}
	onOpenPalette={() => (paletteOpen = true)}
/>

<ModelPalette
	open={paletteOpen}
	onClose={() => {
		paletteOpen = false;
	}}
	activeModel={providerState.activeModel}
	onSelectModel={selectModel}
	ollamaUrl={providerState.ollamaUrl}
	ollamaStatus={providerState.ollamaStatus}
	ollamaModels={providerState.ollamaModels}
	onConnectOllama={connectOllama}
	apiKeys={providerState.apiKeys}
	vaultProviders={providerState.vaultProviders}
	onUnlockKeys={unlockKeys}
	onSaveKey={saveKey}
	onForgetKey={forgetKey}
	webllmStatus={providerState.webllmStatus}
	webllmProgress={providerState.webllmProgress}
	webllmProgressText={providerState.webllmProgressText}
	webllmModels={providerState.webllmModels}
	webllmError={providerState.webllmError}
	webllmContextSize={providerState.webllmContextSize}
	webllmContextOptions={WEBLLM_CONTEXT_OPTIONS}
	onWebLLMContextSizeChange={(size) => {
		providerState.webllmContextSize = size;
	}}
	onLoadWebLLMModel={loadWebLLMModel}
	onDeleteWebLLMCache={deleteWebLLMCache}
	onDeleteAllWebLLMCaches={deleteAllWebLLMCaches}
/>
