<script lang="ts">
	import { tick } from 'svelte';
	import { toast } from 'svelte-sonner';
	import Button from '@/view/components/custom/button.svelte';
	import ChatMessage from './ChatMessage.svelte';
	import { ChatInput } from '@/view/shared';
	import {
		createMainChatPanel,
		createSideChatPanel,
		createDocumentPanel,
		isSideChat,
		withContent
	} from './panel';
	import type { Panel } from './panel';
	import type { ChatCardData } from './chat-card';
	import Document from '@/view/features/document/Document.svelte';
	import * as app from '@/app';

	// ── Panel state ─────────────────────────────────────────────────────────
	let mainPanel: Panel = $state(createMainChatPanel());
	let sidePanel = $state<Panel | null>(null);
	let focusedPanelId: string = $state(mainPanel.id);

	// ── Derived compatibility shims ─────────────────────────────────────────
	let sidePanelOpen = $derived(sidePanel !== null);
	let sideChatContent = $derived(
		sidePanel !== null && sidePanel.content.type === 'side-chat' ? sidePanel.content : null
	);
	let sidePanelParentId = $derived(sideChatContent ? sideChatContent.parentExchangeId : null);
	let sideChatIndex = $derived(sideChatContent ? sideChatContent.sideChatIndex : 0);
	let focusedPane = $derived<'main' | 'side'>(
		sidePanel !== null && focusedPanelId === sidePanel.id ? 'side' : 'main'
	);

	let trackLatestSideChat = $state(false);
	let deleteTargetId: string | null = $state(null);
	let deleteMode: app.chat.DeleteMode = $state('exchange');
	let operationError: string | null = $state(null);
	let mainScrollContainer: HTMLDivElement | null = $state(null);
	let sideScrollContainer: HTMLDivElement | null = $state(null);
	let chatInputRef: ReturnType<typeof ChatInput> | undefined = $state();
	let providerState = $derived(app.providers.getState());
	let activeChat = $derived(app.chat.getChat());

	let activeExchanges = $derived(activeChat.exchanges);
	let activeTree = $derived({ rootId: activeChat.rootId, exchanges: activeChat.exchanges });
	let activeExchangeId = $derived(app.chat.getActiveExchangeId());
	let commandStreaming = $state(false);
	let pendingDocumentContent: string | null = $state(null);
	let mainChatPath = $derived(getMainChatPath());
	let mainChatTailId = $derived(
		mainChatPath.length > 0 ? mainChatPath[mainChatPath.length - 1]!.id : null
	);
	let sideChats = $derived(getSideChats());
	let activeSideChat = $derived(
		sideChats.length > 0 && sideChatIndex < sideChats.length ? sideChats[sideChatIndex] : null
	);
	let sideChatTailId = $derived(
		activeSideChat && activeSideChat.length > 0
			? activeSideChat[activeSideChat.length - 1]!.id
			: null
	);
	let sidePanelParentExchange = $derived(
		sidePanelParentId && activeExchanges ? activeExchanges[sidePanelParentId] : null
	);
	let documentContent = $derived(
		sidePanel !== null && sidePanel.content.type === 'document' ? sidePanel.content : null
	);
	let activeDocumentFile = $derived.by(() => {
		if (!documentContent) return null;
		const folder = app.documents.getState().folders.find((f) => f.id === documentContent.folderId);
		const file = folder?.files?.find((f) => f.id === documentContent.fileId);
		return file ?? null;
	});
	let activeDocumentIndex = $derived.by(() => {
		if (!documentContent) return -1;
		return app.documents
			.getState()
			.openDocuments.findIndex(
				(d) =>
					d.documentKey?.folderId === documentContent.folderId &&
					d.documentKey?.fileId === documentContent.fileId
			);
	});
	let isDocumentPanel = $derived(sidePanel !== null && sidePanel.content.type === 'document');

	function getMainChatPath(): app.chat.Exchange[] {
		return app.chat.getMainChat(activeTree);
	}

	function getSideChats(): app.chat.Exchange[][] {
		if (!sidePanelParentId) return [];
		return app.chat.getSideChats(activeTree, sidePanelParentId);
	}

	function updateSideChatIndex(newIndex: number) {
		if (!sidePanel || !isSideChat(sidePanel)) return;
		sidePanel = withContent(sidePanel, { ...sidePanel.content, sideChatIndex: newIndex });
	}

	function focusPanel(panelId: string) {
		if (focusedPanelId === panelId) return;
		focusedPanelId = panelId;
		if (panelId === mainPanel.id) {
			app.chat.selectExchange(mainChatTailId);
		} else if (sidePanel && panelId === sidePanel.id) {
			if (sideChatTailId) {
				app.chat.selectExchange(sideChatTailId);
			} else if (sidePanelParentId) {
				app.chat.selectExchange(sidePanelParentId);
			}
		}
		if (!isDocumentPanel) {
			tick().then(() => chatInputRef?.focus());
		}
	}

	function focusMain() {
		focusPanel(mainPanel.id);
	}

	function focusSide() {
		if (sidePanel) focusPanel(sidePanel.id);
	}

	function openSidePanel(parentId: string) {
		if (sidePanel && isSideChat(sidePanel) && sidePanel.content.parentExchangeId === parentId) {
			closeSidePanel();
			return;
		}

		const sideChats = app.chat.getSideChats(activeTree, parentId);
		const sideChatIdx = sideChats.length > 0 ? sideChats.length - 1 : 0;

		sidePanel = createSideChatPanel(parentId, sideChatIdx);
		focusedPanelId = sidePanel.id;

		if (sideChats.length > 0) {
			const latestSideChat = sideChats[sideChats.length - 1];
			const tail = latestSideChat?.[latestSideChat.length - 1];
			if (tail) app.chat.selectExchange(tail.id);
		} else {
			app.chat.selectExchange(parentId);
		}
		tick().then(() => chatInputRef?.focus());
	}

	function closeSidePanel() {
		sidePanel = null;
		chatInputRef?.resetCommand();
		focusPanel(mainPanel.id);
	}

	function addCurrentDocToChat() {
		if (!documentContent) return;
		app.documents.addDocumentToChat(documentContent.folderId, documentContent.fileId);
	}

	function prevSideChat() {
		if (sideChatIndex > 0) {
			updateSideChatIndex(sideChatIndex - 1);
			focusSide();
		}
	}

	function nextSideChat() {
		if (sideChatIndex < sideChats.length - 1) {
			updateSideChatIndex(sideChatIndex + 1);
			focusSide();
		}
	}

	function newSideChat() {
		if (!sidePanelParentId) return;
		if (!activeSideChat || activeSideChat.length === 0) return;
		updateSideChatIndex(sideChats.length);
		app.chat.selectExchange(sidePanelParentId);
		tick().then(() => chatInputRef?.focus());
	}

	function copyChat(exchangeId: string) {
		app.chat.copyChat(exchangeId);
		toast.success('Copied to new chat');
	}

	function openDeleteDialog(exchangeId: string) {
		deleteTargetId = exchangeId;
		deleteMode = getChildren(exchangeId).length > 1 ? 'exchangeAndSideChats' : 'exchange';
	}

	function confirmDelete() {
		if (!deleteTargetId) return;
		const result = app.chat.deleteExchange(
			activeTree,
			deleteTargetId,
			deleteMode,
			activeExchangeId
		);
		if (result.error) {
			operationError = result.error;
		} else {
			deleteTargetId = null;
			operationError = null;
		}
	}

	function promoteExchange(exchangeId: string) {
		const result = app.chat.promoteExchange(activeTree, exchangeId);
		if (result.error) {
			operationError = result.error;
		} else {
			operationError = null;
			closeSidePanel();
		}
	}

	function toggleSideChildren(exchangeId: string) {
		openSidePanel(exchangeId);
	}

	function quickAsk(exchangeId: string, sourceText: string) {
		if (!activeExchanges || !providerState.activeModel) return;

		const tree = { rootId: activeChat.rootId, exchanges: activeExchanges };

		let result;
		try {
			result = app.chat.quickAsk(
				activeChat.id,
				tree,
				exchangeId,
				sourceText,
				providerState.activeModel
			);
		} catch (error) {
			operationError = error instanceof Error ? error.message : 'Failed to create exchange.';
			return;
		}

		operationError = null;

		if (result.hasSideChildren) {
			expandSideChat(result.parentId);
		}

		tick().then(() => scrollToNode(result.id));
	}

	function getChildren(exchangeId: string): app.chat.Exchange[] {
		const exchange = activeExchanges?.[exchangeId];
		if (!exchange || !activeExchanges) return [];
		return exchange.childIds
			.map((childId) => activeExchanges[childId])
			.filter((child): child is app.chat.Exchange => child !== undefined);
	}

	function isInSideChat(exchangeId: string): boolean {
		if (!activeExchanges) return false;
		let current = activeExchanges[exchangeId];
		while (current) {
			if (current.parentId === null) return false;
			const parent = activeExchanges[current.parentId];
			if (!parent) return false;
			if ((parent.childIds[0] ?? null) !== current.id) return true;
			current = parent;
		}
		return false;
	}

	function canCreateSideChat(exchangeId: string): boolean {
		if (isInSideChat(exchangeId)) return false;
		return getChildren(exchangeId).length > 0;
	}

	function hasSplitDescendant(exchangeId: string): boolean {
		const queue = [exchangeId];
		while (queue.length > 0) {
			const currentId = queue.shift()!;
			const children = getChildren(currentId);
			if (children.length > 1) return true;
			for (const child of children) queue.push(child.id);
		}
		return false;
	}

	function canPromoteSideChat(exchangeId: string): boolean {
		if (!activeExchanges) return false;
		const exchange = activeExchanges[exchangeId];
		if (!exchange || exchange.parentId === null) return false;
		const parent = activeExchanges[exchange.parentId];
		if (!parent) return false;
		const index = parent.childIds.indexOf(exchangeId);
		if (index <= 0) return false;
		const mainChildId = parent.childIds[0];
		if (!mainChildId) return false;
		return !hasSplitDescendant(mainChildId);
	}

	function getNodeDataForExchange(exchangeId: string) {
		if (!activeExchanges) return null;
		const exchange = activeExchanges[exchangeId];
		if (!exchange) return null;
		const sideChats = app.chat.getSideChats(activeTree, exchangeId);
		const sideChildrenCount = sideChats.length;
		const hasSideChildren = sideChildrenCount > 0;
		const isSideRoot = exchange.parentId
			? (activeExchanges[exchange.parentId]?.childIds[0] ?? null) !== exchangeId
			: false;

		const data: ChatCardData = {
			prompt: exchange.prompt.text,
			response: exchange.response?.text ?? '',
			model: exchange.model,
			provider: exchange.provider,
			label: exchange.label,
			isActive: activeExchangeId === exchangeId,
			isStreaming: app.chat.isStreaming(exchangeId),
			hasSideChildren,
			sideChildrenCount,
			isSideRoot,
			canCreateSideChat: canCreateSideChat(exchangeId),
			canPromote: canPromoteSideChat(exchangeId),
			canQuickAsk: app.chat.canSubmitPrompt(activeTree, exchangeId),
			canQuickAdd: false,
			onCopy: () => copyChat(exchangeId),
			onToggleSideChildren: () => toggleSideChildren(exchangeId),
			onPromote: () => promoteExchange(exchangeId),
			onDelete: () => openDeleteDialog(exchangeId),
			onQuickAsk: (sourceText: string) => quickAsk(exchangeId, sourceText),
			onQuickAdd: () => {}
		};

		if (isDocumentPanel && activeDocumentIndex >= 0) {
			data.canQuickAdd = true;
			data.onQuickAdd = (sourceText: string) => {
				const current = activeDocumentFile?.content ?? '';
				const appended = current ? `${current}\n\n${sourceText}` : sourceText;
				app.documents.updateDocumentContent(activeDocumentIndex, appended);
			};
		}

		return data;
	}

	async function scrollToNode(nodeId: string | null) {
		if (!nodeId) return;
		await tick();
		const isSideFocused = sidePanel !== null && focusedPanelId === sidePanel.id;
		const containers = isSideFocused
			? [sideScrollContainer, mainScrollContainer]
			: [mainScrollContainer, sideScrollContainer];
		for (const container of containers) {
			if (!container) continue;
			const el = container.querySelector(`[data-exchange-id="${nodeId}"]`);
			if (el) {
				el.scrollIntoView({ behavior: 'smooth', block: 'start' });
				return;
			}
		}
	}

	function expandSideChat(exchangeId: string) {
		trackLatestSideChat = true;
		if (sidePanel && isSideChat(sidePanel) && sidePanel.content.parentExchangeId === exchangeId) {
			focusedPanelId = sidePanel.id;
			tick().then(() => chatInputRef?.focus());
			return;
		}
		sidePanel = createSideChatPanel(exchangeId, 0);
		focusedPanelId = sidePanel.id;
		tick().then(() => chatInputRef?.focus());
	}

	export function showDocument(folderId: string, fileId: string) {
		sidePanel = createDocumentPanel(folderId, fileId);
		focusedPanelId = sidePanel.id;
	}

	export function resetUIState() {
		if (sidePanel !== null) {
			app.bootstrap.clearOpenDocument();
		}
		closeSidePanel();
	}

	// When side panel closes, snap focus to main
	$effect(() => {
		if (!sidePanelOpen && focusedPane === 'side') {
			focusPanel(mainPanel.id);
		}
	});

	// Close side panel if parent node was deleted
	$effect(() => {
		if (
			sidePanelOpen &&
			sidePanelParentId &&
			activeExchanges &&
			!activeExchanges[sidePanelParentId]
		) {
			closeSidePanel();
		}
	});

	// Follow the latest side chat when a new side chat is created
	$effect(() => {
		if (trackLatestSideChat && sideChats.length > 0) {
			updateSideChatIndex(sideChats.length - 1);
			trackLatestSideChat = false;
		}
	});

	// Clamp side-chat index (allow one past the end for "new side chat" empty state)
	$effect(() => {
		if (sideChatIndex > sideChats.length && sideChats.length > 0) {
			updateSideChatIndex(sideChats.length - 1);
		}
	});

	// Keep activeExchangeId synced with focused pane's tail
	$effect(() => {
		if (sidePanel && focusedPanelId === sidePanel.id && sideChatTailId) {
			app.chat.selectExchange(sideChatTailId);
		}
	});
