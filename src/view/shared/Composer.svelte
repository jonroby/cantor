<script lang="ts">
	import { tick } from 'svelte';
	import ComposerInput from './ComposerInput.svelte';
	import { ModelPalette } from '@/view/features/model-palette';
	import * as app from '@/app';

	interface Props {
		onScrollToNode: (nodeId: string | null) => void;
		onExpandSideChat: (exchangeId: string) => void;
		agentMode?: boolean;
		agentStreaming?: boolean;
		agentPending?: boolean;
		liveDocumentContent?: string;
		onAgentResponse?: (text: string) => void;
		onToggleMode?: () => void;
	}

	let {
		onScrollToNode,
		onExpandSideChat,
		agentMode = false,
		agentStreaming = $bindable(false),
		agentPending = false,
		liveDocumentContent,
		onAgentResponse,
		onToggleMode
	}: Props = $props();

	let composerValue = $state('');
	let pendingImages: app.chat.ImageAttachment[] = $state([]);
	let paletteOpen = $state(false);
	let operationError: string | null = $state(null);
	let composerRef: ReturnType<typeof ComposerInput> | undefined = $state();
	let agentHistory: app.chat.Message[] = $state([]);
	let agentAbort: AbortController | null = $state(null);
	let providerState = $derived(app.providers.getState());
	let activeChat = $derived(app.chat.getChat());

	export function focus() {
		composerRef?.focus();
	}

	export function resetAgent() {
		agentHistory = [];
		agentStreaming = false;
		if (agentAbort) {
			agentAbort.abort();
			agentAbort = null;
		}
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
		if (agentMode) {
			await submitAgent();
			return;
		}

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
					images: pendingImages.length > 0 ? pendingImages : undefined
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

	function buildAgentMessages(prompt: string): app.chat.Message[] {
		const documentSection = liveDocumentContent
			? `\n\n<current_document>\n${liveDocumentContent}\n</current_document>`
			: '\n\nThe document is currently empty.';

		const systemPrompt = [
			'You are editing a markdown document. The user will give you instructions about what to change.',
			'You have access to the chat history above for context.',
			'Respond with the COMPLETE updated document content. Do NOT wrap it in code fences or backticks.',
			'Do NOT add any preamble, explanation, or commentary — your entire response becomes the document.',
			documentSection
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
			...agentHistory,
			{ role: 'user', content: prompt }
		];
	}

	async function submitAgent() {
		const prompt = composerValue.trim();
		if (!prompt || !providerState.activeModel) return;

		operationError = null;
		const messages = buildAgentMessages(prompt);
		agentHistory = [...agentHistory, { role: 'user', content: prompt }];
		composerValue = '';
		agentStreaming = true;

		const abort = new AbortController();
		agentAbort = abort;

		let responseText = '';
		try {
			const stream = app.providers.streamText(providerState.activeModel, messages, abort.signal);
			for await (const chunk of stream) {
				if (chunk.type === 'delta') {
					responseText += chunk.delta;
				}
			}
			agentHistory = [...agentHistory, { role: 'assistant', content: responseText }];
			onAgentResponse?.(responseText);
		} catch (e) {
			if (abort.signal.aborted) return;
			operationError = e instanceof Error ? e.message : 'Agent failed.';
		} finally {
			agentStreaming = false;
			agentAbort = null;
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
	inputMessage={agentPending ? 'Accept or reject pending changes first.' : null}
	{submitDisabledReason}
	streaming={agentStreaming || activeNodeStreaming}
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
		if (agentStreaming && agentAbort) {
			agentAbort.abort();
			agentStreaming = false;
			agentAbort = null;
		} else if (activeExchangeId) {
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
	onLockCredential={app.providers.lockCredential}
	onClearCredential={app.providers.clearCredential}
	onSetContextSize={app.providers.setContextSize}
	onRemoveCachedModel={app.providers.removeCachedModel}
	onClearCachedModels={app.providers.clearCachedModels}
/>
