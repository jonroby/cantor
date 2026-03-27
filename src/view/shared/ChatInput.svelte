<script lang="ts">
	import { tick } from 'svelte';
	import Composer from './Composer.svelte';
	import { ModelPalette } from '@/view/features/model-palette';
	import {
		addExchangeResult,
		canAcceptNewChat,
		getChildExchanges,
		getMainChatTail,
		getPathTokenTotal
	} from '@/domain/tree';
	import {
		getActiveChat,
		getActiveExchanges,
		getActiveExchangeId,
		replaceActiveTree,
		setActiveExchangeId
	} from '@/state/chats.svelte';
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
	import { startStream, isStreaming, cancelStream } from '@/state/services/streams';

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
		const chatId = activeChat.id;
		const tree = { rootId: activeChat.rootId, exchanges: activeExchanges };
		const parentId = activeExchangeId ?? getMainChatTail(tree) ?? '';
		if (activeExchangeId && getChildExchanges(activeExchanges, activeExchangeId).length > 0) {
			onExpandSideChat(activeExchangeId);
		}

		let created;
		try {
			created = addExchangeResult(
				tree,
				parentId,
				prompt,
				providerState.activeModel.modelId,
				providerState.activeModel.provider
			);
		} catch (error) {
			operationError = error instanceof Error ? error.message : 'Failed to create exchange.';
			return;
		}

		replaceActiveTree(created);
		setActiveExchangeId(created.id);
		composerValue = '';
		await tick();
		onScrollToNode(created.id);

		startStream({
			exchangeId: created.id,
			chatId,
			model: providerState.activeModel,
			tree: created
		});
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
