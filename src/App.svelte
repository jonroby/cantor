<script lang="ts">
	import { onMount } from 'svelte';
	import Toaster from '@/components/shadcn/ui/sonner/sonner.svelte';
	import { getDefaultItems, searchChats, type SearchResult } from '@/lib/search';
	import type { Chat } from '@/domain/tree';
	import * as SidebarPrimitive from '@/components/shadcn/ui/sidebar/index.js';
	import { AppSidebar, SearchDialog } from '@/views/shared';
	import { routerState } from '@/routes/router.svelte';
	import { ChatView } from '@/views/classic';
	import { CanvasView } from '@/views/canvas';
	import LandingPage from '@/routes/LandingPage.svelte';
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
		selectDoc,
		deleteDocFromFolder,
		renameDocInFolder,
		moveDocToFolder
	} from '@/state/documents.svelte';
	import { loadFromStorage, saveToStorage } from '@/services/database.svelte';
	import {
		downloadChat,
		uploadChat,
		downloadFolder,
		uploadDocToFolder,
		uploadFolder,
		uploadFolderToFolder
	} from '@/services/io.svelte';
	import { init as initProviders, autoConnectOllama } from '@/state/providers.svelte';
	import { cancelStreamsForChat } from '@/services/streams';

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

		loadFromStorage();
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
		onUploadDoc={uploadDocToFolder}
		onUploadFolder={uploadFolderToFolder}
		onUploadNewFolder={uploadFolder}
		onSelectDoc={selectDoc}
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
