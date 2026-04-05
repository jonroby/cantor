<script lang="ts">
	import { tick } from 'svelte';
	import { onMount } from 'svelte';
	import { Toaster } from '@/view/primitives/sonner';
	import { toast } from 'svelte-sonner';
	import * as SidebarPrimitive from '@/view/primitives/sidebar';
	import { AppSidebar } from '@/view/components/sidebar';
	import { SearchDialog } from '@/view/components/search';
	import { Composer } from '@/view/components/composer';
	import { LandingPage } from '@/view/components/landing';
	import { CanvasView } from '@/view/components/canvas-view';
	import { navigate, routerState } from '@/view/routes/router.svelte';
	import { ChatView } from '@/view/components/chat-view';
	import { preloadPlotly } from '@/view/components/document';
	import { DocumentView } from '@/view/components/document-view';
	import { FolderDocumentView } from '@/view/components/folder-document-view';
	import ComposerAnchor from './ComposerAnchor.svelte';
	import * as app from '@/app';

	type PanelEntry =
		| { type: 'chat' }
		| { type: 'side-chat'; parentExchangeId: string; sideChatIndex: number }
		| { type: 'document'; folderId: string; fileId: string }
		| { type: 'folder'; folderId: string };

	let searchQuery = $state('');
	let searchAllChats = $state(true);
	let searchOpen = $state(false);
	let hasHydrated = $state(false);

	let chatViewRef: ReturnType<typeof ChatView> | null = $state(null);
	let sideChatViewRef: ReturnType<typeof ChatView> | null = $state(null);
	let canvasViewRef: ReturnType<typeof CanvasView> | null = $state(null);
	let composerRef: ReturnType<typeof Composer> | undefined = $state();
	let chatScrolledAway = $state(false);
	let workspaceState = $derived(app.workspace.getState());

	let providerState = $derived(app.providers.getState());
	let agentState = $derived(app.agent.getState());
	let hasModel = $derived(!!providerState.activeModel);
	let hasChatPanel = $derived(workspaceState.panels.some((p) => p.type === 'chat'));
	let _hasDocPanel = $derived(
		workspaceState.panels.some((p) => p.type === 'document' || p.type === 'folder')
	);
	let isSplit = $derived(workspaceState.panels.length === 2);
	let bothDocs = $derived(isSplit && !hasChatPanel);
	let showToc = $derived(
		workspaceState.panels.length === 1 &&
			(workspaceState.panels[0]?.type === 'document' || workspaceState.panels[0]?.type === 'folder')
	);
	let agentMode = $derived(app.chat.getMode() === 'agent');
	let activeDocSide = $state<'left' | 'right'>('left');
	let _chatPanelIsFirst = $derived(workspaceState.panels[0]?.type === 'chat');
	let composerPinned = $state<'left' | 'right' | null>(null);
	let composerSide = $derived.by(() => {
		if (!isSplit) return null;
		return composerPinned ?? 'left';
	});

	$effect(() => {
		const hasSideChat = workspaceState.panels.some((p) => p.type === 'side-chat');
		if (hasSideChat && composerPinned !== 'right') {
			composerPinned = 'right';
		} else if (!hasSideChat && composerPinned === 'right') {
			composerPinned = null;
		}
	});
	let activeViewRef = $derived.by(() => {
		if (routerState.route === 'canvas') return canvasViewRef;
		if (!composerSide) return chatViewRef;
		const panelOnComposerSide = workspaceState.panels[composerSide === 'left' ? 0 : 1];
		if (panelOnComposerSide?.type === 'side-chat') return sideChatViewRef;
		return chatViewRef;
	});

	// Sync activeExchangeId to the tail of whichever panel the composer is on
	$effect(() => {
		const panelIndex = composerSide === 'right' ? 1 : 0;
		const panel = workspaceState.panels[panelIndex];
		if (!panel) return;
		if (panel.type === 'side-chat') {
			const activeTree = {
				rootId: app.chat.getChat().rootId,
				exchanges: app.chat.getChat().exchanges
			};
			const sideChats = app.chat.getSideChats(activeTree, panel.parentExchangeId);
			const currentChat = sideChats[panel.sideChatIndex];
			const tail = currentChat?.at(-1)?.id ?? panel.parentExchangeId;
			app.chat.selectExchange(tail);
		} else if (panel.type === 'chat') {
			const activeTree = {
				rootId: app.chat.getChat().rootId,
				exchanges: app.chat.getChat().exchanges
			};
			const main = app.chat.getMainChat(activeTree);
			const tail = main.at(-1)?.id;
			if (tail) app.chat.selectExchange(tail);
		}
	});
	let activeDocumentKey = $derived.by(() => {
		const targetIndex = bothDocs ? (activeDocSide === 'left' ? 0 : 1) : -1;

		function keyFromPanel(p: PanelEntry) {
			if (p.type === 'document') return { folderId: p.folderId, fileId: p.fileId };
			if (p.type === 'folder') {
				const folder = app.documents.getState().folders.find((f) => f.id === p.folderId);
				const selectedFileId = workspaceState.selectedFileIdsByFolderId[p.folderId];
				const fileId = selectedFileId ?? folder?.files?.[0]?.id;
				if (fileId) return { folderId: p.folderId, fileId };
			}
			return null;
		}

		if (targetIndex >= 0 && workspaceState.panels[targetIndex]) {
			return keyFromPanel(workspaceState.panels[targetIndex]);
		}

		for (const p of workspaceState.panels) {
			const key = keyFromPanel(p);
			if (key) return key;
		}
		return null;
	});
	let activeDocumentFile = $derived.by(() => {
		if (!activeDocumentKey) return null;
		const folder = app.documents
			.getState()
			.folders.find((f) => f.id === activeDocumentKey.folderId);
		return folder?.files?.find((f) => f.id === activeDocumentKey.fileId) ?? null;
	});

	$effect(() => {
		if (hasHydrated) {
			void app.bootstrap.save();
		}
	});

	onMount(() => {
		const warmPlotly = () => void preloadPlotly();
		const supportsIdleCallback = typeof window.requestIdleCallback === 'function';
		const idleCallback = supportsIdleCallback
			? window.requestIdleCallback(warmPlotly, { timeout: 2000 })
			: window.setTimeout(warmPlotly, 1500);

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

		void app.bootstrap.initialize().then(({ hadDuplicateRenames }) => {
			if (hadDuplicateRenames) {
				toast.warning('Some items had duplicate names and were automatically renamed.');
			}

			hasHydrated = true;
			tick().then(() => chatViewRef?.scrollToBottom());
		});

		return () => {
			if (supportsIdleCallback) {
				window.cancelIdleCallback(idleCallback);
			} else {
				window.clearTimeout(idleCallback);
			}
			window.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('dragover', handleWindowDragOver);
			window.removeEventListener('drop', handleWindowDrop);
		};
	});

	function resetUIState() {
		canvasViewRef?.resetUIState?.();
		chatViewRef?.resetUIState();
	}

	function focusComposer() {
		composerRef?.focus();
	}

	function scrollCurrentViewDown() {
		if (routerState.route === 'canvas') {
			canvasViewRef?.scrollToTop?.();
			return;
		}
		if (!composerSide) {
			chatViewRef?.scrollToBottom();
			return;
		}
		const panelOnComposerSide = workspaceState.panels[composerSide === 'left' ? 0 : 1];
		if (panelOnComposerSide?.type === 'side-chat') {
			sideChatViewRef?.scrollToBottom();
			return;
		}
		chatViewRef?.scrollToBottom();
	}

	function getPanelDocumentKey(panel: PanelEntry) {
		if (panel.type === 'document') {
			return { folderId: panel.folderId, fileId: panel.fileId };
		}
		if (panel.type === 'folder') {
			const folder = app.documents.getFolder(panel.folderId);
			const selectedFileId =
				workspaceState.selectedFileIdsByFolderId[panel.folderId] ?? folder?.files?.[0]?.id;
			if (selectedFileId) {
				return { folderId: panel.folderId, fileId: selectedFileId };
			}
		}
		return null;
	}

	function openDocumentPanel(folderId: string, fileId: string) {
		const panels = workspaceState.panels;
		const existingIndex = panels.findIndex(
			(p) => p.type === 'document' && p.folderId === folderId && p.fileId === fileId
		);
		if (existingIndex >= 0) return;

		const documentPanel: PanelEntry = { type: 'document', folderId, fileId };

		if (panels.length === 0) {
			app.workspace.setPanels([documentPanel]);
		} else if (panels.length === 1) {
			app.workspace.setPanels([...panels, documentPanel]);
		} else {
			app.workspace.setPanels([panels[0]!, documentPanel]);
		}
	}

	function openDocumentInWorkspace(folderId: string, fileId: string) {
		if (!app.documents.openDocument(folderId, fileId)) return;
		openDocumentPanel(folderId, fileId);
	}

	function openFolderPanel(folderId: string) {
		const panels = workspaceState.panels;
		const existingIndex = panels.findIndex((p) => p.type === 'folder' && p.folderId === folderId);
		if (existingIndex >= 0) return;

		const folder = app.documents.getState().folders.find((f) => f.id === folderId);
		if (!folder || !folder.files?.length) return;

		const selectedFileId =
			workspaceState.selectedFileIdsByFolderId[folderId] ?? folder.files[0]!.id;
		app.workspace.selectFolderFile(folderId, selectedFileId);
		app.documents.openDocument(folderId, selectedFileId);

		const folderPanel: PanelEntry = { type: 'folder', folderId };

		if (panels.length === 0) {
			app.workspace.setPanels([folderPanel]);
		} else if (panels.length === 1) {
			app.workspace.setPanels([...panels, folderPanel]);
		} else {
			app.workspace.setPanels([panels[0]!, folderPanel]);
		}
	}

	function swapPanels() {
		if (workspaceState.panels.length === 2) {
			app.workspace.setPanels([workspaceState.panels[1]!, workspaceState.panels[0]!]);
		}
	}

	function closePanel(index: number) {
		const panel = workspaceState.panels[index];
		if (!panel) return;
		if (panel.type === 'chat') {
			resetUIState();
		} else {
			const documentKey = getPanelDocumentKey(panel);
			if (documentKey) {
				app.documents.closeOpenDocument(documentKey.folderId, documentKey.fileId);
				app.workspace.clearOpenDocument();
			}
		}
		const remaining = workspaceState.panels.filter((_, i) => i !== index);
		const filtered =
			panel.type === 'chat' ? remaining.filter((p) => p.type !== 'side-chat') : remaining;
		app.workspace.setPanels(filtered);
	}

	function ensureChatPanel() {
		const panels = workspaceState.panels;
		if (!hasChatPanel) {
			if (panels.length === 0) {
				app.workspace.setPanels([{ type: 'chat' }]);
			} else if (panels.length === 1) {
				app.workspace.setPanels([{ type: 'chat' }, panels[0]!]);
			} else {
				app.workspace.setPanels([{ type: 'chat' }, panels[1]!]);
			}
		}
	}

	function newChat(): number {
		const index = app.chat.createChat();
		ensureChatPanel();
		resetUIState();
		return index;
	}

	function selectChat(index: number) {
		app.chat.selectChat(index);
		ensureChatPanel();
		resetUIState();
	}

	function doDeleteChat(index: number) {
		const chat = app.chat.getChats()[index];
		if (chat) app.chat.stopChatStreams(chat.id);
		app.chat.removeChat(index);
		resetUIState();
	}

	function addDocumentToChat(folderId: string, fileId: string) {
		app.documents.addDocumentToChat(folderId, fileId);
	}

	async function handleSearchSelect(result: { chatIndex: number; exchangeId: string }) {
		selectChat(result.chatIndex);
		await tick();
		chatViewRef?.revealExchange(result.exchangeId);
	}

	const fileFeedback = {
		success: (message: string) => toast.success(message),
		error: (message: string) => toast.error(message)
	};
