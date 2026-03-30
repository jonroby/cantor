<script lang="ts">
	import { tick } from 'svelte';
	import { onMount } from 'svelte';
	import { Toaster } from '@/view/components/shadcn/ui/sonner';
	import { toast } from 'svelte-sonner';
	import * as SidebarPrimitive from '@/view/components/shadcn/ui/sidebar';
	import { AppSidebar, SearchDialog } from '@/view/shared';
	import { LandingPage, routerState } from '@/view/routes';
	import { ChatView } from '@/view/classic';
	import * as app from '@/app';

	let searchQuery = $state('');
	let searchAllChats = $state(true);
	let searchOpen = $state(false);
	let hasHydrated = $state(false);

	let chatViewRef: ReturnType<typeof ChatView> | null = $state(null);

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
			chatViewRef?.showDocument(restoredDocument.folderId, restoredDocument.fileId);
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

	function newChat(): number {
		const index = app.chat.createChat();
		resetUIState();
		return index;
	}

	function selectChat(index: number) {
		app.chat.selectChat(index);
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
					chatViewRef?.showDocument(document.folderId, document.fileId);
				}
			}}
			onUploadDocument={(folderId) => app.documents.importDocument(folderId, fileFeedback)}
			onUploadFolder={(folderId) => app.documents.importFolderIntoFolder(folderId, fileFeedback)}
			onUploadNewFolder={() => app.documents.importFolder(fileFeedback)}
			onSelectDocument={(folderId, fileId) => {
				if (app.documents.openDocument(folderId, fileId)) {
					app.bootstrap.rememberOpenDocument(folderId, fileId);
					chatViewRef?.showDocument(folderId, fileId);
				}
			}}
			onAddDocumentToChat={addDocumentToChat}
			onDeleteDocument={app.documents.deleteDocument}
			onRenameDocument={app.documents.renameDocument}
			onMoveDocument={app.documents.moveDocument}
		/>
		<SidebarPrimitive.Inset>
			<ChatView bind:this={chatViewRef} />

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
