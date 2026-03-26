<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { toast } from 'svelte-sonner';
	import Toaster from '@/components/shadcn/ui/sonner/sonner.svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { computeCanvasLayout, NODE_WIDTH } from '@/lib/chat/layout';
	import type { CanvasNode } from '@/lib/chat/layout';
	import { getProviderForModelId } from '@/lib/chat/models';
	import Button from '@/components/custom/button.svelte';
	import ExchangeNode from '@/features/canvas/ExchangeNode.svelte';
	import CodeEditor from '@/features/canvas/CodeEditor.svelte';
	import PythonEditor from '@/features/canvas/PythonEditor.svelte';
	import Canvas from '@/features/canvas/Canvas.svelte';
	import DrawingBoard from '@/features/canvas/DrawingBoard.svelte';
	import DocsPanel from '@/features/canvas/DocsPanel.svelte';
	import type { Shape } from '@/lib/drawing/types';
	import { getDefaultItems, searchChats, type SearchResult } from '@/lib/chat/search';
	import {
		ROOT_ANCHOR_ID,
		addExchangeResult,
		buildExchangesByParentId,
		canAcceptNewChat,
		canCreateSideChats,
		canPromoteSideChatToMainChat,
		deleteExchangeWithModeResult,
		findSideChatParent,
		getChildExchanges,
		getDescendantExchanges,
		getHistory,
		getMainChatTail,
		getPathTokenTotal,
		promoteSideChatToMainChat,
		type DeleteMode,
		type Exchange,
		type ExchangeMap,
		updateExchangeResponse,
		updateExchangeTokens,
		withExplicitExchangeOrder
	} from '@/lib/chat/tree';
	import * as SidebarPrimitive from '@/components/shadcn/ui/sidebar/index.js';
	import { AppSidebar } from '@/features/app-sidebar';
	import { ModelPalette } from '@/features/model-palette';
	import { FloatingActions } from '@/features/floating-actions';
	import { SearchDialog } from '@/features/search-dialog';
	import { ChatHeader } from '@/features/chat-header';
	import { Composer } from '@/features/composer';
	import type { Chat, ChatFolder } from '@/lib/chat/tree';
	import { createDocumentState, createProviderState, createChatState } from '@/lib/state';

	const docs = createDocumentState();
	const providers = createProviderState();
	const chats = createChatState();

	const STORAGE_KEY = 'chat-tree-store-svelte';

	let activeExchangeId: string | null = $state(null);
	let streamingExchangeIds: string[] = $state([]);
	let operationError: string | null = $state(null);

	let composerValue = $state('');
	let canvasMode = $state(false);
	let searchQuery = $state('');
	let searchAllChats = $state(true);
	let searchOpen = $state(false);
	let paletteOpen = $state(false);
	let expandedSideChatParent: string | null = $state(null);
	let hasHydrated = $state(false);
	let headerVisible = $state(true);
	let headerTimer: ReturnType<typeof setTimeout> | null = null;

	function handleCanvasWheel(e: WheelEvent) {
		if (e.deltaY < 0) {
			// Scrolling up — show header
			headerVisible = true;
			if (headerTimer) clearTimeout(headerTimer);
			headerTimer = setTimeout(() => {
				headerVisible = false;
			}, 2000);
		} else if (e.deltaY > 0) {
			// Scrolling down — hide header
			if (headerTimer) clearTimeout(headerTimer);
			headerVisible = false;
		}
	}
	let deleteTargetId: string | null = $state(null);
	let deleteMode: DeleteMode = $state('exchange');
	let measuredNodeHeights: Record<string, number> = $state({});

	let drawingShapes: Shape[] = $state([]);
	let canvasRef: Canvas | null = $state(null);

	let activeExchanges = $derived(chats.roots[chats.activeRootIndex] ?? chats.roots[0]);
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
					docsPanelCount: docs.openDocs.length
				})
			: computeCanvasLayout({}, { docsPanelCount: docs.openDocs.length })
	);
	let nodeLookup = $derived(new Map(canvas.nodes.map((node) => [node.id, node])));
	let usedTokens = $derived(
		activeExchanges && activeExchangeId ? getPathTokenTotal(activeExchanges, activeExchangeId) : 0
	);
	let searchItems = $derived(
		searchQuery.trim()
			? searchChats(
					chats.roots,
					searchQuery.trim(),
					searchAllChats ? chats.roots.map((_: ExchangeMap, index: number) => index) : [chats.activeRootIndex]
				)
			: getDefaultItems(chats.roots, chats.activeRootIndex, searchAllChats)
	);
	let submitDisabledReason = $derived(
		streamingExchangeIds.length > 0
			? 'Wait for the current response to finish.'
			: !providers.activeModel
				? 'Select a model first.'
				: activeExchangeId &&
					  activeExchanges &&
					  !canAcceptNewChat(activeExchanges, activeExchangeId, exchangesByParentId)
					? 'Choose a branch tip or main-chain node to continue.'
					: null
	);

	$effect(() => {
		if (hasHydrated) {
			localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessions: chats.chats, activeSessionIndex: chats.activeChatIndex, folders: docs.folders }));
		}
	});

	$effect(() => {
		if (activeExchanges && (!activeExchangeId || !activeExchanges[activeExchangeId])) {
			activeExchangeId = getMainChatTail(activeExchanges);
		}
	});

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

	$effect(() => {
		providers.updateContextLength();
	});

	$effect(() => {
		providers.fetchOllamaContextLength();
	});

	onMount(() => {
		providers.init();

		function handleKeyDown(event: KeyboardEvent) {
			const target = event.target;
			const isEditable =
				target instanceof HTMLElement &&
				(target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

			if (isEditable) return;
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
				event.preventDefault();
				searchOpen = !searchOpen;
			}
		}

		window.addEventListener('keydown', handleKeyDown);

		function hasFiles(dt: DataTransfer | null): boolean {
			if (!dt) return false;
			return Array.from(dt.types).includes('Files');
		}

		function handleWindowDragOver(e: DragEvent) {
			if (!hasFiles(e.dataTransfer)) return;
			e.preventDefault();
			e.dataTransfer!.dropEffect = 'copy';
		}

		function handleWindowDrop(e: DragEvent) {
			if (!hasFiles(e.dataTransfer)) return;
			e.preventDefault();
		}

		window.addEventListener('dragover', handleWindowDragOver);
		window.addEventListener('drop', handleWindowDrop);

		// Auto-hide header after initial display
		headerTimer = setTimeout(() => {
			headerVisible = false;
		}, 2000);

		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			try {
				const parsed = JSON.parse(raw) as {
					sessions?: Chat[];
					activeSessionIndex?: number;
					folders?: ChatFolder[];
					roots?: ExchangeMap[];
					activeRootIndex?: number;
				};

				chats.hydrate(parsed);
				if (parsed.folders?.length) {
					docs.folders = parsed.folders;
				}
			} catch {
				// ignore invalid persisted state
			}
		}

		activeExchangeId = chats.getActiveExchangeIdAfterHydrate();
		hasHydrated = true;

		providers.autoConnectOllama();

		return () => {
			window.removeEventListener('keydown', handleKeyDown);
			if (headerTimer) clearTimeout(headerTimer);
		};
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

	function resetUIState() {
		expandedSideChatParent = null;
		measuredNodeHeights = {};
	}

	function selectRoot(index: number) {
		activeExchangeId = chats.selectRoot(index);
		resetUIState();
		scrollToNode(activeExchangeId);
	}

	function replaceActiveRoot(nextRoot: ExchangeMap) {
		measuredNodeHeights = {};
		chats.replaceActiveRoot(nextRoot);
	}

	function newChat(): number {
		const result = chats.newChat();
		activeExchangeId = result.activeExchangeId;
		resetUIState();
		return result.index;
	}

	function selectChat(index: number) {
		activeExchangeId = chats.selectChat(index);
		resetUIState();
	}

	function deleteChat(index: number) {
		const newActiveId = chats.deleteChat(index);
		if (newActiveId !== null) {
			activeExchangeId = newActiveId;
			resetUIState();
		}
	}

	function deleteFolder(folderId: string) {
		chats.chats = docs.deleteFolder(folderId, chats.chats) as Chat[];
	}

	function setMeasuredNodeHeight(exchangeId: string, height: number) {
		const roundedHeight = Math.ceil(height);
		if (!Number.isFinite(roundedHeight) || roundedHeight <= 0) return;
		if (measuredNodeHeights[exchangeId] === roundedHeight) return;

		measuredNodeHeights = {
			...measuredNodeHeights,
			[exchangeId]: roundedHeight
		};
	}

	function forkChat(exchangeId: string) {
		const sourceExchanges = activeExchanges;
		if (!sourceExchanges) return;

		const path: Exchange[] = [];
		let current: Exchange | undefined = sourceExchanges[exchangeId];
		while (current && !current.isAnchor) {
			path.unshift(current);
			current = current.parentId ? sourceExchanges[current.parentId] : undefined;
		}

		const anchorId = `__anchor_${crypto.randomUUID()}__`;
		const copiedExchanges: ExchangeMap = {
			[anchorId]: { id: anchorId, parentId: null, prompt: '', response: '', isAnchor: true }
		};
		const idMap: Record<string, string> = {};

		for (const exchange of path) {
			idMap[exchange.id] = crypto.randomUUID();
		}

		let firstCopiedId = '';
		for (const exchange of path) {
			const copiedId = idMap[exchange.id];
			if (!copiedId) continue;
			if (!firstCopiedId) firstCopiedId = copiedId;
			const copiedParentId =
				exchange.parentId && idMap[exchange.parentId] ? idMap[exchange.parentId] : anchorId;

			copiedExchanges[copiedId] = {
				id: copiedId,
				parentId: copiedParentId,
				prompt: exchange.prompt,
				response: exchange.response,
				promptTokens: exchange.promptTokens,
				responseTokens: exchange.responseTokens,
				model: exchange.model
			};
		}

		const newRoots = [...chats.roots, withExplicitExchangeOrder(copiedExchanges)];
		chats.updateActiveChat({ roots: newRoots, activeRootIndex: newRoots.length - 1 });
		activeExchangeId = firstCopiedId;
		expandedSideChatParent = null;
		scrollToNode(firstCopiedId);
	}

	function scrollToNode(nodeId: string | null) {
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

	function saveToDisk() {
		const payload = JSON.stringify({ sessions: chats.chats, activeSessionIndex: chats.activeChatIndex, folders: docs.folders }, null, 2);
		const blob = new Blob([payload], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `chat-tree-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
		link.click();
		URL.revokeObjectURL(url);
	}

	async function submitPrompt() {
		const prompt = composerValue.trim();
		if (!prompt || !activeExchanges || submitDisabledReason || !providers.activeModel) return;

		operationError = null;

		const parentId = activeExchangeId ?? getMainChatTail(activeExchanges) ?? ROOT_ANCHOR_ID;
		if (
			activeExchangeId &&
			getChildExchanges(activeExchanges, activeExchangeId, exchangesByParentId).length > 0
		) {
			expandedSideChatParent = activeExchangeId;
		}

		let created: { id: string; exchanges: import('@/lib/chat/tree').ExchangeMap };
		try {
			created = addExchangeResult(activeExchanges, parentId, prompt, '', providers.activeModel.modelId);
		} catch (error) {
			operationError = error instanceof Error ? error.message : 'Failed to create exchange.';
			return;
		}

		replaceActiveRoot(created.exchanges);
		activeExchangeId = created.id;
		streamingExchangeIds = [...streamingExchangeIds, created.id];
		composerValue = '';
		await tick();
		scrollToNode(created.id);

		// CLEANUP: Store the AbortController in component state and expose a "Stop" button in the
		// CLEANUP: Store the AbortController in component state and expose a "Stop" button in the
		// composer while streaming. Also abort on chat/root switch.
		const abortController = new AbortController();

		try {
			const history = getHistory(created.exchanges, created.id);
			const stream = providers.getProviderStream(providers.activeModel, history, abortController.signal);

			let response = '';
			for await (const chunk of stream) {
				if (chunk.type === 'delta') {
					response += chunk.delta;
					replaceActiveRoot(updateExchangeResponse(chats.roots[chats.activeRootIndex], created.id, response));
				} else {
					replaceActiveRoot(
						updateExchangeTokens(
							chats.roots[chats.activeRootIndex],
							created.id,
							chunk.promptTokens,
							chunk.responseTokens
						)
					);
				}
			}
		} catch (error) {
			replaceActiveRoot(
				updateExchangeResponse(
					chats.roots[chats.activeRootIndex],
					created.id,
					`Request failed.\n\n${error instanceof Error ? error.message : 'Unknown error.'}`
				)
			);
			operationError = error instanceof Error ? error.message : 'Request failed.';
		} finally {
			streamingExchangeIds = streamingExchangeIds.filter((id) => id !== created.id);
		}
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
			replaceActiveRoot(result.exchanges);
			if (deleteTargetId === activeExchangeId || !result.exchanges[activeExchangeId ?? '']) {
				activeExchangeId = getMainChatTail(result.exchanges);
			}
			deleteTargetId = null;
			operationError = null;
		} catch (error) {
			operationError = error instanceof Error ? error.message : 'Unable to delete exchange.';
		}
	}

	function promoteActiveExchange() {
		if (!activeExchanges || !activeExchangeId) return;
		try {
			replaceActiveRoot(promoteSideChatToMainChat(activeExchanges, activeExchangeId));
			operationError = null;
		} catch (error) {
			operationError = error instanceof Error ? error.message : 'Unable to promote exchange.';
		}
	}

	function handleSearchSelect(result: SearchResult) {
		const targetRoot = chats.roots[result.rootIndex];
		chats.updateActiveChat({ activeRootIndex: result.rootIndex });
		activeExchangeId = result.exchangeId;
		expandedSideChatParent = targetRoot ? findSideChatParent(targetRoot, result.exchangeId) : null;
		scrollToNode(result.exchangeId);
	}

	function toggleSideChildren(exchangeId: string) {
		expandedSideChatParent = expandedSideChatParent === exchangeId ? null : exchangeId;
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
				isStreaming: streamingExchangeIds.includes(exchangeId),
				canFork: true,
				hasSideChildren,
				isSideRoot,
				canPromote:
					!!activeExchanges &&
					canPromoteSideChatToMainChat(activeExchanges, exchangeId, exchangesByParentId),
				onMeasure: (height: number) => setMeasuredNodeHeight(exchangeId, height),
				onSelect: () => {
					activeExchangeId = exchangeId;
				},
				onFork: () => forkChat(exchangeId),
				onToggleSideChildren: () => toggleSideChildren(exchangeId),
				onPromote: () => {
					activeExchangeId = exchangeId;
					promoteActiveExchange();
				},
				onDelete: () => openDeleteDialog(exchangeId)
			};
		} catch (error) {
			console.error(`Failed to render exchange "${exchangeId}":`, error);
			return null;
		}
	}
</script>

<svelte:head>
	<title>Superset Svelte</title>
</svelte:head>

<SidebarPrimitive.Provider>
	<AppSidebar
		chats={chats.chats}
		activeChatIndex={chats.activeChatIndex}
		onSelectChat={selectChat}
		onNewChat={newChat}
		onDeleteChat={deleteChat}
		onRenameChat={chats.renameChat}
		onDownloadChat={chats.downloadChat}
		onUploadChat={chats.uploadChat}
		folders={docs.folders}
		onNewFolder={docs.newFolder}
		onDeleteFolder={deleteFolder}
		onDownloadFolder={docs.downloadFolder}
		onRenameFolder={docs.renameFolder}
		onUploadDoc={docs.uploadDocToFolder}
		onUploadFolder={docs.uploadFolderToFolder}
		onUploadNewFolder={docs.uploadFolder}
		onSelectDoc={docs.selectDoc}
		onDeleteDoc={docs.deleteDocFromFolder}
		onRenameDoc={docs.renameDocInFolder}
		onMoveDoc={docs.moveDocToFolder}
	/>
	<SidebarPrimitive.Inset>
		<div class="page-shell" onwheel={handleCanvasWheel}>
			<ChatHeader
				visible={headerVisible}
				rootCount={chats.roots.length}
				activeRootIndex={chats.activeRootIndex}
				onSelectRoot={selectRoot}
			/>

			{#if operationError}
				<div class="error-banner">{operationError}</div>
			{/if}

			<FloatingActions
				onSearch={() => (searchOpen = true)}
				onFitView={() => canvasRef?.fitView({ duration: 250, maxZoom: 1 })}
				onGoToTop={() => {
					const first = canvas.nodes[0];
					if (first && canvasRef)
						canvasRef.scrollNodeToTop(first.y, first.x + NODE_WIDTH / 2, {
							zoom: 1,
							duration: 250,
							topOffset: 60
						});
				}}
				onGoToActive={() => scrollToNode(activeExchangeId)}
				onDownload={saveToDisk}
			/>

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
						{@const doc = docs.openDocs[index]}
						{#if doc}
							{@const docFile = doc.docKey
								? docs.folders
										.find((f) => f.id === doc.docKey!.folderId)
										?.files?.find((f) => f.id === doc.docKey!.fileId)
								: null}
							<DocsPanel
								title={docFile?.name}
								content={doc.content}
								onContentChange={(c) => {
									docs.openDocs = docs.openDocs.map((d, i) => (i === index ? { ...d, content: c } : d));
									if (doc.docKey) {
										const { folderId, fileId } = doc.docKey;
										docs.folders = docs.folders.map((f) =>
											f.id === folderId
												? {
														...f,
														files: (f.files ?? []).map((d) =>
															d.id === fileId ? { ...d, content: c } : d
														)
													}
												: f
										);
									}
								}}
								onClose={() => {
									docs.openDocs = docs.openDocs.filter((_, i) => i !== index);
								}}
							/>
						{/if}
					{/snippet}
				</Canvas>
			</div>

			<Composer
				bind:composerValue
				bind:canvasMode
				{submitDisabledReason}
				activeModelId={providers.activeModel?.modelId ?? null}
				{usedTokens}
				contextLength={providers.contextLength}
				onSubmit={submitPrompt}
				onToggleCanvasMode={() => (canvasMode = !canvasMode)}
				onOpenPalette={() => (paletteOpen = true)}
			/>

			<ModelPalette
				open={paletteOpen}
				onClose={() => {
					paletteOpen = false;
				}}
				activeModel={providers.activeModel}
				onSelectModel={providers.selectModel}
				ollamaUrl={providers.ollamaUrl}
				ollamaStatus={providers.ollamaStatus}
				ollamaModels={providers.ollamaModels}
				onConnectOllama={providers.connectOllama}
				apiKeys={providers.apiKeys}
				vaultProviders={providers.vaultProviders}
				onUnlockKeys={providers.unlockKeys}
				onSaveKey={providers.saveKey}
				onForgetKey={providers.forgetKey}
				webllmStatus={providers.webllmStatus}
				webllmProgress={providers.webllmProgress}
				webllmProgressText={providers.webllmProgressText}
				webllmModels={providers.webllmModels}
				webllmError={providers.webllmError}
				webllmContextSize={providers.webllmContextSize}
				webllmContextOptions={providers.WEBLLM_CONTEXT_OPTIONS}
				onWebLLMContextSizeChange={(size) => {
					providers.webllmContextSize = size;
				}}
				onLoadWebLLMModel={providers.loadWebLLMModel}
				onDeleteWebLLMCache={providers.deleteWebLLMCache}
				onDeleteAllWebLLMCaches={providers.deleteAllWebLLMCaches}
			/>

			{#if searchOpen}
				<SearchDialog
					bind:searchQuery
					bind:searchAllChats
					{searchItems}
					onClose={() => (searchOpen = false)}
					onSelect={handleSearchSelect}
				/>
			{/if}

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
						<Button
							class="ghost-button"
							variant="ghost"
							size="sm"
							onclick={() => (deleteTargetId = null)}>Close</Button
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
		</div>
	</SidebarPrimitive.Inset>
</SidebarPrimitive.Provider>
<Toaster position="top-center" />
