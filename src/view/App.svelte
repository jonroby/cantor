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

	function deduplicate(name: string, existing: string[]): string {
		if (!existing.includes(name)) return name;
		let i = 2;
		while (existing.includes(`${name} (${i})`)) i++;
		return `${name} (${i})`;
	}

	function fixDuplicateNames(chats: app.chat.Chat[], folders: app.runtime.ChatFolder[]) {
		const chatNames: string[] = [];
		for (const chat of chats) {
			const deduped = deduplicate(chat.name, chatNames);
			if (deduped !== chat.name) chat.name = deduped;
			chatNames.push(deduped);
		}

		const folderNames: string[] = [];
		for (const folder of folders) {
			const deduped = deduplicate(folder.name, folderNames);
			if (deduped !== folder.name) folder.name = deduped;
			folderNames.push(deduped);

			const fileNames: string[] = [];
			for (const file of folder.files ?? []) {
				const dedupedFile = deduplicate(file.name, fileNames);
				if (dedupedFile !== file.name) file.name = dedupedFile;
				fileNames.push(dedupedFile);
			}
		}
	}

	let searchQuery = $state('');
	let searchAllChats = $state(true);
	let searchOpen = $state(false);
	let hasHydrated = $state(false);

	let canvasViewRef: ReturnType<typeof CanvasView> | null = $state(null);
	let chatViewRef: ReturnType<typeof ChatView> | null = $state(null);

	let searchItems = $derived(
		searchQuery.trim()
			? app.search.searchChats(
					app.runtime.chatState.chats,
					searchQuery.trim(),
					searchAllChats
						? app.runtime.chatState.chats.map((_: app.chat.Chat, index: number) => index)
						: [app.runtime.chatState.activeChatIndex]
				)
			: app.search.getDefaultItems(
					app.runtime.chatState.chats,
					app.runtime.chatState.activeChatIndex,
					searchAllChats
				)
	);

	$effect(() => {
		if (hasHydrated) {
			app.runtime.saveToStorage();
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

		try {
			app.runtime.loadFromStorage();
		} catch {
			fixDuplicateNames(app.runtime.chatState.chats, app.runtime.docState.folders);
			toast.warning('Some items had duplicate names and were automatically renamed.');
		}
		const restoredDocument = app.documents.restoreOpenDocument();
		if (restoredDocument) {
			chatViewRef?.showDocument(restoredDocument.folderId, restoredDocument.fileId);
		}
		app.providers.init();
		app.providers.autoConnectOllama();

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
		const index = app.runtime.newChat();
		resetUIState();
		return index;
	}

	function selectChat(index: number) {
		app.runtime.selectChat(index);
		resetUIState();
	}

	function doDeleteChat(index: number) {
		const chat = app.runtime.chatState.chats[index];
		if (chat) app.runtime.cancelStreamsForChat(chat.id);
		app.runtime.deleteChat(index);
		resetUIState();
	}

	function addDocToChat(folderId: string, fileId: string) {
		const folder = app.runtime.docState.folders.find((f) => f.id === folderId);
		const file = folder?.files?.find((f) => f.id === fileId);
		if (!file) return;
		app.documents.performAddFolderDocumentToChat(folderId, fileId);
	}

	function handleSearchSelect(result: app.search.SearchResult) {
		app.runtime.selectChat(result.chatIndex);
		app.runtime.setActiveExchangeId(result.exchangeId);
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
			chats={app.runtime.chatState.chats}
			activeChatIndex={app.runtime.chatState.activeChatIndex}
			onSelectChat={selectChat}
			onNewChat={newChat}
			onDeleteChat={doDeleteChat}
			onRenameChat={app.runtime.renameChat}
			onDownloadChat={app.files.downloadChat}
			onUploadChat={() => app.files.uploadChat(fileFeedback)}
			folders={app.runtime.docState.folders}
			onNewFolder={app.runtime.newFolder}
			onDeleteFolder={app.runtime.deleteFolder}
			onDownloadFolder={(folderId) => app.files.downloadFolder(folderId, fileFeedback)}
			onRenameFolder={app.runtime.renameFolder}
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
			onDeleteDoc={app.runtime.deleteDocFromFolder}
			onRenameDoc={app.runtime.renameDocInFolder}
			onMoveDoc={app.runtime.moveDocToFolder}
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
