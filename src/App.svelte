<script lang="ts">
	import { onMount } from 'svelte';
	import Toaster from '@/components/shadcn/ui/sonner/sonner.svelte';
	import { getDefaultItems, searchChats, type SearchResult } from '@/lib/search';
	import type { Chat } from '@/domain/tree';
	import * as SidebarPrimitive from '@/components/shadcn/ui/sidebar/index.js';
	import { AppSidebar } from '@/features/app-sidebar';
	import { ChatToolbar } from '@/features/chat-toolbar';
	import { SearchDialog } from '@/features/search-dialog';
	import { ChatHeader } from '@/features/chat-header';
	import { ChatTree } from '@/features/canvas';
	import { ChatInput } from '@/features/chat-input';
	import {
		chatState,
		getActiveChat,
		getActiveExchangeId,
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
		downloadToFile,
		downloadChat,
		uploadChat,
		downloadFolder,
		uploadDocToFolder,
		uploadFolder,
		uploadFolderToFolder
	} from '@/services/io.svelte';
	import { init as initProviders, autoConnectOllama } from '@/state/providers.svelte';

	let searchQuery = $state('');
	let searchAllChats = $state(true);
	let searchOpen = $state(false);
	let hasHydrated = $state(false);
	let headerVisible = $state(true);
	let headerTimer: ReturnType<typeof setTimeout> | null = null;

	let chatTreeRef: ReturnType<typeof ChatTree> | null = $state(null);

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

	function handleCanvasWheel(e: WheelEvent) {
		if (e.deltaY < 0) {
			headerVisible = true;
			if (headerTimer) clearTimeout(headerTimer);
			headerTimer = setTimeout(() => {
				headerVisible = false;
			}, 2000);
		} else if (e.deltaY > 0) {
			if (headerTimer) clearTimeout(headerTimer);
			headerVisible = false;
		}
	}

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

		headerTimer = setTimeout(() => {
			headerVisible = false;
		}, 2000);

		loadFromStorage();
		initProviders();
		autoConnectOllama();

		hasHydrated = true;

		return () => {
			window.removeEventListener('keydown', handleKeyDown);
			if (headerTimer) clearTimeout(headerTimer);
		};
	});

	function resetUIState() {
		chatTreeRef?.resetUIState();
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
		deleteChatAction(index);
		resetUIState();
	}

	function handleSearchSelect(result: SearchResult) {
		selectChatAction(result.chatIndex);
		setActiveExchangeId(result.exchangeId);
		chatTreeRef?.scrollToNode(result.exchangeId);
	}
</script>

<svelte:head>
	<title>Superset Svelte</title>
</svelte:head>

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
		<div class="page-shell" onwheel={handleCanvasWheel}>
			<ChatHeader visible={headerVisible} chatName={getActiveChat().name} />

			<ChatToolbar
				onSearch={() => (searchOpen = true)}
				onFitView={() => chatTreeRef?.fitView()}
				onGoToTop={() => chatTreeRef?.scrollToTop()}
				onGoToActive={() => chatTreeRef?.scrollToNode(getActiveExchangeId())}
				onDownload={downloadToFile}
			/>

			<ChatTree bind:this={chatTreeRef} />

			<ChatInput
				onScrollToNode={(nodeId) => chatTreeRef?.scrollToNode(nodeId)}
				onExpandSideChat={() => {}}
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
		</div>
	</SidebarPrimitive.Inset>
</SidebarPrimitive.Provider>
<Toaster position="top-center" />
