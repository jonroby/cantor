<script lang="ts">
	import { tick } from 'svelte';
	import { Composer } from '@/features/composer';
	import { ModelPalette } from '@/features/model-palette';
	import {
		ROOT_ANCHOR_ID,
		addExchangeResult,
		buildExchangesByParentId,
		canAcceptNewChat,
		getChildExchanges,
		getMainChatTail,
		getPathTokenTotal
	} from '@/domain/tree';
	import {
		getActiveExchanges,
		getActiveExchangeId,
		replaceActiveExchanges,
		setActiveExchangeId
	} from '@/state/chats.svelte';
	import {
		providerState,
		WEBLLM_CONTEXT_OPTIONS,
		connectOllama,
		loadWebLLMModel_ as loadWebLLMModel,
		deleteWebLLMCache,
		deleteAllWebLLMCaches,
		unlockKeys,
		saveKey,
		forgetKey,
		selectModel,
		updateContextLength,
		fetchOllamaContextLength
	} from '@/state/providers.svelte';
	import { startStream, isAnyStreaming } from '@/services/streams';

	interface Props {
		onScrollToNode: (nodeId: string | null) => void;
		onExpandSideChat: (exchangeId: string) => void;
	}

	let { onScrollToNode, onExpandSideChat }: Props = $props();

	let composerValue = $state('');
	let canvasMode = $state(false);
	let paletteOpen = $state(false);
	let operationError: string | null = $state(null);

	let activeExchanges = $derived(getActiveExchanges());
	let activeExchangeId = $derived(getActiveExchangeId());
	let exchangesByParentId = $derived(
		activeExchanges ? buildExchangesByParentId(activeExchanges) : {}
	);
	let usedTokens = $derived(
		activeExchanges && activeExchangeId ? getPathTokenTotal(activeExchanges, activeExchangeId) : 0
	);
	let submitDisabledReason = $derived(
		isAnyStreaming()
			? 'Wait for the current response to finish.'
			: !providerState.activeModel
				? 'Select a model first.'
				: activeExchangeId &&
					  activeExchanges &&
					  !canAcceptNewChat(activeExchanges, activeExchangeId, exchangesByParentId)
					? 'Choose a branch tip or main-chain node to continue.'
					: null
	);

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

		const parentId = activeExchangeId ?? getMainChatTail(activeExchanges) ?? ROOT_ANCHOR_ID;
		if (
			activeExchangeId &&
			getChildExchanges(activeExchanges, activeExchangeId, exchangesByParentId).length > 0
		) {
			onExpandSideChat(activeExchangeId);
		}

		let created;
		try {
			created = addExchangeResult(
				activeExchanges,
				parentId,
				prompt,
				'',
				providerState.activeModel.modelId
			);
		} catch (error) {
			operationError = error instanceof Error ? error.message : 'Failed to create exchange.';
			return;
		}

		replaceActiveExchanges(created.exchanges);
		setActiveExchangeId(created.id);
		composerValue = '';
		await tick();
		onScrollToNode(created.id);

		startStream({
			exchangeId: created.id,
			model: providerState.activeModel,
			exchanges: created.exchanges
		});
	}
</script>

{#if operationError}
	<div class="error-banner">{operationError}</div>
{/if}

<Composer
	bind:composerValue
	bind:canvasMode
	{submitDisabledReason}
	activeModelId={providerState.activeModel?.modelId ?? null}
	{usedTokens}
	contextLength={providerState.contextLength}
	onSubmit={submitPrompt}
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
