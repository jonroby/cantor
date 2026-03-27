<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { computeCanvasLayout, NODE_WIDTH } from './layout';
	import type { CanvasNode } from './layout';
	import { getProviderForModelId } from '@/lib/models';
	import Button from '@/components/custom/button.svelte';
	import ExchangeNode from '@/features/canvas/ExchangeNode.svelte';
	import CodeEditor from '@/features/code-editor/CodeEditor.svelte';
	import PythonEditor from '@/features/python-editor/PythonEditor.svelte';
	import Canvas from '@/features/canvas/Canvas.svelte';
	import DrawingBoard from '@/features/drawing-board/DrawingBoard.svelte';
	import DocsPanel from '@/features/docs-panel/DocsPanel.svelte';
	import type { Shape } from '@/features/drawing-board/drawing-types';
	import {
		buildExchangesByParentId,
		canCreateSideChats,
		canPromoteSideChatToMainChat,
		deleteExchangeWithModeResult,
		getChildExchanges,
		getDescendantExchanges,
		getMainChatTail,
		promoteSideChatToMainChat,
		type DeleteMode,
		type ExchangeMap
	} from '@/domain/tree';
	import {
		chatState,
		getActiveExchanges,
		getActiveExchangeId,
		replaceActiveExchanges,
		setActiveExchangeId,
		forkChat as forkChatAction
	} from '@/state/chats.svelte';
	import { docState, updateDocContent, closeDoc } from '@/state/documents.svelte';

	let expandedSideChatParent: string | null = $state(null);
	let measuredNodeHeights: Record<string, number> = $state({});
	let drawingShapes: Shape[] = $state([]);
	let canvasRef: Canvas | null = $state(null);
	let deleteTargetId: string | null = $state(null);
	let deleteMode: DeleteMode = $state('exchange');
	let operationError: string | null = $state(null);

	let activeExchanges = $derived(getActiveExchanges());
	let activeExchangeId = $derived(getActiveExchangeId());
	let exchangesByParentId = $derived(
		activeExchanges ? buildExchangesByParentId(activeExchanges) : {}
	);
	let collapsedParentIds = $derived(getCollapsedParentIds());
	let hiddenExchangeIds = $derived(getHiddenExchangeIds());
	let canvas = $derived(
		activeExchanges
			? computeCanvasLayout(activeExchanges, {
					hiddenExchangeIds,
					measuredHeights: measuredNodeHeights,
					docsPanelCount: docState.openDocs.length
				})
			: computeCanvasLayout({}, { docsPanelCount: docState.openDocs.length })
	);
	let nodeLookup = $derived(new Map(canvas.nodes.map((node) => [node.id, node])));

	$effect(() => {
		if (activeExchanges) {
			const exchangeIds = new Set(Object.keys(activeExchanges));
			const filteredHeights = Object.fromEntries(
				Object.entries(measuredNodeHeights).filter(([exchangeId]) => exchangeIds.has(exchangeId))
			);
			if (Object.keys(filteredHeights).length !== Object.keys(measuredNodeHeights).length) {
				measuredNodeHeights = filteredHeights;
			}
		}
	});

	$effect(() => {
		if (expandedSideChatParent && activeExchanges && !activeExchanges[expandedSideChatParent]) {
			expandedSideChatParent = null;
		}
	});

	function getCollapsedParentIds() {
		if (!activeExchanges) return new Set<string>();
		return new Set(
			Object.values(activeExchanges)
				.filter((exchange) => (exchangesByParentId[exchange.id]?.length ?? 0) > 1)
				.map((exchange) => exchange.id)
				.filter((id) => id !== expandedSideChatParent)
		);
	}

	function getHiddenExchangeIds() {
		if (!activeExchanges) return new SvelteSet<string>();
		const hidden = new SvelteSet<string>();
		for (const parentId of collapsedParentIds) {
			const children = getChildExchanges(activeExchanges, parentId, exchangesByParentId);
			for (let index = 1; index < children.length; index += 1) {
				const sideRootId = children[index]?.id;
				if (!sideRootId) continue;
				hidden.add(sideRootId);
				for (const descendantId of getDescendantExchanges(activeExchanges, sideRootId)) {
					hidden.add(descendantId);
				}
			}
		}
		return hidden;
	}

	function doReplaceActiveExchanges(nextExchanges: ExchangeMap) {
		measuredNodeHeights = {};
		replaceActiveExchanges(nextExchanges);
	}

	function setMeasuredNodeHeight(exchangeId: string, height: number) {
		const roundedHeight = Math.ceil(height);
		if (!Number.isFinite(roundedHeight) || roundedHeight <= 0) return;
		if (measuredNodeHeights[exchangeId] === roundedHeight) return;
		measuredNodeHeights = { ...measuredNodeHeights, [exchangeId]: roundedHeight };
	}

	function forkChat(exchangeId: string) {
		if (!activeExchanges) return;
		forkChatAction(exchangeId);
		expandedSideChatParent = null;
		scrollToNode(getActiveExchangeId());
	}

	export function scrollToNode(nodeId: string | null) {
		if (!nodeId || !canvasRef) return;
		const node = nodeLookup.get(nodeId);
		if (node) {
			canvasRef.scrollNodeToTop(node.y, node.x + NODE_WIDTH / 2, {
				zoom: 1,
				duration: 250,
				topOffset: 60
			});
		}
	}

	export function fitView() {
		canvasRef?.fitView({ duration: 250, maxZoom: 1 });
	}

	export function scrollToTop() {
		const first = canvas.nodes[0];
		if (first && canvasRef) {
			canvasRef.scrollNodeToTop(first.y, first.x + NODE_WIDTH / 2, {
				zoom: 1,
				duration: 250,
				topOffset: 60
			});
		}
	}

	export function resetUIState() {
		expandedSideChatParent = null;
		measuredNodeHeights = {};
	}

	function toggleSideChildren(exchangeId: string) {
		expandedSideChatParent = expandedSideChatParent === exchangeId ? null : exchangeId;
	}

	function openDeleteDialog(exchangeId: string) {
		if (!activeExchanges) return;
		deleteTargetId = exchangeId;
		const children = getChildExchanges(activeExchanges, exchangeId, exchangesByParentId);
		deleteMode = children.length > 1 ? 'exchangeAndSideChats' : 'exchange';
	}

	function confirmDelete() {
		if (!activeExchanges || !deleteTargetId) return;
		try {
			const result = deleteExchangeWithModeResult(activeExchanges, deleteTargetId, deleteMode);
			doReplaceActiveExchanges(result.exchanges);
			if (deleteTargetId === activeExchangeId || !result.exchanges[activeExchangeId ?? '']) {
				setActiveExchangeId(getMainChatTail(result.exchanges));
			}
			deleteTargetId = null;
			operationError = null;
		} catch (error) {
			operationError = error instanceof Error ? error.message : 'Unable to delete exchange.';
		}
	}

	function promoteExchange(exchangeId: string) {
		if (!activeExchanges) return;
		try {
			setActiveExchangeId(exchangeId);
			doReplaceActiveExchanges(promoteSideChatToMainChat(activeExchanges, exchangeId));
			operationError = null;
		} catch (error) {
			operationError = error instanceof Error ? error.message : 'Unable to promote exchange.';
		}
	}

	function getExchangeNodeData(exchangeId: string) {
		try {
			const exchange = activeExchanges?.[exchangeId];
			if (!exchange) return null;
			const children = activeExchanges
				? getChildExchanges(activeExchanges, exchangeId, exchangesByParentId)
				: [];
			const hasSideChildren =
				canCreateSideChats(activeExchanges, exchangeId, exchangesByParentId) && children.length > 1;
			const isSideRoot = exchange.parentId
				? (getChildExchanges(activeExchanges, exchange.parentId, exchangesByParentId)[0]?.id ??
						null) !== exchangeId
				: false;

			return {
				prompt: exchange.prompt,
				response: exchange.response,
				model: exchange.model,
				provider: exchange.model ? getProviderForModelId(exchange.model) : null,
				isActive: activeExchangeId === exchangeId,
				isStreaming: chatState.streamingExchangeIds.includes(exchangeId),
				canFork: true,
				hasSideChildren,
				isSideRoot,
				canPromote:
					!!activeExchanges &&
					canPromoteSideChatToMainChat(activeExchanges, exchangeId, exchangesByParentId),
				onMeasure: (height: number) => setMeasuredNodeHeight(exchangeId, height),
				onSelect: () => setActiveExchangeId(exchangeId),
				onFork: () => forkChat(exchangeId),
				onToggleSideChildren: () => toggleSideChildren(exchangeId),
				onPromote: () => promoteExchange(exchangeId),
				onDelete: () => openDeleteDialog(exchangeId)
			};
		} catch (error) {
			console.error(`Failed to render exchange "${exchangeId}":`, error);
			return null;
		}
	}
