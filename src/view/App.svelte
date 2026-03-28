<script lang="ts">
	import { onMount } from 'svelte';
	import Toaster from '@/view/components/shadcn/ui/sonner/sonner.svelte';
	import { toast } from 'svelte-sonner';
	import { getDefaultItems, searchChats, type SearchResult } from '@/domain/search';
	import type { Chat } from '@/domain/tree';
	import * as SidebarPrimitive from '@/view/components/shadcn/ui/sidebar/index.js';
	import { AppSidebar, SearchDialog } from '@/view/shared';
	import { routerState } from '@/view/routes/router.svelte';
	import { ChatView } from '@/view/classic';
	import { CanvasView } from '@/view/canvas';
	import LandingPage from '@/view/routes/LandingPage.svelte';
	import {
		chatState,
		newChat as newChatAction,
		selectChat as selectChatAction,
		deleteChat as deleteChatAction,
		renameChat,
		setActiveExchangeId
	} from '@/state/chats.svelte';
	import {
		docState,
		newFolder,
		deleteFolder,
		renameFolder,
		deleteDocFromFolder,
		renameDocInFolder,
		moveDocToFolder
	} from '@/state/documents.svelte';
	import { loadFromStorage, saveToStorage } from '@/state/services/database.svelte';
	import type { ChatFolder } from '@/state/documents.svelte';
	import {
		downloadChat,
		uploadChat,
		downloadFolder,
		uploadDocToFolder,
		uploadFolder,
		uploadFolderToFolder
	} from '@/state/services/io.svelte';
	import { init as initProviders, autoConnectOllama } from '@/app/providers';
	import { cancelStreamsForChat } from '@/state/services/streams';
	import {
		performAddFolderDocumentToChat,
		performCreateDocument,
		performOpenDocument,
		restoreOpenDocument
	} from '@/app/documents';

	function deduplicate(name: string, existing: string[]): string {
		if (!existing.includes(name)) return name;
		let i = 2;
		while (existing.includes(`${name} (${i})`)) i++;
		return `${name} (${i})`;
	}

	function fixDuplicateNames(chats: Chat[], folders: ChatFolder[]) {
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
			? searchChats(
					chatState.chats,
					searchQuery.trim(),
					searchAllChats
						? chatState.chats.map((_: Chat, index: number) => index)
						: [chatState.activeChatIndex]
				)
			: getDefaultItems(chatState.chats, chatState.activeChatIndex, searchAllChats)
	);

	$effect(() => {
		if (hasHydrated) {
			saveToStorage();
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
			loadFromStorage();
		} catch {
			fixDuplicateNames(chatState.chats, docState.folders);
			toast.warning('Some items had duplicate names and were automatically renamed.');
		}
		const restoredDocument = restoreOpenDocument();
		if (restoredDocument) {
			chatViewRef?.showDocument(restoredDocument.folderId, restoredDocument.fileId);
		}
		initProviders();
		autoConnectOllama();

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
		const index = newChatAction();
		resetUIState();
		return index;
	}

	function selectChat(index: number) {
		selectChatAction(index);
		resetUIState();
	}

	function doDeleteChat(index: number) {
		const chat = chatState.chats[index];
		if (chat) cancelStreamsForChat(chat.id);
		deleteChatAction(index);
		resetUIState();
	}

	function addDocToChat(folderId: string, fileId: string) {
		performAddFolderDocumentToChat(folderId, fileId);
	}

	function handleSearchSelect(result: SearchResult) {
		selectChatAction(result.chatIndex);
		setActiveExchangeId(result.exchangeId);
		canvasViewRef?.scrollToNode(result.exchangeId);
	}
</script>

<svelte:head>
	<title>Superset Svelte</title>
</svelte:head>

{#if routerState.route === 'landing'}
	<LandingPage />
{:else}
	<SidebarPrimitive.Provider>
		<AppSidebar
			chats={chatState.chats}
			activeChatIndex={chatState.activeChatIndex}
			onSelectChat={selectChat}
			onNewChat={newChat}
			onDeleteChat={doDeleteChat}
			onRenameChat={renameChat}
			onDownloadChat={downloadChat}
			onUploadChat={uploadChat}
			folders={docState.folders}
			onNewFolder={newFolder}
			onDeleteFolder={deleteFolder}
			onDownloadFolder={downloadFolder}
			onRenameFolder={renameFolder}
			onNewDoc={(folderId) => {
				const document = performCreateDocument(folderId);
				if (document) {
					chatViewRef?.showDocument(document.folderId, document.fileId);
				}
			}}
			onUploadDoc={uploadDocToFolder}
			onUploadFolder={uploadFolderToFolder}
			onUploadNewFolder={uploadFolder}
			onSelectDoc={(folderId, fileId) => {
				if (performOpenDocument(folderId, fileId)) {
					chatViewRef?.showDocument(folderId, fileId);
				}
			}}
			onAddDocToChat={addDocToChat}
			onDeleteDoc={deleteDocFromFolder}
			onRenameDoc={renameDocInFolder}
			onMoveDoc={moveDocToFolder}
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
