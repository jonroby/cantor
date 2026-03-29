<script lang="ts">
	import AppSidebar from '@/view/shared/AppSidebar.svelte';
	import * as Sidebar from '@/view/components/shadcn/ui/sidebar/index.js';
	import { chatState, newChat, selectChat, deleteChat, renameChat } from '@/state/chats.svelte';
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

	const noop = () => {};

	function renameChatThroughApp(index: number, name: string): string | null {
		const trimmed = name.trim();
		if (!trimmed) return null;
		let candidate = trimmed;
		let suffix = 1;
		while (!renameChat(index, candidate)) {
			candidate = `${trimmed} (${suffix})`;
			suffix += 1;
		}
		return candidate;
	}

	function renameFolderThroughApp(folderId: string, name: string): string | null {
		const trimmed = name.trim();
		if (!trimmed) return null;
		let candidate = trimmed;
		let suffix = 1;
		while (!renameFolder(folderId, candidate)) {
			candidate = `${trimmed} (${suffix})`;
			suffix += 1;
		}
		return candidate;
	}

	function renameDocumentThroughApp(folderId: string, fileId: string, name: string): string | null {
		const trimmed = name.trim();
		if (!trimmed) return null;
		let candidate = trimmed;
		let suffix = 1;
		while (!renameDocInFolder(folderId, fileId, candidate)) {
			candidate = `${trimmed} (${suffix})`;
			suffix += 1;
		}
		return candidate;
	}
</script>

<Sidebar.Provider>
	<AppSidebar
		chats={chatState.chats}
		activeChatIndex={chatState.activeChatIndex}
		onSelectChat={selectChat}
		onNewChat={newChat}
		onDeleteChat={deleteChat}
		onRenameChat={renameChatThroughApp}
		onDownloadChat={noop}
		onUploadChat={noop}
		folders={docState.folders}
		onNewFolder={newFolder}
		onDeleteFolder={deleteFolder}
		onDownloadFolder={noop}
		onRenameFolder={renameFolderThroughApp}
		onNewDoc={noop}
		onUploadDoc={noop}
		onUploadFolder={noop}
		onUploadNewFolder={noop}
		onSelectDoc={selectDoc}
		onAddDocToChat={noop}
		onDeleteDoc={deleteDocFromFolder}
		onRenameDoc={renameDocumentThroughApp}
		onMoveDoc={moveDocToFolder}
	/>
</Sidebar.Provider>
