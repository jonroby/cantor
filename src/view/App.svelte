<script lang="ts">
	import { onMount } from 'svelte';
	import Toaster from '@/view/components/shadcn/ui/sonner/sonner.svelte';
	import { toast } from 'svelte-sonner';
	import * as SidebarPrimitive from '@/view/components/shadcn/ui/sidebar/index.js';
	import { AppSidebar, SearchDialog } from '@/view/shared';
	import { routerState } from '@/view/routes/router.svelte';
	import { ChatView } from '@/view/classic';
	import { CanvasView } from '@/view/canvas';
	import LandingPage from '@/view/routes/LandingPage.svelte';
	import * as app from '@/app';

	let searchQuery = $state('');
	let searchAllChats = $state(true);
	let searchOpen = $state(false);
	let hasHydrated = $state(false);

	let canvasViewRef: ReturnType<typeof CanvasView> | null = $state(null);
	let chatViewRef: ReturnType<typeof ChatView> | null = $state(null);

	let searchItems = $derived(
		searchQuery.trim()
			? app.search.searchChats(
					app.chat.getChats(),
					searchQuery.trim(),
					searchAllChats
						? app.chat.getChats().map((_: app.chat.Chat, index: number) => index)
						: [app.chat.getActiveChatIndex()]
				)
			: app.search.getDefaultItems(
					app.chat.getChats(),
					app.chat.getActiveChatIndex(),
					searchAllChats
				)
	);

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
		};
	});

	function resetUIState() {
		canvasViewRef?.resetUIState();
		chatViewRef?.resetUIState();
	}

	function newChat(): number {
		const index = app.chat.newChat();
		resetUIState();
		return index;
	}

	function selectChat(index: number) {
		app.chat.selectChat(index);
		resetUIState();
	}

	function doDeleteChat(index: number) {
		const chat = app.chat.getChats()[index];
		if (chat) app.chat.cancelStreamsForChat(chat.id);
		app.chat.deleteChat(index);
		resetUIState();
	}

	function addDocToChat(folderId: string, fileId: string) {
		const folder = app.documents.getFolders().find((f) => f.id === folderId);
		const file = folder?.files?.find((f) => f.id === fileId);
		if (!file) return;
		app.documents.performAddFolderDocumentToChat(folderId, fileId);
	}

	function handleSearchSelect(result: app.search.SearchResult) {
		app.chat.selectChat(result.chatIndex);
		app.chat.setActiveExchangeId(result.exchangeId);
		canvasViewRef?.scrollToNode(result.exchangeId);
	}

	const fileFeedback: app.files.FileCommandFeedback = {
		success: (message) => toast.success(message),
		error: (message) => toast.error(message)
	};
</script>

<svelte:head>
	<title>Superset Svelte</title>
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
			onDownloadChat={app.files.downloadChat}
			onUploadChat={() => app.files.uploadChat(fileFeedback)}
			folders={app.documents.getFolders()}
			onNewFolder={app.documents.newFolder}
			onDeleteFolder={app.documents.deleteFolder}
			onDownloadFolder={(folderId) => app.files.downloadFolder(folderId, fileFeedback)}
			onRenameFolder={app.documents.renameFolder}
			onNewDoc={(folderId) => {
				const document = app.documents.performCreateDocument(folderId);
				if (document) {
					chatViewRef?.showDocument(document.folderId, document.fileId);
				}
			}}
			onUploadDoc={(folderId) => app.files.uploadDocToFolder(folderId, fileFeedback)}
			onUploadFolder={(folderId) => app.files.uploadFolderToFolder(folderId, fileFeedback)}
			onUploadNewFolder={() => app.files.uploadFolder(fileFeedback)}
			onSelectDoc={(folderId, fileId) => {
				if (app.documents.performOpenDocument(folderId, fileId)) {
					chatViewRef?.showDocument(folderId, fileId);
				}
			}}
			onAddDocToChat={addDocToChat}
			onDeleteDoc={app.documents.deleteDocFromFolder}
			onRenameDoc={app.documents.renameDocInFolder}
			onMoveDoc={app.documents.moveDocToFolder}
		/>
		<SidebarPrimitive.Inset>
			{#if routerState.route === 'canvas'}
				<CanvasView bind:this={canvasViewRef} onSearchOpen={() => (searchOpen = true)} />
			{:else}
				<ChatView bind:this={chatViewRef} />
			{/if}

			{#if searchOpen}
				<SearchDialog
					bind:searchQuery
					bind:searchAllChats
					{searchItems}
					onClose={() => (searchOpen = false)}
					onSelect={handleSearchSelect}
				/>
			{/if}
		</SidebarPrimitive.Inset>
	</SidebarPrimitive.Provider>
{/if}
<Toaster position="top-center" />