</script>

{#if operationError}
	<div class="error-banner">{operationError}</div>
{/if}

<div class="chatview-shell">
	<div class="chatview-body" class:chatview-body-split={sidePanelOpen}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="chatview-pane"
			class:chatview-pane-focused={focusedPane === 'main'}
			onclick={focusMain}
		>
			<div class="chatview-main-title">{activeChat.name}</div>
			<div class="chatview-main" bind:this={mainScrollContainer}>
				<div class="chatview-exchanges">
					{#each mainChatPath as exchange (exchange.id)}
						{@const nodeData = getNodeDataForExchange(exchange.id)}
						{#if nodeData}
							<div
								class="chatview-exchange-wrap"
								class:chatview-side-chat-source={sidePanelOpen && sidePanelParentId === exchange.id}
								data-exchange-id={exchange.id}
							>
								<ChatMessage data={nodeData} />
							</div>
						{/if}
					{/each}
					{#if mainChatPath.length === 0}
						<div class="chatview-empty">Start a conversation below.</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="chatview-side"
			class:chatview-side-open={sidePanelOpen}
			class:chatview-pane-focused={focusedPane === 'side'}
			onclick={focusSide}
		>
			{#if sidePanelOpen}
				{#if isDocumentPanel && activeDocumentFile}
					<div class="chatview-doc-wrap">
						<Document
							title={activeDocumentFile.name}
							content={activeDocumentFile.content}
							{commandStreaming}
							commandModel={providerState.activeModel?.modelId}
							commandProvider={providerState.activeModel?.provider}
							pendingContent={pendingDocumentContent}
							onContentChange={(c) => {
								if (activeDocumentIndex >= 0)
									app.documents.updateDocumentContent(activeDocumentIndex, c);
							}}
							onAcceptPending={() => {
								if (pendingDocumentContent !== null && activeDocumentIndex >= 0) {
									app.documents.updateDocumentContent(activeDocumentIndex, pendingDocumentContent);
								}
								pendingDocumentContent = null;
							}}
							onRejectPending={() => {
								pendingDocumentContent = null;
							}}
							onClose={() => {
								pendingDocumentContent = null;
								if (activeDocumentIndex >= 0) {
									app.documents.closeDocument(activeDocumentIndex);
								}
								app.bootstrap.clearOpenDocument();
								closeSidePanel();
							}}
							onAddToChat={addCurrentDocToChat}
						/>
					</div>
				{:else if !isDocumentPanel}
					{#if sideChats.length > 0}
						{@const isNewSideChat = sideChatIndex >= sideChats.length}
						<div class="chatview-side-header">
							<Button
								class="ghost-button"
								variant="ghost"
								size="sm"
								disabled={sideChatIndex <= 0}
								onclick={prevSideChat}
							>
								<svg
									width="14"
									height="14"
									viewBox="0 0 14 14"
									fill="none"
									stroke="currentColor"
									stroke-width="1.5"
								>
									<path d="M8.5 3L4.5 7l4 4" stroke-linecap="round" stroke-linejoin="round" />
								</svg>
							</Button>
							<span class="chatview-side-counter">
								{#if isNewSideChat}
									New
								{:else}
									{sideChatIndex + 1} / {sideChats.length}
								{/if}
							</span>
							<Button
								class="ghost-button"
								variant="ghost"
								size="sm"
								disabled={sideChatIndex >= sideChats.length - 1}
								onclick={nextSideChat}
							>
								<svg
									width="14"
									height="14"
									viewBox="0 0 14 14"
									fill="none"
									stroke="currentColor"
									stroke-width="1.5"
								>
									<path d="M5.5 3l4 4-4 4" stroke-linecap="round" stroke-linejoin="round" />
								</svg>
							</Button>
							<Button
								class="ghost-button"
								variant="ghost"
								size="sm"
								disabled={isNewSideChat}
								onclick={newSideChat}
								ariaLabel="New side chat"
							>
								<svg
									width="14"
									height="14"
									viewBox="0 0 14 14"
									fill="none"
									stroke="currentColor"
									stroke-width="1.5"
								>
									<path d="M7 2v10M2 7h10" stroke-linecap="round" />
								</svg>
							</Button>
							<Button
								class="ghost-button chatview-side-close"
								variant="ghost"
								size="sm"
								onclick={closeSidePanel}
								ariaLabel="Close side panel"
							>
								<svg
									width="14"
									height="14"
									viewBox="0 0 14 14"
									fill="none"
									stroke="currentColor"
									stroke-width="1.5"
								>
									<path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke-linecap="round" />
								</svg>
							</Button>
						</div>
					{:else}
						<div class="chatview-side-header">
							<span class="chatview-side-counter">New side chat</span>
							<Button
								class="ghost-button chatview-side-close"
								variant="ghost"
								size="sm"
								onclick={closeSidePanel}
								ariaLabel="Close side panel"
							>
								<svg
									width="14"
									height="14"
									viewBox="0 0 14 14"
									fill="none"
									stroke="currentColor"
									stroke-width="1.5"
								>
									<path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke-linecap="round" />
								</svg>
							</Button>
						</div>
					{/if}
					{#if sidePanelParentExchange}
						<div class="chatview-side-context">
							<div class="chatview-side-context-label">From this message</div>
							<div class="chatview-side-context-prompt">{sidePanelParentExchange.prompt.text}</div>
							{#if sidePanelParentExchange.response}
								<div class="chatview-side-context-response">
									{sidePanelParentExchange.response.text.slice(0, 150)}{sidePanelParentExchange
										.response.text.length > 150
										? '…'
										: ''}
								</div>
							{/if}
						</div>
					{/if}
					<div class="chatview-side-exchanges" bind:this={sideScrollContainer}>
						{#if activeSideChat}
							{#each activeSideChat as exchange (exchange.id)}
								{@const nodeData = getNodeDataForExchange(exchange.id)}
								{#if nodeData}
									<div class="chatview-exchange-wrap" data-exchange-id={exchange.id}>
										<ChatMessage data={nodeData} />
									</div>
								{/if}
							{/each}
						{:else}
							<div class="chatview-empty">Type a message to start a side chat.</div>
						{/if}
					</div>
				{/if}
			{/if}
		</div>

		<div
			class="chatview-input-anchor"
			class:chatview-input-right={sidePanelOpen && focusedPane === 'side'}
			class:chatview-input-left={sidePanelOpen && focusedPane === 'main'}
		>
			<ChatInput
				bind:this={chatInputRef}
				onScrollToNode={scrollToNode}
				onExpandSideChat={expandSideChat}
				commandMode={isDocumentPanel && focusedPane === 'side'}
				bind:commandStreaming
				commandPending={pendingDocumentContent !== null}
				liveDocumentContent={activeDocumentFile?.content}
				onCommandResponse={(text) => {
					pendingDocumentContent = text;
				}}
			/>
		</div>
	</div>
</div>

{#if deleteTargetId}
	{@const hasSideChats = getChildren(deleteTargetId).length > 1}
	<button
		class="modal-scrim"
		type="button"
		aria-label="Close delete dialog"
		onclick={() => (deleteTargetId = null)}
	></button>
	<div class="modal-panel delete-panel">
		<div class="modal-header">
			<h2>Delete exchange</h2>
			<Button class="ghost-button" variant="ghost" size="sm" onclick={() => (deleteTargetId = null)}
				>Close</Button
			>
		</div>
		<div class="modal-section">
			<p class="field-label">Choose what should be removed with this exchange.</p>
			<label class="delete-option">
				<input type="radio" bind:group={deleteMode} value="exchange" disabled={hasSideChats} />
				<span>Delete this exchange only</span>
			</label>
			<label class="delete-option">
				<input type="radio" bind:group={deleteMode} value="exchangeAndMainChat" />
				<span>Delete this exchange and main chat</span>
			</label>
			{#if hasSideChats}
				<label class="delete-option">
					<input type="radio" bind:group={deleteMode} value="exchangeAndSideChats" />
					<span>Delete this exchange and side chats</span>
				</label>
			{/if}
			<div class="modal-actions">
				<Button
					class="ghost-button"
					variant="ghost"
					size="sm"
					onclick={() => (deleteTargetId = null)}>Cancel</Button
				>
				<Button class="primary-button" variant="destructive" onclick={confirmDelete}
					>Confirm delete</Button
				>
			</div>
		</div>
	</div>
{/if}

<style>
	.chatview-doc-wrap {
		display: flex;
		flex-direction: column;
		flex: 1;
		overflow: hidden;
	}

	.chatview-doc-wrap > :global(.document) {
		width: 100%;
		height: 100%;
		border: none;
		border-radius: 0;
	}

	.chatview-doc-wrap :global(.docs-header) {
		height: 52px;
		padding: 0 12px;
		gap: 8px;
		border-bottom: 1px solid hsl(var(--border));
		background: hsl(var(--card) / 0.97);
		font-size: 13px;
		font-weight: 600;
		color: hsl(var(--muted-foreground));
		letter-spacing: 0.02em;
	}

	.chatview-doc-wrap :global(.panel-body) {
		padding-bottom: 12rem;
	}
</style>