</script>

<svelte:head>
	<title>Cantor</title>
</svelte:head>

{#if routerState.route === 'landing'}
	<LandingPage />
{:else}
	<SidebarPrimitive.Provider
		bind:open={workspaceState.sidebarOpen}
		onOpenChange={(open) => app.workspace.setSidebarOpen(open)}
	>
		<AppSidebar
			bind:expandedFolders={workspaceState.expandedFolders}
			chats={app.chat.getChats()}
			activeChatIndex={hasChatPanel ? app.chat.getActiveChatIndex() : -1}
			onSelectChat={selectChat}
			onNewChat={newChat}
			onDeleteChat={doDeleteChat}
			onRenameChat={app.chat.renameChat}
			onDownloadChat={app.chat.exportChat}
			onUploadChat={() => app.chat.importChat(fileFeedback)}
			folders={app.documents.getState().folders}
			onNewFolder={app.documents.createFolder}
			onDeleteFolder={app.documents.deleteFolder}
			onDownloadFolder={(folderId) => app.documents.exportFolder(folderId, fileFeedback)}
			onRenameFolder={app.documents.renameFolder}
			onNewDocument={(folderId) => {
				const document = app.documents.createDocument(folderId);
				if (document) {
					openDocumentPanel(document.folderId, document.fileId);
				}
			}}
			onUploadDocument={(folderId) => app.documents.importDocument(folderId, fileFeedback)}
			onUploadFolder={(folderId) => app.documents.importFolderIntoFolder(folderId, fileFeedback)}
			onUploadNewFolder={() => app.documents.importFolder(fileFeedback)}
			onOpenFolder={openFolderPanel}
			onSelectDocument={openDocumentInWorkspace}
			onAddDocumentToChat={addDocumentToChat}
			onDeleteDocument={app.documents.deleteDocument}
			onRenameDocument={app.documents.renameDocument}
			onMoveDocument={app.documents.moveDocument}
			activeRoute={routerState.route}
			onNavigate={navigate}
		/>
		<SidebarPrimitive.Inset>
			{#if routerState.route === 'canvas'}
				<div class="app-shell">
					<CanvasView bind:this={canvasViewRef} onSearchOpen={() => (searchOpen = true)} />
					<ComposerAnchor
						composerSide={null}
						isSplit={false}
						{hasChatPanel}
						chatScrolledAway={false}
						{agentMode}
						{activeDocumentFile}
						{activeDocumentKey}
						bind:composerRef
						toolCallbacks={{
							onOpenDocument: openDocumentInWorkspace,
							onOpenFolder: openFolderPanel,
							onClosePanel: closePanel,
							onToggleSidebar: app.workspace.toggleSidebar
						}}
						onScrollToBottom={() => canvasViewRef?.scrollToTop?.()}
						onToggleMode={() => app.chat.setMode(agentMode ? 'chat' : 'agent')}
						onScrollToNode={(nodeId) => {
							ensureChatPanel();
							tick().then(() => activeViewRef?.scrollToNode(nodeId));
						}}
						onExpandSideChat={(exchangeId) => canvasViewRef?.expandSideChat?.(exchangeId)}
						onComposerPinChange={() => {}}
					/>
				</div>
			{:else}
				<div class="app-shell">
					<div class="panel-layout" class:panel-layout-split={isSplit}>
						{#each workspaceState.panels as panel, index (panel.type === 'document' ? `doc-${panel.folderId}-${panel.fileId}` : panel.type === 'folder' ? `folder-${panel.folderId}` : panel.type === 'side-chat' ? `side-chat-${panel.parentExchangeId}` : 'chat')}
							<div class="panel-slot">
								{#if panel.type === 'chat'}
									<ChatView
										bind:this={chatViewRef}
										onFocusComposer={focusComposer}
										onClose={() => closePanel(index)}
										onScrollAwayChange={(away) => (chatScrolledAway = away)}
									/>
								{:else if panel.type === 'side-chat'}
									{@const activeTree = {
										rootId: app.chat.getChat().rootId,
										exchanges: app.chat.getChat().exchanges
									}}
									{@const sideChats = app.chat.getSideChats(activeTree, panel.parentExchangeId)}
									<ChatView
										bind:this={sideChatViewRef}
										onFocusComposer={focusComposer}
										onClose={() => closePanel(index)}
										sideChat={{
											parentExchangeId: panel.parentExchangeId,
											sideChatIndex: panel.sideChatIndex,
											onPrev: () => {
												if (panel.sideChatIndex > 0) {
													const newIndex = panel.sideChatIndex - 1;
													app.workspace.setPanels(
														workspaceState.panels.map((p, i) =>
															i === index ? { ...p, sideChatIndex: newIndex } : p
														)
													);
													const tail = sideChats[newIndex]?.at(-1);
													if (tail) app.chat.selectExchange(tail.id);
												}
											},
											onNext: () => {
												if (panel.sideChatIndex < sideChats.length - 1) {
													const newIndex = panel.sideChatIndex + 1;
													app.workspace.setPanels(
														workspaceState.panels.map((p, i) =>
															i === index ? { ...p, sideChatIndex: newIndex } : p
														)
													);
													const tail = sideChats[newIndex]?.at(-1);
													if (tail) app.chat.selectExchange(tail.id);
												}
											},
											onNew: () => {
												if (sideChats.length > 0) {
													app.workspace.setPanels(
														workspaceState.panels.map((p, i) =>
															i === index ? { ...p, sideChatIndex: sideChats.length } : p
														)
													);
													app.chat.selectExchange(panel.parentExchangeId);
												}
											}
										}}
									/>
								{:else if panel.type === 'document'}
									<DocumentView
										folderId={panel.folderId}
										fileId={panel.fileId}
										{showToc}
										agentStreaming={false}
										agentProvider={providerState.activeModel?.provider}
										pendingContent={agentState.pendingContent}
										onAcceptPending={() => app.agent.acceptPending(activeDocumentKey)}
										onRejectPending={() => app.agent.rejectPending()}
										onSwap={isSplit ? swapPanels : undefined}
										onClose={() => closePanel(index)}
									/>
								{:else if panel.type === 'folder'}
									{@const folder = app.documents.getFolder(panel.folderId)}
									{@const folderFiles = folder?.files ?? []}
									{@const activeFileId =
										workspaceState.selectedFileIdsByFolderId[panel.folderId] ??
										folderFiles[0]?.id ??
										null}
									<FolderDocumentView
										folderId={panel.folderId}
										folderName={folder?.name ?? 'Folder'}
										{showToc}
										files={folderFiles}
										{activeFileId}
										agentStreaming={false}
										agentProvider={providerState.activeModel?.provider}
										pendingContent={agentState.pendingContent}
										onSelectFile={(fileId) => {
											app.workspace.selectFolderFile(panel.folderId, fileId);
											app.documents.openDocument(panel.folderId, fileId);
										}}
										onAcceptPending={() => app.agent.acceptPending(activeDocumentKey)}
										onRejectPending={() => app.agent.rejectPending()}
										onSwap={isSplit ? swapPanels : undefined}
										resolveAsset={(name) => app.documents.resolveAsset(panel.folderId, name)}
										onContentChange={activeFileId
											? (c) =>
													app.documents.updateOpenDocumentContent(panel.folderId, activeFileId, c)
											: undefined}
										onClose={() => closePanel(index)}
									/>
								{/if}
							</div>
						{/each}
					</div>

					{#if workspaceState.panels.length === 0}
						<div class="welcome-container">
							<span class="welcome-text">{hasModel ? 'What can I help with?' : 'Welcome!'}</span>
						</div>
					{/if}
					<ComposerAnchor
						{composerSide}
						{isSplit}
						{hasChatPanel}
						{chatScrolledAway}
						{agentMode}
						{activeDocumentFile}
						{activeDocumentKey}
						bind:composerRef
						toolCallbacks={{
							onOpenDocument: openDocumentInWorkspace,
							onOpenFolder: openFolderPanel,
							onClosePanel: closePanel,
							onToggleSidebar: app.workspace.toggleSidebar
						}}
						onScrollToBottom={scrollCurrentViewDown}
						onToggleMode={() => app.chat.setMode(agentMode ? 'chat' : 'agent')}
						onScrollToNode={(nodeId) => {
							ensureChatPanel();
							tick().then(() => activeViewRef?.scrollToNode(nodeId));
						}}
						onExpandSideChat={(exchangeId) => chatViewRef?.expandSideChat(exchangeId)}
						onComposerPinChange={(side) => (composerPinned = side)}
					/>
				</div>
			{/if}

			{#if searchOpen}
				<SearchDialog
					bind:searchQuery
					bind:searchAllChats
					chats={app.chat.getChats()}
					activeChatIndex={app.chat.getActiveChatIndex()}
					onClose={() => (searchOpen = false)}
					onSelect={handleSearchSelect}
				/>
			{/if}
		</SidebarPrimitive.Inset>
	</SidebarPrimitive.Provider>
{/if}
<Toaster position="top-center" />

<style>
	.app-shell {
		position: relative;
		display: flex;
		flex-direction: column;
		height: 100vh;
	}

	.panel-layout {
		display: flex;
		flex: 1;
		min-height: 0;
	}

	.panel-slot {
		position: relative;
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow-x: hidden;
		min-width: 0;
		font-size: var(--text-lg);
		transition: flex 250ms ease;
	}

	.panel-layout-split .panel-slot:first-child {
		border-right: 1px solid var(--border-color);
	}

	.welcome-container {
		position: absolute;
		top: 40%;
		left: 50%;
		transform: translate(-50%, -50%);
		text-align: center;
		z-index: 1;
	}

	.welcome-text {
		font-weight: var(--font-weight-medium);
		color: hsl(var(--foreground));
	}
</style>
