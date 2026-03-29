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
	let paletteOpen = $state(false);
	let operationError: string | null = $state(null);
	let composerRef: ReturnType<typeof Composer> | undefined = $state();
	let commandHistory: app.chat.Message[] = $state([]);
	let commandAbort: AbortController | null = $state(null);
	let providerState = $derived(app.providers.getState());
	let activeChat = $derived(app.chat.getChat());

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

	let activeExchanges = $derived(activeChat.exchanges);
	let activeTree = $derived({ rootId: activeChat.rootId, exchanges: activeChat.exchanges });
	let activeExchangeId = $derived(app.chat.getActiveExchangeId());
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
		if (commandMode) {
			await submitCommand();
			return;
		}

		const prompt = composerValue.trim();
		if (!prompt || !activeExchanges || submitDisabledReason || !providerState.activeModel) return;

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

		const chatHistory = app.chat
			.getMainChat(activeTree)
			.flatMap((exchange) => [
				{ role: 'user', content: exchange.prompt.text } as app.chat.Message,
				...(exchange.response?.text
					? ([{ role: 'assistant', content: exchange.response.text }] as app.chat.Message[])
					: [])
			]);

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
		if (!prompt || !providerState.activeModel) return;

		operationError = null;
		const messages = buildCommandMessages(prompt);
		commandHistory = [...commandHistory, { role: 'user', content: prompt }];
		composerValue = '';
		commandStreaming = true;

		const abort = new AbortController();
		commandAbort = abort;

		let responseText = '';
		try {
			const stream = app.providers.streamText(providerState.activeModel, messages, abort.signal);
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
	{commandMode}
	inputMessage={commandPending ? 'Accept or reject pending changes first.' : null}
	{submitDisabledReason}
	streaming={commandStreaming || activeNodeStreaming}
	activeModelId={providerState.activeModel?.modelId ?? null}
	{usedTokens}
	contextLength={providerState.contextLength}
	onSubmit={submitPrompt}
	onStop={() => {
		if (commandStreaming && commandAbort) {
			commandAbort.abort();
			commandStreaming = false;
			commandAbort = null;
		} else if (activeExchangeId) {
			app.chat.stopStream(activeExchangeId);
		}
	}}
	onOpenPalette={() => (paletteOpen = true)}
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
	onClearCredential={app.providers.clearCredential}
	onSetContextSize={app.providers.setContextSize}
	onRemoveCachedModel={app.providers.removeCachedModel}
	onClearCachedModels={app.providers.clearCachedModels}
/>
