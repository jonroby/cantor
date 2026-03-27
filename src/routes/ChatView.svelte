<script lang="ts">
	import { tick } from 'svelte';
	import Button from '@/components/custom/button.svelte';
	import ExchangeNode from '@/features/canvas/ExchangeNode.svelte';
	import { ChatInput } from '@/features/chat-input';
	import { ROOT_ANCHOR_ID, getChildExchanges, type Exchange, type DeleteMode } from '@/domain/tree';
	import {
		getActiveExchanges,
		getActiveExchangeId,
		setActiveExchangeId
	} from '@/state/chats.svelte';
	import {
		getExchangeNodeData as getNodeData,
		performDelete,
		performPromote,
		performFork,
		getDeleteMode,
		buildExchangesByParentId
	} from '@/features/chat-ops';

	let sidePanelOpen = $state(false);
	let sidePanelParentId: string | null = $state(null);
	let sideBranchIndex = $state(0);
	let trackLatestBranch = $state(false);
	let deleteTargetId: string | null = $state(null);
	let deleteMode: DeleteMode = $state('exchange');
	let operationError: string | null = $state(null);
	let scrollContainer: HTMLDivElement | null = $state(null);

	let activeExchanges = $derived(getActiveExchanges());
	let activeExchangeId = $derived(getActiveExchangeId());
	let exchangesByParentId = $derived(
		activeExchanges ? buildExchangesByParentId(activeExchanges) : {}
	);

	let mainChatPath = $derived(getMainChatPath());
	let sideBranches = $derived(getSideBranches());
	let activeSideBranch = $derived(
		sideBranches.length > 0
			? sideBranches[Math.min(sideBranchIndex, sideBranches.length - 1)]
			: null
	);

	function getMainChatPath(): Exchange[] {
		if (!activeExchanges) return [];
		const path: Exchange[] = [];
		let currentId: string | null = ROOT_ANCHOR_ID;
		while (currentId) {
			const children = getChildExchanges(activeExchanges, currentId, exchangesByParentId);
			if (children.length === 0) break;
			const mainChild = children[0]!;
			if (!mainChild.isAnchor) {
				path.push(mainChild);
			}
			currentId = mainChild.id;
		}
		return path;
	}

	function getSideBranches(): Exchange[][] {
		if (!activeExchanges || !sidePanelParentId) return [];
		const children = getChildExchanges(activeExchanges, sidePanelParentId, exchangesByParentId);
		if (children.length <= 1) return [];

		const branches: Exchange[][] = [];
		for (let i = 1; i < children.length; i++) {
			const branch: Exchange[] = [];
			let current: Exchange | undefined = children[i];
			while (current) {
				branch.push(current);
				const grandChildren = getChildExchanges(activeExchanges, current.id, exchangesByParentId);
				current = grandChildren[0];
			}
			branches.push(branch);
		}
		return branches;
	}

	function openSidePanel(parentId: string) {
		if (sidePanelOpen && sidePanelParentId === parentId) {
			sidePanelOpen = false;
			sidePanelParentId = null;
			return;
		}
		sidePanelParentId = parentId;
		sideBranchIndex = 0;
		sidePanelOpen = true;
	}

	function closeSidePanel() {
		sidePanelOpen = false;
		sidePanelParentId = null;
	}

	function prevBranch() {
		if (sideBranchIndex > 0) sideBranchIndex--;
	}

	function nextBranch() {
		if (sideBranchIndex < sideBranches.length - 1) sideBranchIndex++;
	}

	function forkChat(exchangeId: string) {
		performFork(exchangeId);
	}

	function openDeleteDialog(exchangeId: string) {
		if (!activeExchanges) return;
		deleteTargetId = exchangeId;
		deleteMode = getDeleteMode(activeExchanges, exchangeId, exchangesByParentId);
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
		return getNodeData(exchangeId, activeExchanges, activeExchangeId, exchangesByParentId, {
			onSelect: (id) => setActiveExchangeId(id),
			onFork: forkChat,
			onToggleSideChildren: toggleSideChildren,
			onPromote: promoteExchange,
			onDelete: openDeleteDialog
		});
	}

	async function scrollToNode(nodeId: string | null) {
		if (!nodeId || !scrollContainer) return;
		await tick();
		const el = scrollContainer.querySelector(`[data-exchange-id="${nodeId}"]`);
		if (el) {
			el.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}
	}

	function expandSideChat(exchangeId: string) {
		trackLatestBranch = true;
		if (sidePanelOpen && sidePanelParentId === exchangeId) return;
		sidePanelParentId = exchangeId;
		sidePanelOpen = true;
	}

	export function resetUIState() {
		closeSidePanel();
	}

	// Close side panel when exchanges change and parent no longer has side children
	$effect(() => {
		if (sidePanelOpen && sidePanelParentId && activeExchanges) {
			const children = getChildExchanges(activeExchanges, sidePanelParentId, exchangesByParentId);
			if (children.length <= 1) {
				closeSidePanel();
			}
		}
	});

	// Follow the latest branch when a new side chat is created
	$effect(() => {
		if (trackLatestBranch && sideBranches.length > 0) {
			sideBranchIndex = sideBranches.length - 1;
			trackLatestBranch = false;
		}
	});

	// Clamp branch index
	$effect(() => {
		if (sideBranchIndex >= sideBranches.length && sideBranches.length > 0) {
			sideBranchIndex = sideBranches.length - 1;
		}
	});
</script>

{#if operationError}
	<div class="error-banner">{operationError}</div>
{/if}

<div class="chatview-shell">
	<div class="chatview-body" class:chatview-body-split={sidePanelOpen}>
		<div class="chatview-main" bind:this={scrollContainer}>
			<div class="chatview-exchanges">
				{#each mainChatPath as exchange (exchange.id)}
					{@const nodeData = getNodeDataForExchange(exchange.id)}
					{#if nodeData}
						<div
							class="chatview-exchange-wrap"
							class:chatview-branch-source={sidePanelOpen && sidePanelParentId === exchange.id}
							data-exchange-id={exchange.id}
						>
							<ExchangeNode data={nodeData} />
						</div>
					{/if}
				{/each}
				{#if mainChatPath.length === 0}
					<div class="chatview-empty">Start a conversation below.</div>
				{/if}
			</div>
		</div>

		{#if sidePanelOpen && activeSideBranch}
			<div class="chatview-side">
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
						{sideBranchIndex + 1} / {sideBranches.length}
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
				<div class="chatview-side-exchanges">
					{#each activeSideBranch as exchange (exchange.id)}
						{@const nodeData = getNodeDataForExchange(exchange.id)}
						{#if nodeData}
							<div class="chatview-exchange-wrap" data-exchange-id={exchange.id}>
								<ExchangeNode data={nodeData} />
							</div>
						{/if}
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<ChatInput onScrollToNode={scrollToNode} onExpandSideChat={expandSideChat} />
</div>

{#if deleteTargetId}
	{@const children = activeExchanges
		? getChildExchanges(activeExchanges, deleteTargetId, exchangesByParentId)
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
