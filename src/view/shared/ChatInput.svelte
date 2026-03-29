<script lang="ts">
	import { tick } from 'svelte';
	import Composer from './Composer.svelte';
	import { ModelPalette } from '@/view/features/model-palette';
	import * as app from '@/app';

	interface Props {
		onScrollToNode: (nodeId: string | null) => void;
		onExpandSideChat: (exchangeId: string) => void;
		commandMode?: boolean;
		commandStreaming?: boolean;
		commandPending?: boolean;
		liveDocContent?: string;
		onCommandResponse?: (text: string) => void;
	}

	let {
		onScrollToNode,
		onExpandSideChat,
		commandMode = false,
		commandStreaming = $bindable(false),
		commandPending = false,
		liveDocContent,
		onCommandResponse
	}: Props = $props();

	let composerValue = $state('');
	let canvasMode = $state(false);
	let paletteOpen = $state(false);
	let operationError: string | null = $state(null);
	let composerRef: ReturnType<typeof Composer> | undefined = $state();
	let commandHistory: app.chat.Message[] = $state([]);
	let commandAbort: AbortController | null = $state(null);

	export function focus() {
		composerRef?.focus();
	}

	export function resetCommand() {
		commandHistory = [];
		commandStreaming = false;
		if (commandAbort) {
			commandAbort.abort();
			commandAbort = null;
		}
	}

	let activeExchanges = $derived(app.runtime.getActiveExchanges());
	let activeExchangeId = $derived(app.runtime.getActiveExchangeId());
	let usedTokens = $derived(
		activeExchanges && activeExchangeId
			? app.chat.getPathTokenTotal(activeExchanges, activeExchangeId)
			: 0
	);
	let activeNodeStreaming = $derived.by(() => {
		const id = activeExchangeId;
		if (!id) return false;
		return app.runtime.isStreaming(id);
	});
	let submitDisabledReason = $derived(
		!app.runtime.providerState.activeModel
			? 'Select a model first.'
			: activeExchangeId &&
				  activeExchanges &&
				  !app.chat.canAcceptNewChat(activeExchanges, activeExchangeId)
				? 'Choose a branch tip or main-chain node to continue.'
				: null
	);

	let activeChatId = $derived(app.runtime.getActiveChat().id);
	$effect(() => {
		void activeChatId;
		tick().then(() => composerRef?.focus());
	});

	$effect(() => {
		app.runtime.updateContextLength();
	});

	$effect(() => {
		app.providers.fetchOllamaContextLength();
	});

	async function submitPrompt() {
		if (commandMode) {
			await submitCommand();
			return;
		}

		const prompt = composerValue.trim();
		if (
			!prompt ||
			!activeExchanges ||
			submitDisabledReason ||
			!app.runtime.providerState.activeModel
		)
			return;

		operationError = null;

		const activeChat = app.runtime.getActiveChat();
		const tree = { rootId: activeChat.rootId, exchanges: activeExchanges };

		let result;
		try {
			result = app.chat.submitPrompt(
				activeChat.id,
				tree,
				activeExchangeId,
				prompt,
				app.runtime.providerState.activeModel,
				liveDocContent
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

	function buildCommandMessages(prompt: string): app.chat.Message[] {
		const docSection = liveDocContent
			? `\n\n<current_document>\n${liveDocContent}\n</current_document>`
			: '\n\nThe document is currently empty.';

		const systemPrompt = [
			'You are editing a markdown document. The user will give you instructions about what to change.',
			'You have access to the chat history above for context.',
			'Respond with the COMPLETE updated document content. Do NOT wrap it in code fences or backticks.',
			'Do NOT add any preamble, explanation, or commentary — your entire response becomes the document.',
			docSection
		].join('\n');

		const activeChat = app.runtime.getActiveChat();
		const chatHistory = activeExchanges
			? app.chat.getMainChatHistory({ rootId: activeChat.rootId, exchanges: activeExchanges })
			: [];

		return [
			...chatHistory,
			{ role: 'user', content: systemPrompt },
			{ role: 'assistant', content: 'Understood.' },
			...commandHistory,
			{ role: 'user', content: prompt }
		];
	}

	async function submitCommand() {
		const prompt = composerValue.trim();
		if (!prompt || !app.runtime.providerState.activeModel) return;

		operationError = null;
		const messages = buildCommandMessages(prompt);
		commandHistory = [...commandHistory, { role: 'user', content: prompt }];
		composerValue = '';
		commandStreaming = true;

		const abort = new AbortController();
		commandAbort = abort;

		let responseText = '';
		try {
			const stream = app.runtime.getProviderStream(
				app.runtime.providerState.activeModel,
				messages,
				abort.signal
			);
			for await (const chunk of stream) {
				if (chunk.type === 'delta') {
					responseText += chunk.delta;
				}
			}
			commandHistory = [...commandHistory, { role: 'assistant', content: responseText }];
			onCommandResponse?.(responseText);
		} catch (e) {
			if (abort.signal.aborted) return;
			operationError = e instanceof Error ? e.message : 'Command failed.';
		} finally {
			commandStreaming = false;
			commandAbort = null;
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
	{commandMode}
	inputMessage={commandPending ? 'Accept or reject pending changes first.' : null}
	{submitDisabledReason}
	streaming={commandStreaming || activeNodeStreaming}
	activeModelId={app.runtime.providerState.activeModel?.modelId ?? null}
	{usedTokens}
	contextLength={app.runtime.providerState.contextLength}
	onSubmit={submitPrompt}
	onStop={() => {
		if (commandStreaming && commandAbort) {
			commandAbort.abort();
			commandStreaming = false;
			commandAbort = null;
		} else if (activeExchangeId) {
			app.runtime.cancelStream(activeExchangeId);
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
	activeModel={app.runtime.providerState.activeModel}
	onSelectModel={app.runtime.selectModel}
	ollamaUrl={app.runtime.providerState.ollamaUrl}
	ollamaStatus={app.runtime.providerState.ollamaStatus}
	ollamaModels={app.runtime.providerState.ollamaModels}
	onConnectOllama={app.providers.connectOllama}
	apiKeys={app.runtime.providerState.apiKeys}
	vaultProviders={app.runtime.providerState.vaultProviders}
	onUnlockKeys={app.providers.unlockKeys}
	onSaveKey={app.providers.saveKey}
	onForgetKey={app.providers.forgetKey}
	webllmStatus={app.runtime.providerState.webllmStatus}
	webllmProgress={app.runtime.providerState.webllmProgress}
	webllmProgressText={app.runtime.providerState.webllmProgressText}
	webllmModels={app.runtime.providerState.webllmModels}
	webllmError={app.runtime.providerState.webllmError}
	webllmContextSize={app.runtime.providerState.webllmContextSize}
	webllmContextOptions={app.providers.WEBLLM_CONTEXT_OPTIONS}
	onWebLLMContextSizeChange={(size) => {
		app.runtime.providerState.webllmContextSize = size;
	}}
	onLoadWebLLMModel={app.providers.loadWebLLMModel_}
	onDeleteWebLLMCache={app.providers.deleteWebLLMCache}
	onDeleteAllWebLLMCaches={app.providers.deleteAllWebLLMCaches}
/>