</script>

{#if operationError}
	<div class="error-banner">{operationError}</div>
{/if}

<div class="flow-shell">
	<Canvas
		nodes={canvas.nodes}
		edges={canvas.edges}
		canvasWidth={canvas.width}
		canvasHeight={canvas.height}
		nodeWidth={NODE_WIDTH}
		codeEditor={canvas.codeEditor}
		pythonEditor={canvas.pythonEditor}
		drawingBoard={canvas.drawingBoard}
		docsPanels={canvas.docsPanels}
		bind:this={canvasRef}
	>
		{#snippet renderNode(n: CanvasNode)}
			{@const nodeData = getExchangeNodeData(n.id)}
			{#if nodeData}
				<ExchangeNode data={nodeData} />
			{/if}
		{/snippet}
		{#snippet renderCodeEditor()}
			<CodeEditor />
		{/snippet}
		{#snippet renderPythonEditor()}
			<PythonEditor />
		{/snippet}
		{#snippet renderDrawingBoard()}
			<DrawingBoard shapes={drawingShapes} onShapesChange={(s) => (drawingShapes = s)} />
		{/snippet}
		{#snippet renderDocsPanel(index: number)}
			{@const doc = docState.openDocs[index]}
			{#if doc}
				{@const docFile = doc.docKey
					? docState.folders
							.find((f) => f.id === doc.docKey!.folderId)
							?.files?.find((f) => f.id === doc.docKey!.fileId)
					: null}
				<DocsPanel
					title={docFile?.name}
					content={doc.content}
					onContentChange={(c) => updateDocContent(index, c)}
					onClose={() => closeDoc(index)}
				/>
			{/if}
		{/snippet}
	</Canvas>
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
