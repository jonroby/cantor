<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { computeCanvasLayout, NODE_WIDTH } from './layout';
	import type { CanvasNode } from './layout';
	import Button from '@/view/components/custom/button.svelte';
	import ExchangeNode from './ExchangeNode.svelte';
	import CodeEditor from '@/view/features/code-editor/CodeEditor.svelte';
	import PythonEditor from '@/view/features/python-editor/PythonEditor.svelte';
	import Canvas from './Canvas.svelte';
	import DrawingBoard from '@/view/features/drawing-board/DrawingBoard.svelte';
	import Document from '@/view/features/document/Document.svelte';
	import type { Shape } from '@/view/features/drawing-board/drawing-types';
	import {
		getChildExchanges,
		getDescendantExchanges,
		type DeleteMode,
		type ChatTree
	} from '@/domain/tree';
	import {
		getActiveChat,
		getActiveExchanges,
		getActiveExchangeId,
		setActiveExchangeId
	} from '@/state/chats';
	import { docState, updateDocContent, closeDoc } from '@/state/documents';
	import {
		getExchangeNodeData as getNodeData,
		performDelete,
		performPromote,
		performCopy,
		getDeleteMode
	} from '@/app/chat-actions';

	let expandedSideChatParent: string | null = $state(null);
	let measuredNodeHeights: Record<string, number> = $state({});
	let drawingShapes: Shape[] = $state([]);
	let canvasRef: Canvas | null = $state(null);
	let deleteTargetId: string | null = $state(null);
	let deleteMode: DeleteMode = $state('exchange');
	let operationError: string | null = $state(null);

	let activeExchanges = $derived(getActiveExchanges());
	let activeExchangeId = $derived(getActiveExchangeId());
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

	function resetMeasuredHeights() {
		measuredNodeHeights = {};
	}

	function getCollapsedParentIds() {
		if (!activeExchanges) return new Set<string>();
		return new Set(
			Object.values(activeExchanges)
				.filter((exchange) => exchange.childIds.length > 1)
				.map((exchange) => exchange.id)
				.filter((id) => id !== expandedSideChatParent)
		);
	}

	function getHiddenExchangeIds() {
		if (!activeExchanges) return new SvelteSet<string>();
		const hidden = new SvelteSet<string>();
		for (const parentId of collapsedParentIds) {
			const children = getChildExchanges(activeExchanges, parentId);
			for (let index = 1; index < children.length; index += 1) {
				const sideRootId = children[index]?.id;
				if (!sideRootId) continue;
				hidden.add(sideRootId);
				const tree: ChatTree = { rootId: getActiveChat().rootId, exchanges: activeExchanges };
				for (const descendantId of getDescendantExchanges(tree, sideRootId)) {
					hidden.add(descendantId);
				}
			}
		}
		return hidden;
	}

	function setMeasuredNodeHeight(exchangeId: string, height: number) {
		const roundedHeight = Math.ceil(height);
		if (!Number.isFinite(roundedHeight) || roundedHeight <= 0) return;
		if (measuredNodeHeights[exchangeId] === roundedHeight) return;
		measuredNodeHeights = { ...measuredNodeHeights, [exchangeId]: roundedHeight };
	}

	function copyChat(exchangeId: string) {
		if (!activeExchanges) return;
		performCopy(exchangeId);
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

	export function expandSideChat(exchangeId: string) {
		expandedSideChatParent = exchangeId;
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
		deleteMode = getDeleteMode(activeExchanges, exchangeId);
	}

	function confirmDelete() {
		if (!activeExchanges || !deleteTargetId) return;
		const result = performDelete(
			activeExchanges,
			deleteTargetId,
			deleteMode,
			activeExchangeId,
			resetMeasuredHeights
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
		const result = performPromote(activeExchanges, exchangeId, resetMeasuredHeights);
		if (result.error) {
			operationError = result.error;
		} else {
			operationError = null;
		}
	}

	function getExchangeNodeData(exchangeId: string) {
		if (!activeExchanges) return null;
		return getNodeData(exchangeId, activeExchanges, activeExchangeId, {
			onMeasure: setMeasuredNodeHeight,
			onSelect: (id) => setActiveExchangeId(id),
			onCopy: copyChat,
			onToggleSideChildren: toggleSideChildren,
			onPromote: promoteExchange,
			onDelete: openDeleteDialog
		});
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
				<Document
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
	{@const children = activeExchanges ? getChildExchanges(activeExchanges, deleteTargetId) : []}
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
