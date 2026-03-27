<script lang="ts">
	import { tick } from 'svelte';
	import Button from '@/components/custom/button.svelte';
	import ChatMessage from './ChatMessage.svelte';
	import { ChatInput } from '@/views/shared';
	import {
		getChildExchanges,
		getRootExchange,
		type Exchange,
		type DeleteMode
	} from '@/domain/tree';
	import type { ChatTree } from '@/domain/tree';
	import {
		getActiveChat,
		getActiveExchanges,
		getActiveExchangeId,
		setActiveExchangeId
	} from '@/state/chats.svelte';
	import {
		getExchangeNodeData as getNodeData,
		performDelete,
		performPromote,
		performFork,
		getDeleteMode
	} from '@/app/chat-actions';

	type FocusedPane = 'main' | 'side';

	let sidePanelOpen = $state(false);
	let sidePanelParentId: string | null = $state(null);
	let sideBranchIndex = $state(0);
	let trackLatestBranch = $state(false);
	let focusedPane: FocusedPane = $state('main');
	let deleteTargetId: string | null = $state(null);
	let deleteMode: DeleteMode = $state('exchange');
	let operationError: string | null = $state(null);
	let mainScrollContainer: HTMLDivElement | null = $state(null);
	let sideScrollContainer: HTMLDivElement | null = $state(null);
	let chatInputRef: ReturnType<typeof ChatInput> | undefined = $state();

	let activeExchanges = $derived(getActiveExchanges());
	let activeExchangeId = $derived(getActiveExchangeId());
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

	function getMainChatPath(): Exchange[] {
		if (!activeExchanges) return [];
		const root = getRootExchange({ rootId: getActiveChat().rootId, exchanges: activeExchanges });
		if (!root) return [];
		const path: Exchange[] = [];
		let currentId: string | null = root.id;
		while (currentId) {
			const children = getChildExchanges(activeExchanges, currentId);
			if (children.length === 0) break;
			const mainChild = children[0]!;
			path.push(mainChild);
			currentId = mainChild.id;
		}
		return path;
	}

	function getSideBranches(): Exchange[][] {
		if (!activeExchanges || !sidePanelParentId) return [];
		const children = getChildExchanges(activeExchanges, sidePanelParentId);
		if (children.length <= 1) return [];

		const branches: Exchange[][] = [];
		for (let i = 1; i < children.length; i++) {
			const branch: Exchange[] = [];
			let current: Exchange | undefined = children[i];
			while (current) {
				branch.push(current);
				const grandChildren = getChildExchanges(activeExchanges, current.id);
				current = grandChildren[0];
			}
			branches.push(branch);
		}
		return branches;
	}

	function focusPane(pane: FocusedPane) {
		focusedPane = pane;
		if (pane === 'main') {
			setActiveExchangeId(mainChatTailId);
		} else if (pane === 'side') {
			if (sideBranchTailId) {
				setActiveExchangeId(sideBranchTailId);
			} else if (sidePanelParentId) {
				setActiveExchangeId(sidePanelParentId);
			}
		}
		tick().then(() => chatInputRef?.focus());
	}

	function openSidePanel(parentId: string) {
		if (sidePanelOpen && sidePanelParentId === parentId) {
			closeSidePanel();
			return;
		}

		sidePanelParentId = parentId;
		sidePanelOpen = true;
		focusedPane = 'side';

		const children = activeExchanges
			? getChildExchanges(activeExchanges, parentId)
			: [];
		if (children.length > 1) {
			sideBranchIndex = children.length - 2;
			let current = children[children.length - 1];
			while (current) {
				const grandChildren = activeExchanges
					? getChildExchanges(activeExchanges, current.id)
					: [];
				if (grandChildren.length === 0) break;
				current = grandChildren[0];
			}
			if (current) setActiveExchangeId(current.id);
		} else {
			sideBranchIndex = 0;
			setActiveExchangeId(parentId);
		}
		tick().then(() => chatInputRef?.focus());
	}

	function closeSidePanel() {
		sidePanelOpen = false;
		sidePanelParentId = null;
		focusPane('main');
	}

	function prevBranch() {
		if (sideBranchIndex > 0) {
			sideBranchIndex--;
			focusPane('side');
		}
	}

	function nextBranch() {
		if (sideBranchIndex < sideBranches.length - 1) {
			sideBranchIndex++;
			focusPane('side');
		}
	}

	function newSideBranch() {
		if (!sidePanelParentId) return;
		// If current branch is already empty, do nothing
		if (!activeSideBranch || activeSideBranch.length === 0) return;
		// Jump past existing branches to show empty state
		sideBranchIndex = sideBranches.length;
		setActiveExchangeId(sidePanelParentId);
		tick().then(() => chatInputRef?.focus());
	}

	function forkChat(exchangeId: string) {
		performFork(exchangeId);
	}

	function openDeleteDialog(exchangeId: string) {
		if (!activeExchanges) return;
		deleteTargetId = exchangeId;
		deleteMode = getDeleteMode(activeExchanges, exchangeId);
	}

	function confirmDelete() {
		if (!activeExchanges || !deleteTargetId) return;
		const result = performDelete(activeExchanges, deleteTargetId, deleteMode, activeExchangeId);
		if (result.error) {
			operationError = result.error;
		} else {
			deleteTargetId = null;
			operationError = null;
		}
	}

	function promoteExchange(exchangeId: string) {
		if (!activeExchanges) return;
		const result = performPromote(activeExchanges, exchangeId);
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

	function getNodeDataForExchange(exchangeId: string) {
		if (!activeExchanges) return null;
		return getNodeData(exchangeId, activeExchanges, activeExchangeId, {
			onSelect: (id) => setActiveExchangeId(id),
			onFork: forkChat,
			onToggleSideChildren: toggleSideChildren,
			onPromote: promoteExchange,
			onDelete: openDeleteDialog
		});
	}

	async function scrollToNode(nodeId: string | null) {
		if (!nodeId) return;
		await tick();
		// Try the focused pane first, then the other
		const containers =
			focusedPane === 'side'
				? [sideScrollContainer, mainScrollContainer]
				: [mainScrollContainer, sideScrollContainer];
		for (const container of containers) {
			if (!container) continue;
			const el = container.querySelector(`[data-exchange-id="${nodeId}"]`);
			if (el) {
				el.scrollIntoView({ behavior: 'smooth', block: 'center' });
				return;
			}
		}
	}

	function expandSideChat(exchangeId: string) {
		trackLatestBranch = true;
		focusedPane = 'side';
		if (sidePanelOpen && sidePanelParentId === exchangeId) {
			tick().then(() => chatInputRef?.focus());
			return;
		}
		sidePanelParentId = exchangeId;
		sidePanelOpen = true;
		tick().then(() => chatInputRef?.focus());
	}

	export function resetUIState() {
		closeSidePanel();
	}

	// When side panel closes, snap focus to main
	$effect(() => {
		if (!sidePanelOpen && focusedPane === 'side') {
			focusPane('main');
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
			sideBranchIndex = sideBranches.length - 1;
			trackLatestBranch = false;
		}
	});

	// Clamp branch index (allow one past the end for "new branch" empty state)
	$effect(() => {
		if (sideBranchIndex > sideBranches.length && sideBranches.length > 0) {
			sideBranchIndex = sideBranches.length - 1;
		}
	});

	// Keep activeExchangeId synced with focused pane's tail
	$effect(() => {
		if (focusedPane === 'side' && sideBranchTailId) {
			setActiveExchangeId(sideBranchTailId);
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
			onclick={() => focusPane('main')}
		>
			<div class="chatview-main-title">{getActiveChat().name}</div>
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
			onclick={() => focusPane('side')}
		>
			{#if sidePanelOpen}
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
								{sidePanelParentExchange.response.text.slice(0, 150)}{sidePanelParentExchange.response.text
									.length > 150
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
			/>
		</div>
	</div>
</div>

{#if deleteTargetId}
	{@const children = activeExchanges
		? getChildExchanges(activeExchanges, deleteTargetId)
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
