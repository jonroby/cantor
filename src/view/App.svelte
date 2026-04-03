<script lang="ts">
	import { tick } from 'svelte';
	import { onMount } from 'svelte';
	import { Toaster } from '@/view/components/shadcn/ui/sonner';
	import { toast } from 'svelte-sonner';
	import * as SidebarPrimitive from '@/view/components/shadcn/ui/sidebar';
	import { AppSidebar, SearchDialog, Composer } from '@/view/shared';
	import { LandingPage, routerState } from '@/view/routes';
	import { ChatView, DocumentView, FolderDocumentView } from '@/view/index';
	import { ArrowDown } from 'lucide-svelte';
	import * as app from '@/app';

	type PanelEntry =
		| { type: 'chat' }
		| { type: 'document'; folderId: string; fileId: string }
		| { type: 'folder'; folderId: string };

	let searchQuery = $state('');
	let searchAllChats = $state(true);
	let searchOpen = $state(false);
	let hasHydrated = $state(false);

	let chatViewRef: ReturnType<typeof ChatView> | null = $state(null);
	let composerRef: ReturnType<typeof Composer> | undefined = $state();
	let chatSidePanelOpen = $state(false);
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
	let agentMode = $derived(app.chat.getMode() === 'agent');
	let activeDocSide = $state<'left' | 'right'>('left');
	let _chatPanelIsFirst = $derived(workspaceState.panels[0]?.type === 'chat');
	let sideChatSide = $state<'left' | 'right'>('left');
	let composerSide = $derived.by(() => {
		if (chatSidePanelOpen) return sideChatSide;
		if (!isSplit) return null;
		// TODO: allow moving composer to right panel
		return 'left';
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
			window.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('dragover', handleWindowDragOver);
			window.removeEventListener('drop', handleWindowDrop);
		};
	});

	function resetUIState() {
		chatViewRef?.resetUIState();
	}

	function focusComposer() {
		composerRef?.focus();
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
			chatSidePanelOpen = false;
			const chats = app.chat.getChats();
			const activeIndex = app.chat.getActiveChatIndex();
			if (chats.length > 1) {
				const nextIndex = activeIndex > 0 ? activeIndex - 1 : 1;
				app.chat.selectChat(nextIndex);
			}
			resetUIState();
			return;
		}
		const documentKey = getPanelDocumentKey(panel);
		if (documentKey) {
			app.documents.closeOpenDocument(documentKey.folderId, documentKey.fileId);
			app.workspace.clearOpenDocument();
		}
		app.workspace.setPanels(workspaceState.panels.filter((_, i) => i !== index));
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
		/>
		<SidebarPrimitive.Inset>
			<div class="app-shell">
				<div class="panel-layout" class:panel-layout-split={isSplit}>
					{#each workspaceState.panels as panel, index (panel.type === 'document' ? `doc-${panel.folderId}-${panel.fileId}` : panel.type === 'folder' ? `folder-${panel.folderId}` : 'chat')}
						<div class="panel-slot">
							{#if panel.type === 'chat'}
								<ChatView
									bind:this={chatViewRef}
									onFocusComposer={focusComposer}
									onSidePanelChange={(open) => {
										chatSidePanelOpen = open;
										if (!open) sideChatSide = 'left';
									}}
									onScrollAwayChange={(away) => (chatScrolledAway = away)}
								/>
							{:else if panel.type === 'document'}
								<DocumentView
									folderId={panel.folderId}
									fileId={panel.fileId}
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
				<div
					class="composer-anchor"
					class:composer-left={composerSide === 'left'}
					class:composer-right={composerSide === 'right'}
				>
					{#if hasChatPanel && chatScrolledAway}
						<button
							class="scroll-to-bottom-btn"
							onclick={() => chatViewRef?.scrollToBottom()}
							aria-label="Scroll to bottom"
						>
							<ArrowDown size={18} />
						</button>
					{/if}
					<Composer
						bind:this={composerRef}
						{agentMode}
						onToggleMode={() => app.chat.setMode(agentMode ? 'chat' : 'agent')}
						liveDocumentContent={activeDocumentFile?.content}
						{activeDocumentKey}
						toolCallbacks={{
							onOpenDocument: openDocumentInWorkspace,
							onOpenFolder: openFolderPanel,
							onClosePanel: closePanel,
							onToggleSidebar: app.workspace.toggleSidebar
						}}
						onScrollToNode={(nodeId) => {
							ensureChatPanel();
							tick().then(() => chatViewRef?.scrollToNode(nodeId));
						}}
						onExpandSideChat={(exchangeId) => chatViewRef?.expandSideChat(exchangeId)}
					/>
				</div>
			</div>

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
		overflow: hidden;
		min-width: 0;
		transition: flex 250ms ease;
	}

	.panel-layout-split .panel-slot:first-child {
		border-right: 1px solid hsl(var(--border));
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
		font-size: 28px;
		font-weight: 500;
		font-feature-settings: normal;
		color: hsl(var(--foreground));
	}

	.composer-anchor {
		position: absolute;
		bottom: 1rem;
		left: 0;
		right: 0;
		z-index: 25;
		padding: 0 1rem;
		transition:
			left 250ms ease,
			right 250ms ease;
	}

	.composer-anchor :global(.composer) {
		position: relative;
		left: auto;
		bottom: auto;
		transform: none;
		width: 100% !important;
		max-width: 720px !important;
		margin: 0 auto;
		box-sizing: border-box;
	}

	.composer-left {
		right: 50%;
	}

	.composer-right {
		left: 50%;
	}
</style>
