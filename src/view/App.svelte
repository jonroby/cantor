<script lang="ts">
	import { tick } from 'svelte';
	import { onMount } from 'svelte';
	import { Toaster } from '@/view/components/shadcn/ui/sonner';
	import { toast } from 'svelte-sonner';
	import * as SidebarPrimitive from '@/view/components/shadcn/ui/sidebar';
	import { AppSidebar, SearchDialog, Composer } from '@/view/shared';
	import { LandingPage, routerState } from '@/view/routes';
	import { ChatView, DocumentView } from '@/view/classic';
	import * as app from '@/app';

	type PanelEntry = { type: 'chat' } | { type: 'document'; folderId: string; fileId: string };

	let searchQuery = $state('');
	let searchAllChats = $state(true);
	let searchOpen = $state(false);
	let hasHydrated = $state(false);
	let panels: PanelEntry[] = $state([{ type: 'chat' }]);

	let chatViewRef: ReturnType<typeof ChatView> | null = $state(null);
	let composerRef: ReturnType<typeof Composer> | undefined = $state();

	let hasChatPanel = $derived(panels.some((p) => p.type === 'chat'));
	let chatPanelIndex = $derived(panels.findIndex((p) => p.type === 'chat'));
	let isSplit = $derived(panels.length === 2);

	$effect(() => {
		if (hasHydrated) {
			app.bootstrap.save();
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

		const { restoredDocument, hadDuplicateRenames } = app.bootstrap.initialize();
		if (hadDuplicateRenames) {
			toast.warning('Some items had duplicate names and were automatically renamed.');
		}
		if (restoredDocument) {
			openDocumentPanel(restoredDocument.folderId, restoredDocument.fileId);
		}

		hasHydrated = true;

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

	function openDocumentPanel(folderId: string, fileId: string) {
		const existingIndex = panels.findIndex(
			(p) => p.type === 'document' && p.folderId === folderId && p.fileId === fileId
		);
		if (existingIndex >= 0) return;

		const docPanel: PanelEntry = { type: 'document', folderId, fileId };

		if (panels.length === 0) {
			panels = [docPanel];
		} else if (panels.length === 1) {
			panels = [...panels, docPanel];
		} else {
			// Replace the second panel
			panels = [panels[0], docPanel];
		}
	}

	function closePanel(index: number) {
		panels = panels.filter((_, i) => i !== index);
	}

	function ensureChatPanel() {
		if (!hasChatPanel) {
			if (panels.length === 0) {
				panels = [{ type: 'chat' }];
			} else if (panels.length === 1) {
				panels = [{ type: 'chat' }, panels[0]];
			} else {
				panels = [{ type: 'chat' }, panels[1]];
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
		const folder = app.documents.getState().folders.find((f) => f.id === folderId);
		const file = folder?.files?.find((f) => f.id === fileId);
		if (!file) return;
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
	<SidebarPrimitive.Provider>
		<AppSidebar
			chats={app.chat.getChats()}
			activeChatIndex={app.chat.getActiveChatIndex()}
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
					app.bootstrap.rememberOpenDocument(document.folderId, document.fileId);
					openDocumentPanel(document.folderId, document.fileId);
				}
			}}
			onUploadDocument={(folderId) => app.documents.importDocument(folderId, fileFeedback)}
			onUploadFolder={(folderId) => app.documents.importFolderIntoFolder(folderId, fileFeedback)}
			onUploadNewFolder={() => app.documents.importFolder(fileFeedback)}
			onSelectDocument={(folderId, fileId) => {
				if (app.documents.openDocument(folderId, fileId)) {
					app.bootstrap.rememberOpenDocument(folderId, fileId);
					openDocumentPanel(folderId, fileId);
				}
			}}
			onAddDocumentToChat={addDocumentToChat}
			onDeleteDocument={app.documents.deleteDocument}
			onRenameDocument={app.documents.renameDocument}
			onMoveDocument={app.documents.moveDocument}
		/>
		<SidebarPrimitive.Inset>
			<div class="app-shell">
				<div class="panel-layout" class:panel-layout-split={isSplit}>
					{#each panels as panel, index (panel.type === 'document' ? `doc-${panel.folderId}-${panel.fileId}` : 'chat')}
						<div class="panel-slot">
							{#if panel.type === 'chat'}
								<ChatView
									bind:this={chatViewRef}
									onClose={() => closePanel(index)}
									onFocusComposer={focusComposer}
								/>
							{:else if panel.type === 'document'}
								<DocumentView
									folderId={panel.folderId}
									fileId={panel.fileId}
									onClose={() => closePanel(index)}
								/>
							{/if}
						</div>
					{/each}
				</div>

				<div
					class="composer-anchor"
					class:composer-left={isSplit && chatPanelIndex === 0}
					class:composer-right={isSplit && chatPanelIndex === 1}
				>
					<Composer
						bind:this={composerRef}
						onScrollToNode={(nodeId) => chatViewRef?.scrollToNode(nodeId)}
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
	}

	.panel-layout-split .panel-slot:first-child {
		border-right: 1px solid hsl(var(--border));
	}

	.composer-anchor {
		position: absolute;
		bottom: 1rem;
		left: 0;
		right: 0;
		z-index: 25;
		padding: 0 1rem;
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
