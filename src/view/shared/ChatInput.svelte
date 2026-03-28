<script lang="ts">
	import { tick } from 'svelte';
	import Composer from './Composer.svelte';
	import { ModelPalette } from '@/view/features/model-palette';
	import {
		canAcceptNewChat,
		getMainChatHistory,
		getPathTokenTotal,
		type Message
	} from '@/domain/tree';
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
	import { getProviderStream } from '@/state/services/providers/stream';

	interface Props {
		onScrollToNode: (nodeId: string | null) => void;
		onExpandSideChat: (exchangeId: string) => void;
		instructMode?: boolean;
		instructDocContent?: string;
		instructStreaming?: boolean;
		onInstructResponse?: (text: string) => void;
	}

	let {
		onScrollToNode,
		onExpandSideChat,
		instructMode = false,
		instructDocContent = '',
		instructStreaming = $bindable(false),
		onInstructResponse
	}: Props = $props();

	let composerValue = $state('');
	let canvasMode = $state(false);
	let paletteOpen = $state(false);
	let operationError: string | null = $state(null);
	let composerRef: ReturnType<typeof Composer> | undefined = $state();
	let instructHistory: Message[] = $state([]);
	let instructAbort: AbortController | null = $state(null);

	export function focus() {
		composerRef?.focus();
	}

	export function resetInstruct() {
		instructHistory = [];
		instructStreaming = false;
		if (instructAbort) {
			instructAbort.abort();
			instructAbort = null;
		}
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

	let activeChatId = $derived(getActiveChat().id);
	$effect(() => {
		void activeChatId;
		tick().then(() => composerRef?.focus());
	});

	$effect(() => {
		updateContextLength();
	});

	$effect(() => {
		fetchOllamaContextLength();
	});

	async function submitPrompt() {
		if (instructMode) {
			await submitInstruct();
			return;
		}

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

		if (result.hasSideChildren) {
			onExpandSideChat(result.parentId);
		}

		composerValue = '';
		await tick();
		onScrollToNode(result.id);
	}

	function buildInstructMessages(prompt: string): Message[] {
		const docSection = instructDocContent
			? `\n\n<current_document>\n${instructDocContent}\n</current_document>`
			: '\n\nThe document is currently empty.';

		const systemPrompt = [
			'You are editing a markdown document. The user will give you instructions about what to change.',
			'You have access to the chat history above for context.',
			'Respond with the COMPLETE updated document content. Do NOT wrap it in code fences or backticks.',
			'Do NOT add any preamble, explanation, or commentary — your entire response becomes the document.',
			docSection
		].join('\n');

		const activeChat = getActiveChat();
		const chatHistory = activeExchanges
			? getMainChatHistory({ rootId: activeChat.rootId, exchanges: activeExchanges })
			: [];

		return [
			...chatHistory,
			{ role: 'user', content: systemPrompt },
			{ role: 'assistant', content: 'Understood.' },
			...instructHistory,
			{ role: 'user', content: prompt }
		];
	}

	async function submitInstruct() {
		const prompt = composerValue.trim();
		if (!prompt || !providerState.activeModel) return;

		operationError = null;
		const messages = buildInstructMessages(prompt);
		instructHistory = [...instructHistory, { role: 'user', content: prompt }];
		composerValue = '';
		instructStreaming = true;

		const abort = new AbortController();
		instructAbort = abort;

		let responseText = '';
		try {
			const stream = getProviderStream(providerState.activeModel, messages, abort.signal);
			for await (const chunk of stream) {
				if (chunk.type === 'delta') {
					responseText += chunk.delta;
				}
			}
			instructHistory = [...instructHistory, { role: 'assistant', content: responseText }];
			onInstructResponse?.(responseText);
		} catch (e) {
			if (abort.signal.aborted) return;
			operationError = e instanceof Error ? e.message : 'Instruct request failed.';
		} finally {
			instructStreaming = false;
			instructAbort = null;
		}
	}
</script>

{#if operationError}
	<div class="error-banner">{operationError}</div>
{/if}

<Composer
	bind:this={composerRef}
	bind:composerValue
	bind:canvasMode
	{instructMode}
	{submitDisabledReason}
	streaming={instructStreaming || activeNodeStreaming}
	activeModelId={providerState.activeModel?.modelId ?? null}
	{usedTokens}
	contextLength={providerState.contextLength}
	onSubmit={submitPrompt}
	onStop={() => {
		if (instructStreaming && instructAbort) {
			instructAbort.abort();
			instructStreaming = false;
			instructAbort = null;
		} else if (activeExchangeId) {
			cancelStream(activeExchangeId);
		}
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
