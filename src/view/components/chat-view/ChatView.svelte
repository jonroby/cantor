<script lang="ts">
	import { tick } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { MessageSquare, Search, X } from 'lucide-svelte';
	import { Button, Header } from '@/view/primitives';
	import * as Tooltip from '@/view/primitives/tooltip';
	import { createMainChatPanel, createDocumentPanel } from '@/view/components/panel';
	import type { Panel } from '@/view/components/panel';
	import type { ChatCardData } from '@/view/components/chat-card';
	import { Document } from '@/view/components/document';
	import DeleteExchangeDialog from './DeleteExchangeDialog.svelte';
	import SidePanelHeader from './SidePanelHeader.svelte';
	import ExchangeList from './ExchangeList.svelte';
	import * as app from '@/app';

	interface SideChatProps {
		parentExchangeId: string;
		sideChatIndex: number;
		onPrev: () => void;
		onNext: () => void;
		onNew: () => void;
	}

	interface Props {
		onClose?: () => void;
		onFocusComposer?: () => void;
		onScrollAwayChange?: (away: boolean) => void;
		onSearchOpen?: () => void;
		sideChat?: SideChatProps;
	}

	let { onClose, onFocusComposer, onScrollAwayChange, onSearchOpen, sideChat }: Props = $props();

	// ── Panel state ─────────────────────────────────────────────────────────
	let mainPanel: Panel = $state(createMainChatPanel());
	let documentSidePanel = $state<Panel | null>(null);
	let focusedPanelId: string = $state(mainPanel.id);

	// ── Derived compatibility shims ─────────────────────────────────────────
	let sidePanelOpen = $derived(documentSidePanel !== null);
	let sidePanelParentId = $derived(sideChat?.parentExchangeId ?? null);
	let sideChatIndex = $derived(sideChat?.sideChatIndex ?? 0);
	let focusedPane = $derived<'main' | 'side'>(
		documentSidePanel !== null && focusedPanelId === documentSidePanel.id ? 'side' : 'main'
	);

	let deleteTargetId: string | null = $state(null);
	let deleteMode: app.chat.DeleteMode = $state('exchange');
	let operationError: string | null = $state(null);
	let mainScrollContainer: HTMLDivElement | null = $state(null);
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
		if (!sideChat || isDocumentPanel) return null;
		if (activeExchangeId && activeSideChat?.some((exchange) => exchange.id === activeExchangeId)) {
			return activeExchangeId;
		}
		return sideChatTailId;
	});
	let sidePanelParentExchange = $derived(
		sidePanelParentId && activeExchanges ? activeExchanges[sidePanelParentId] : null
	);
	let documentContent = $derived(
		documentSidePanel !== null && documentSidePanel.content.type === 'document'
			? documentSidePanel.content
			: null
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
	let isDocumentPanel = $derived(
		documentSidePanel !== null && documentSidePanel.content.type === 'document'
	);

	function getMainChatPath(): app.chat.Exchange[] {
		return app.chat.getMainChat(activeTree);
	}

	function getSideChats(): app.chat.Exchange[][] {
		if (!sidePanelParentId) return [];
		return app.chat.getSideChats(activeTree, sidePanelParentId);
	}

	function focusMain() {
		focusedPanelId = mainPanel.id;
		app.chat.selectExchange(mainChatTailId);
		tick().then(() => onFocusComposer?.());
	}

	function openSidePanel(parentId: string) {
		const panels = app.workspace.getState().panels;
		const existing = panels.find((p) => p.type === 'side-chat' && p.parentExchangeId === parentId);
		if (existing) {
			return;
		}

		const sideChats = app.chat.getSideChats(activeTree, parentId);
		const sideChatIdx = sideChats.length > 0 ? sideChats.length - 1 : 0;

		if (sideChats.length > 0) {
			const latestSideChat = sideChats[sideChats.length - 1];
			const tail = latestSideChat?.[latestSideChat.length - 1];
			if (tail) app.chat.selectExchange(tail.id);
		} else {
			app.chat.selectExchange(parentId);
		}

		const chatPanel = panels.find((p) => p.type === 'chat');
		const newPanels = chatPanel
			? [
					chatPanel,
					{ type: 'side-chat' as const, parentExchangeId: parentId, sideChatIndex: sideChatIdx }
				]
			: [
					...panels.slice(0, 1),
					{ type: 'side-chat' as const, parentExchangeId: parentId, sideChatIndex: sideChatIdx }
				];
		app.workspace.setPanels(newPanels);
		tick().then(() => onFocusComposer?.());
	}

	function closeSideDocumentPanel() {
		if (activeDocumentIndex >= 0) {
			app.documents.closeDocument(activeDocumentIndex);
		}
		app.workspace.clearOpenDocument();
		documentSidePanel = null;
		focusedPanelId = mainPanel.id;
	}

	function addCurrentDocumentToChat() {
		if (!documentContent) return;
		app.documents.addDocumentToChat(documentContent.folderId, documentContent.fileId);
	}

	function prevSideChat() {
		sideChat?.onPrev();
	}

	function nextSideChat() {
		sideChat?.onNext();
	}

	function newSideChat() {
		sideChat?.onNew();
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
			const panels = app.workspace.getState().panels;
			app.workspace.setPanels(panels.filter((p) => p.type !== 'side-chat'));
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
		bottomSpacerEl.style.height = `${Math.max(128, needed) + 310}px`;
	}

	export async function scrollToNode(nodeId: string | null) {
		if (!nodeId) return;
		await tick();
		const containers = [mainScrollContainer];
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
		const lastExchange = mainChatPath[mainChatPath.length - 1]!;
		if (mainChatPath.length === 1 && !lastExchange.prompt.text && !lastExchange.response) return;
		const lastId = mainChatPath[mainChatPath.length - 1]!.id;
		const el = mainScrollContainer.querySelector(`[data-exchange-id="${lastId}"]`);
		if (el) {
			resizeSpacer(el);
			await tick();
			el.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}

	export function expandSideChat(exchangeId: string, _targetExchangeId?: string) {
		openSidePanel(exchangeId);
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
			openSidePanel(sideTarget.parentId);
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
		documentSidePanel = createDocumentPanel(folderId, fileId);
		focusedPanelId = documentSidePanel.id;
	}

	export function resetUIState() {
		if (documentSidePanel !== null) {
			app.workspace.clearOpenDocument();
		}
		documentSidePanel = null;
		focusedPanelId = mainPanel.id;
	}

	// When document side panel closes, snap focus to main
	$effect(() => {
		if (!sidePanelOpen && focusedPane === 'side') {
			focusedPanelId = mainPanel.id;
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
	{#if sideChat}
		<SidePanelHeader
			sideChatIndex={sideChat.sideChatIndex}
			sideChatCount={sideChats.length}
			onPrev={prevSideChat}
			onNext={nextSideChat}
			onNew={newSideChat}
			onClose={() => onClose?.()}
		/>
		<div class="pane-scroll chatview-main" bind:this={mainScrollContainer}>
			<div class="chatview-exchanges">
				{#if sidePanelParentExchange}
					<ExchangeList
						exchanges={[sidePanelParentExchange]}
						getNodeData={(id) => {
							const data = getNodeDataForExchange(id);
							if (!data) return null;
							return {
								...data,
								hasSideChildren: false,
								sideChildrenCount: 0,
								canCreateSideChat: false
							};
						}}
					/>
				{/if}
				{#if activeSideChat}
					<ExchangeList exchanges={activeSideChat} getNodeData={getNodeDataForExchange} />
				{:else}
					<div class="chatview-empty"></div>
				{/if}
			</div>
			<div class="chatview-bottom-spacer" bind:this={bottomSpacerEl}></div>
		</div>
	{:else}
		<Header>
			<div class="chatview-title-inner">
				<MessageSquare size={14} />
				{activeChat.name}
				{#if onSearchOpen}
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<Button
									{...props}
									class="chatview-header-btn"
									variant="ghost"
									size="icon"
									onclick={onSearchOpen}
									aria-label="Search"
								>
									<Search size={14} />
								</Button>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content>Search</Tooltip.Content>
					</Tooltip.Root>
				{/if}
				{#if onClose}
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<button
									{...props}
									class="chatview-close-btn"
									onclick={onClose}
									aria-label="Close chat panel"
								>
									<X size={14} />
								</button>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content>Close panel</Tooltip.Content>
					</Tooltip.Root>
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
							{providerState.activeModel ? 'How can I help you?' : 'Select a model to get started.'}
						</div>
					{/if}
				</div>
				<div class="chatview-bottom-spacer" bind:this={bottomSpacerEl}></div>
			</div>

			<div class="chatview-side" class:chatview-side-open={sidePanelOpen}>
				{#if sidePanelOpen && isDocumentPanel && activeDocumentFile}
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
				{/if}
			</div>
		</div>
	{/if}
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
		overflow-x: hidden;
	}

	.chatview-body {
		position: relative;
		display: flex;
		flex: 1;
		overflow-x: hidden;
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

	:global(.chatview-header-btn) {
		margin-left: auto;
		height: 1.75rem;
		width: 1.75rem;
		color: hsl(var(--muted-foreground));
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
		width: 100%;
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
		font-size: 26px;
		font-weight: var(--font-weight-medium);
		color: hsl(var(--foreground));
		max-width: 500px;
		margin: 0 auto;
	}

	.chatview-doc-wrap {
		display: flex;
		flex-direction: column;
		flex: 1;
		overflow: hidden;
	}
</style>
