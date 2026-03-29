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
	let sideBranchIndex = $derived(sideChatContent ? sideChatContent.branchIndex : 0);
	let focusedPane = $derived<'main' | 'side'>(
		sidePanel !== null && focusedPanelId === sidePanel.id ? 'side' : 'main'
	);

	let trackLatestBranch = $state(false);
	let deleteTargetId: string | null = $state(null);
	let deleteMode: app.chat.DeleteMode = $state('exchange');
	let operationError: string | null = $state(null);
	let mainScrollContainer: HTMLDivElement | null = $state(null);
	let sideScrollContainer: HTMLDivElement | null = $state(null);
	let chatInputRef: ReturnType<typeof ChatInput> | undefined = $state();
	let providerState = $derived(app.providers.getState());

	let activeExchanges = $derived(app.chat.getActiveExchanges());
	let activeExchangeId = $derived(app.chat.getActiveExchangeId());
	let commandStreaming = $state(false);
	let pendingDocContent: string | null = $state(null);
	let mainChatPath = $derived(getMainChatPath());
	let mainChatTailId = $derived(
		mainChatPath.length > 0 ? mainChatPath[mainChatPath.length - 1]!.id : null
	);
	let sideBranches = $derived(getSideBranches());
	let activeSideBranch = $derived(
		sideBranches.length > 0 && sideBranchIndex < sideBranches.length
			? sideBranches[sideBranchIndex]
			: null
	);
	let sideBranchTailId = $derived(
		activeSideBranch && activeSideBranch.length > 0
			? activeSideBranch[activeSideBranch.length - 1]!.id
			: null
	);
	let sidePanelParentExchange = $derived(
		sidePanelParentId && activeExchanges ? activeExchanges[sidePanelParentId] : null
	);
	let docContent = $derived(
		sidePanel !== null && sidePanel.content.type === 'document' ? sidePanel.content : null
	);
	let activeDocFile = $derived.by(() => {
		if (!docContent) return null;
		const folder = app.documents.getFolders().find((f) => f.id === docContent.folderId);
		const file = folder?.files?.find((f) => f.id === docContent.fileId);
		return file ?? null;
	});
	let activeDocIndex = $derived.by(() => {
		if (!docContent) return -1;
		return app.documents
			.getOpenDocs()
			.findIndex(
				(d) => d.docKey?.folderId === docContent.folderId && d.docKey?.fileId === docContent.fileId
			);
	});
	let isDocPanel = $derived(sidePanel !== null && sidePanel.content.type === 'document');

	function getMainChatPath(): app.chat.Exchange[] {
		if (!activeExchanges) return [];
		const root = app.chat.getRootExchange({
			rootId: app.chat.getActiveChat().rootId,
			exchanges: activeExchanges
		});
		if (!root) return [];
		const path: app.chat.Exchange[] = [root];
		let currentId: string | null = root.id;
		while (currentId) {
			const children = app.chat.getChildExchanges(activeExchanges, currentId);
			if (children.length === 0) break;
			const mainChild = children[0]!;
			path.push(mainChild);
			currentId = mainChild.id;
		}
		return path;
	}

	function getSideBranches(): app.chat.Exchange[][] {
		if (!activeExchanges || !sidePanelParentId) return [];
		const children = app.chat.getChildExchanges(activeExchanges, sidePanelParentId);
		if (children.length <= 1) return [];

		const branches: app.chat.Exchange[][] = [];
		for (let i = 1; i < children.length; i++) {
			const branch: app.chat.Exchange[] = [];
			let current: app.chat.Exchange | undefined = children[i];
			while (current) {
				branch.push(current);
				const grandChildren = app.chat.getChildExchanges(activeExchanges, current.id);
				current = grandChildren[0];
			}
			branches.push(branch);
		}
		return branches;
	}

	function updateSideBranchIndex(newIndex: number) {
		if (!sidePanel || !isSideChat(sidePanel)) return;
		sidePanel = withContent(sidePanel, { ...sidePanel.content, branchIndex: newIndex });
	}

	function focusPanel(panelId: string) {
		if (focusedPanelId === panelId) return;
		focusedPanelId = panelId;
		if (panelId === mainPanel.id) {
			app.chat.setActiveExchangeId(mainChatTailId);
		} else if (sidePanel && panelId === sidePanel.id) {
			if (sideBranchTailId) {
				app.chat.setActiveExchangeId(sideBranchTailId);
			} else if (sidePanelParentId) {
				app.chat.setActiveExchangeId(sidePanelParentId);
			}
		}
		if (!isDocPanel) {
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

		const children = activeExchanges ? app.chat.getChildExchanges(activeExchanges, parentId) : [];
		const branchIdx = children.length > 1 ? children.length - 2 : 0;

		sidePanel = createSideChatPanel(parentId, branchIdx);
		focusedPanelId = sidePanel.id;

		if (children.length > 1) {
			let current = children[children.length - 1];
			while (current) {
				const grandChildren = activeExchanges
					? app.chat.getChildExchanges(activeExchanges, current.id)
					: [];
				if (grandChildren.length === 0) break;
				current = grandChildren[0];
			}
			if (current) app.chat.setActiveExchangeId(current.id);
		} else {
			app.chat.setActiveExchangeId(parentId);
		}
		tick().then(() => chatInputRef?.focus());
	}

	function closeSidePanel() {
		sidePanel = null;
		chatInputRef?.resetCommand();
		focusPanel(mainPanel.id);
	}

	function addCurrentDocToChat() {
		if (!docContent) return;
		app.documents.performAddFolderDocumentToChat(docContent.folderId, docContent.fileId);
	}

	function prevBranch() {
		if (sideBranchIndex > 0) {
			updateSideBranchIndex(sideBranchIndex - 1);
			focusSide();
		}
	}

	function nextBranch() {
		if (sideBranchIndex < sideBranches.length - 1) {
			updateSideBranchIndex(sideBranchIndex + 1);
			focusSide();
		}
	}

	function newSideBranch() {
		if (!sidePanelParentId) return;
		if (!activeSideBranch || activeSideBranch.length === 0) return;
		updateSideBranchIndex(sideBranches.length);
		app.chat.setActiveExchangeId(sidePanelParentId);
		tick().then(() => chatInputRef?.focus());
	}

	function copyChat(exchangeId: string) {
		app.chat.performCopy(exchangeId);
		toast.success('Copied to new chat');
	}

	function openDeleteDialog(exchangeId: string) {
		if (!activeExchanges) return;
		deleteTargetId = exchangeId;
		deleteMode = app.chat.getDeleteMode(activeExchanges, exchangeId);
	}

	function confirmDelete() {
		if (!activeExchanges || !deleteTargetId) return;
		const result = app.chat.performDelete(
			activeExchanges,
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
		if (!activeExchanges) return;
		const result = app.chat.performPromote(activeExchanges, exchangeId);
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

		const activeChat = app.chat.getActiveChat();
		const tree = { rootId: activeChat.rootId, exchanges: activeExchanges };

		let result;
		try {
			result = app.chat.performQuickAsk(
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

	function getNodeDataForExchange(exchangeId: string) {
		if (!activeExchanges) return null;
		return app.chat.getExchangeNodeData(exchangeId, activeExchanges, activeExchangeId, {
			onSelect: (id) => app.chat.setActiveExchangeId(id),
			onCopy: copyChat,
			onToggleSideChildren: toggleSideChildren,
			onPromote: promoteExchange,
			onDelete: openDeleteDialog,
			onQuickAsk: quickAsk,
			onQuickAdd:
				isDocPanel && activeDocIndex >= 0
					? (sourceText) => {
							const current = activeDocFile?.content ?? '';
							const appended = current ? `${current}\n\n${sourceText}` : sourceText;
							app.documents.updateDocContent(activeDocIndex, appended);
						}
					: undefined
		});
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
		trackLatestBranch = true;
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
			app.documents.clearDocumentLayout();
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

	// Follow the latest branch when a new side chat is created
	$effect(() => {
		if (trackLatestBranch && sideBranches.length > 0) {
			updateSideBranchIndex(sideBranches.length - 1);
			trackLatestBranch = false;
		}
	});

	// Clamp branch index (allow one past the end for "new branch" empty state)
	$effect(() => {
		if (sideBranchIndex > sideBranches.length && sideBranches.length > 0) {
			updateSideBranchIndex(sideBranches.length - 1);
		}
	});

	// Keep activeExchangeId synced with focused pane's tail
	$effect(() => {
		if (sidePanel && focusedPanelId === sidePanel.id && sideBranchTailId) {
			app.chat.setActiveExchangeId(sideBranchTailId);
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
			<div class="chatview-main-title">{app.chat.getActiveChat().name}</div>
			<div class="chatview-main" bind:this={mainScrollContainer}>
				<div class="chatview-exchanges">
					{#each mainChatPath as exchange (exchange.id)}
						{@const nodeData = getNodeDataForExchange(exchange.id)}
						{#if nodeData}
							<div
								class="chatview-exchange-wrap"
								class:chatview-branch-source={sidePanelOpen && sidePanelParentId === exchange.id}
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
				{#if isDocPanel && activeDocFile}
					<div class="chatview-doc-wrap">
						<Document
							title={activeDocFile.name}
							content={activeDocFile.content}
							{commandStreaming}
							commandModel={providerState.activeModel?.modelId}
							commandProvider={providerState.activeModel?.provider}
							pendingContent={pendingDocContent}
							onContentChange={(c) => {
								if (activeDocIndex >= 0) app.documents.updateDocContent(activeDocIndex, c);
							}}
							onAcceptPending={() => {
								if (pendingDocContent !== null && activeDocIndex >= 0) {
									app.documents.updateDocContent(activeDocIndex, pendingDocContent);
								}
								pendingDocContent = null;
							}}
							onRejectPending={() => {
								pendingDocContent = null;
							}}
							onClose={() => {
								pendingDocContent = null;
								app.documents.performCloseDocumentPanel(activeDocIndex);
								closeSidePanel();
							}}
							onAddToChat={addCurrentDocToChat}
						/>
					</div>
				{:else if !isDocPanel}
					{#if sideBranches.length > 0}
						{@const isNewBranch = sideBranchIndex >= sideBranches.length}
						<div class="chatview-side-header">
							<Button
								class="ghost-button"
								variant="ghost"
								size="sm"
								disabled={sideBranchIndex <= 0}
								onclick={prevBranch}
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
								{#if isNewBranch}
									New
								{:else}
									{sideBranchIndex + 1} / {sideBranches.length}
								{/if}
							</span>
							<Button
								class="ghost-button"
								variant="ghost"
								size="sm"
								disabled={sideBranchIndex >= sideBranches.length - 1}
								onclick={nextBranch}
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
								disabled={isNewBranch}
								onclick={newSideBranch}
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
							<div class="chatview-side-context-label">Branching from</div>
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
						{#if activeSideBranch}
							{#each activeSideBranch as exchange (exchange.id)}
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
				commandMode={isDocPanel && focusedPane === 'side'}
				bind:commandStreaming
				commandPending={pendingDocContent !== null}
				liveDocContent={activeDocFile?.content}
				onCommandResponse={(text) => {
					pendingDocContent = text;
				}}
			/>
		</div>
	</div>
</div>

{#if deleteTargetId}
	{@const children = activeExchanges
		? app.chat.getChildExchanges(activeExchanges, deleteTargetId)
		: []}
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
				<input
					type="radio"
					bind:group={deleteMode}
					value="exchange"
					disabled={children.length > 1}
				/>
				<span>Delete this exchange only</span>
			</label>
			<label class="delete-option">
				<input type="radio" bind:group={deleteMode} value="exchangeAndMainChat" />
				<span>Delete this exchange and main chat</span>
			</label>
			{#if children.length > 1}
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
