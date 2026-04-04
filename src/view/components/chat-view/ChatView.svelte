<script lang="ts">
	import { tick } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { MessageSquare, X } from 'lucide-svelte';
	import { Header } from '@/view/primitives';
	import {
		createMainChatPanel,
		createSideChatPanel,
		createDocumentPanel,
		isSideChat,
		withContent
	} from '@/view/components/panel';
	import type { Panel } from '@/view/components/panel';
	import type { ChatCardData } from '@/view/components/chat-card';
	import { Document } from '@/view/components/document';
	import DeleteExchangeDialog from './DeleteExchangeDialog.svelte';
	import SidePanelHeader from './SidePanelHeader.svelte';
	import SidePanelContext from './SidePanelContext.svelte';
	import ExchangeList from './ExchangeList.svelte';
	import * as app from '@/app';

	interface Props {
		onClose?: () => void;
		onFocusComposer?: () => void;
		onSidePanelChange?: (open: boolean) => void;
		onScrollAwayChange?: (away: boolean) => void;
	}

	let { onClose, onFocusComposer, onSidePanelChange, onScrollAwayChange }: Props = $props();

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
	let bottomSpacerEl: HTMLDivElement | null = $state(null);
	let scrollTimer: ReturnType<typeof setTimeout> | null = null;
	let lastScrollAway = false;

	function checkScrollAway() {
		if (mainScrollContainer && mainChatPath.length > 0) {
			const lastId = mainChatPath[mainChatPath.length - 1]!.id;
			const lastEl = mainScrollContainer.querySelector(`[data-exchange-id="${lastId}"]`);
			if (lastEl) {
				const rect = lastEl.getBoundingClientRect();
				const containerRect = mainScrollContainer.getBoundingClientRect();
				const away = rect.top > containerRect.bottom;
				if (away !== lastScrollAway) {
					lastScrollAway = away;
					onScrollAwayChange?.(away);
				}
			}
		}
	}

	function handleMainScroll() {
		mainScrollContainer?.classList.add('is-scrolling');
		if (scrollTimer) clearTimeout(scrollTimer);
		scrollTimer = setTimeout(() => {
			mainScrollContainer?.classList.remove('is-scrolling');
		}, 1000);

		checkScrollAway();
	}

	let providerState = $derived(app.providers.getState());
	let activeChat = $derived(app.chat.getChat());

	let activeExchanges = $derived(activeChat.exchanges);
	let activeTree = $derived({ rootId: activeChat.rootId, exchanges: activeChat.exchanges });
	let activeExchangeId = $derived(app.chat.getActiveExchangeId());
	let agentState = $derived(app.agent.getState());
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
	let _mainActivityExchangeId = $derived.by(() => {
		if (activeExchangeId && mainChatPath.some((exchange) => exchange.id === activeExchangeId)) {
			return activeExchangeId;
		}
		return mainChatTailId;
	});
	let _sideActivityExchangeId = $derived.by(() => {
		if (!sidePanelOpen || isDocumentPanel) return null;
		if (activeExchangeId && activeSideChat?.some((exchange) => exchange.id === activeExchangeId)) {
			return activeExchangeId;
		}
		return sideChatTailId;
	});
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
			tick().then(() => onFocusComposer?.());
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
		tick().then(() => onFocusComposer?.());
	}

	function closeSidePanel() {
		sidePanel = null;
		focusPanel(mainPanel.id);
	}

	function closeSideDocumentPanel() {
		if (activeDocumentIndex >= 0) {
			app.documents.closeDocument(activeDocumentIndex);
		}
		app.workspace.clearOpenDocument();
		closeSidePanel();
	}

	function addCurrentDocumentToChat() {
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
		tick().then(() => onFocusComposer?.());
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

	function canCreateSideChat(exchangeId: string): boolean {
		return app.chat.canCreateSideChat(activeTree, exchangeId);
	}

	function canPromoteSideChat(exchangeId: string): boolean {
		return app.chat.canPromoteSideChat(activeTree, exchangeId);
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
			model: app.providers.resolveModelLabel(exchange.provider, exchange.model),
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

	function resizeSpacer(el: Element) {
		if (!mainScrollContainer || !bottomSpacerEl) return;
		const needed = mainScrollContainer.clientHeight - (el as HTMLElement).offsetHeight;
		bottomSpacerEl.style.height = `${Math.max(128, needed)}px`;
	}

	export async function scrollToNode(nodeId: string | null) {
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
				if (container === mainScrollContainer) resizeSpacer(el);
				await tick();
				el.scrollIntoView({ behavior: 'smooth', block: 'start' });
				return;
			}
		}
	}

	export async function scrollToBottom() {
		if (!mainScrollContainer || mainChatPath.length === 0) return;
		const lastId = mainChatPath[mainChatPath.length - 1]!.id;
		const el = mainScrollContainer.querySelector(`[data-exchange-id="${lastId}"]`);
		if (el) {
			resizeSpacer(el);
			await tick();
			el.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}

	export function expandSideChat(exchangeId: string) {
		trackLatestSideChat = true;
		if (sidePanel && isSideChat(sidePanel) && sidePanel.content.parentExchangeId === exchangeId) {
			focusedPanelId = sidePanel.id;
			tick().then(() => onFocusComposer?.());
			return;
		}
		sidePanel = createSideChatPanel(exchangeId, 0);
		focusedPanelId = sidePanel.id;
		tick().then(() => onFocusComposer?.());
	}

	function getExchangePath(exchangeId: string): app.chat.Exchange[] {
		return app.chat.getExchangePath(activeTree, exchangeId);
	}

	function getSidePanelTarget(
		exchangeId: string
	): { parentId: string; sideChatIndex: number } | null {
		const path = getExchangePath(exchangeId);
		for (let index = 1; index < path.length; index += 1) {
			const parent = path[index - 1];
			const child = path[index];
			if (!parent || !child) continue;
			if ((parent.childIds[0] ?? null) === child.id) continue;

			const sideChats = app.chat.getSideChats(activeTree, parent.id);
			const sideChatIndex = sideChats.findIndex((sideChat) => sideChat[0]?.id === child.id);
			if (sideChatIndex >= 0) {
				return { parentId: parent.id, sideChatIndex };
			}
			return null;
		}
		return null;
	}

	export async function revealExchange(exchangeId: string) {
		const sideTarget = getSidePanelTarget(exchangeId);
		if (sideTarget) {
			sidePanel = createSideChatPanel(sideTarget.parentId, sideTarget.sideChatIndex);
			focusedPanelId = sidePanel.id;
			await tick();
			app.chat.selectExchange(exchangeId);
			await scrollToNode(exchangeId);
			return;
		}

		focusedPanelId = mainPanel.id;
		app.chat.selectExchange(exchangeId);
		await scrollToNode(exchangeId);
	}

	export function showDocument(folderId: string, fileId: string) {
		sidePanel = createDocumentPanel(folderId, fileId);
		focusedPanelId = sidePanel.id;
	}

	export function resetUIState() {
		if (sidePanel !== null) {
			app.workspace.clearOpenDocument();
		}
		closeSidePanel();
	}

	// When side panel closes, snap focus to main
	$effect(() => {
		if (!sidePanelOpen && focusedPane === 'side') {
			focusPanel(mainPanel.id);
		}
	});

	// Notify parent of side panel state changes
	$effect(() => {
		onSidePanelChange?.(sidePanelOpen);
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

	// Re-check scroll-away when chat path changes (e.g. opening a chat at the top)
	$effect(() => {
		void mainChatPath;
		tick().then(checkScrollAway);
	});
</script>

{#if operationError}
	<div class="error-banner">{operationError}</div>
{/if}

<div class="chatview-shell">
	<Header>
		<div class="chatview-title-inner">
			<MessageSquare size={14} />
			{activeChat.name}
			{#if onClose}
				<button class="chatview-close-btn" onclick={onClose} aria-label="Close chat panel">
					<X size={14} />
				</button>
			{/if}
		</div>
	</Header>
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="chatview-body" class:chatview-body-split={sidePanelOpen} onclick={focusMain}>
		<div
			class="pane-scroll chatview-main"
			bind:this={mainScrollContainer}
			onscroll={handleMainScroll}
		>
			<div class="chatview-exchanges">
				<ExchangeList
					exchanges={mainChatPath}
					{sidePanelOpen}
					{sidePanelParentId}
					getNodeData={getNodeDataForExchange}
				/>
				{#if mainChatPath.length === 0}
					<div class="chatview-empty">
						{providerState.activeModel
							? 'Type something and submit to get started with a chat. Or open a chat or document on the sidebar.'
							: 'Select a model to get started.'}
					</div>
				{/if}
			</div>
			<div class="chatview-bottom-spacer" bind:this={bottomSpacerEl}></div>
		</div>

		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="chatview-side"
			class:chatview-side-open={sidePanelOpen}
			onclick={(e) => { e.stopPropagation(); focusSide(); }}
		>
			{#if sidePanelOpen}
				{#if isDocumentPanel && activeDocumentFile}
					<div class="chatview-doc-wrap">
						<Document
							title={activeDocumentFile.name}
							content={activeDocumentFile.content}
							embedded={true}
							agentStreaming={false}
							agentProvider={providerState.activeModel?.provider}
							pendingContent={agentState.pendingContent}
							onContentChange={(c) => {
								if (activeDocumentIndex >= 0)
									app.documents.updateDocumentContent(activeDocumentIndex, c);
							}}
							onAcceptPending={() =>
								app.agent.acceptPending(
									documentContent
										? { folderId: documentContent.folderId, fileId: documentContent.fileId }
										: null
								)}
							onRejectPending={() => app.agent.rejectPending()}
							onClose={() => {
								app.agent.rejectPending();
								closeSideDocumentPanel();
							}}
							onAddToChat={addCurrentDocumentToChat}
						/>
					</div>
				{:else if !isDocumentPanel}
					<SidePanelHeader
						{sideChatIndex}
						sideChatCount={sideChats.length}
						onPrev={prevSideChat}
						onNext={nextSideChat}
						onNew={newSideChat}
						onClose={closeSidePanel}
					/>
					{#if sidePanelParentExchange}
						<SidePanelContext exchange={sidePanelParentExchange} />
					{/if}
					<div class="chatview-side-exchanges" bind:this={sideScrollContainer}>
						{#if activeSideChat}
							<ExchangeList exchanges={activeSideChat} getNodeData={getNodeDataForExchange} />
						{:else}
							<div class="chatview-empty">Type a message to start a side chat.</div>
						{/if}
					</div>
				{/if}
			{/if}
		</div>
	</div>
</div>

<DeleteExchangeDialog
	targetId={deleteTargetId}
	{deleteMode}
	hasSideChats={deleteTargetId ? getChildren(deleteTargetId).length > 1 : false}
	onChangeMode={(mode) => (deleteMode = mode)}
	onConfirm={confirmDelete}
	onCancel={() => (deleteTargetId = null)}
/>

<style>
	.chatview-shell {
		position: relative;
		display: flex;
		flex-direction: column;
		height: 100%;
		min-width: 0;
		overflow: hidden;
	}

	.chatview-body {
		position: relative;
		display: flex;
		flex: 1;
		overflow: hidden;
	}

	/* Split layout — border added to main scroll area when side panel is open */
	.chatview-body-split > :first-child {
		border-right: 1px solid var(--border-color);
	}

	/* Side panel open/closed transition */
	.chatview-side {
		position: relative;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		flex: 0;
		opacity: 0;
		transition:
			flex 400ms ease,
			opacity 400ms ease;
	}

	.chatview-side-open {
		flex: 1;
		opacity: 1;
	}


	.chatview-title-inner {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
	}

	.chatview-close-btn {
		margin-left: auto;
		display: flex;
		height: 1.75rem;
		width: 1.75rem;
		cursor: pointer;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		border: none;
		background: transparent;
		color: hsl(var(--muted-foreground));
		transition:
			background 150ms,
			color 150ms;
	}

	.chatview-close-btn:hover {
		background: hsl(var(--muted));
		color: hsl(var(--foreground));
	}

	/* .chatview-main extends .pane-scroll — fills the body alongside side panel */
	.chatview-main {
		flex: 1;
		min-height: 0;
	}

	.chatview-exchanges {
		max-width: var(--pane-content-width);
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding-top: 1.5rem;
	}

	.chatview-bottom-spacer {
		height: 8rem;
		flex-shrink: 0;
	}

	.chatview-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: calc(100vh - 200px);
		text-align: center;
		font-size: 28px;
		font-weight: var(--font-weight-medium);
		color: hsl(var(--foreground));
		max-width: 500px;
		margin: 0 auto;
	}

	.chatview-side-exchanges {
		flex: 1;
		overflow-y: auto;
		padding: 1rem 0.75rem calc(100vh - 150px);
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.chatview-doc-wrap {
		display: flex;
		flex-direction: column;
		flex: 1;
		overflow: hidden;
	}

</style>
