<script lang="ts">
	import AppSidebar from '@/view/components/sidebar/AppSidebar.svelte';
	import * as Sidebar from '@/view/primitives/shadcn/ui/sidebar/index.js';
	import { chatState, newChat, selectChat, deleteChat, renameChat } from '@/state/chats.svelte';
	import {
		documentState,
		newFolder,
		deleteFolder,
		renameFolder,
		selectDocument,
		deleteDocumentFromFolder,
		renameDocumentInFolder,
		moveDocumentToFolder
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

	function renameDocumentThroughApp(
		folderId: string,
		fileId: string,
		name: string
	): { result: string | null; error?: string } {
		const trimmed = name.trim();
		if (!trimmed) return { result: null };
		let candidate = trimmed;
		let suffix = 1;
		while (!renameDocumentInFolder(folderId, fileId, candidate)) {
			candidate = `${trimmed} (${suffix})`;
			suffix += 1;
		}
		return { result: candidate };
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
		folders={documentState.folders}
		onNewFolder={newFolder}
		onDeleteFolder={deleteFolder}
		onDownloadFolder={noop}
		onRenameFolder={renameFolderThroughApp}
		onNewDocument={noop}
		onUploadDocument={noop}
		onUploadFolder={noop}
		onUploadNewFolder={noop}
		onSelectDocument={selectDocument}
		onAddDocumentToChat={noop}
		onDeleteDocument={deleteDocumentFromFolder}
		onRenameDocument={renameDocumentThroughApp}
		onMoveDocument={moveDocumentToFolder}
		onOpenFolder={noop}
	/>
</Sidebar.Provider>
