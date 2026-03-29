<script lang="ts">
	import AppSidebar from '@/view/shared/AppSidebar.svelte';
	import * as Sidebar from '@/view/components/shadcn/ui/sidebar/index.js';
	import { chatState, newChat, selectChat, deleteChat, renameChat } from '@/state/chats';
	import {
		docState,
		newFolder,
		deleteFolder,
		renameFolder,
		selectDoc,
		deleteDocFromFolder,
		renameDocInFolder,
		moveDocToFolder
	} from '@/state/documents';

	const noop = () => {};
</script>

<Sidebar.Provider>
	<AppSidebar
		chats={chatState.chats}
		activeChatIndex={chatState.activeChatIndex}
		onSelectChat={selectChat}
		onNewChat={newChat}
		onDeleteChat={deleteChat}
		onRenameChat={renameChat}
		onDownloadChat={noop}
		onUploadChat={noop}
		folders={docState.folders}
		onNewFolder={newFolder}
		onDeleteFolder={deleteFolder}
		onDownloadFolder={noop}
		onRenameFolder={renameFolder}
		onNewDoc={noop}
		onUploadDoc={noop}
		onUploadFolder={noop}
		onUploadNewFolder={noop}
		onSelectDoc={selectDoc}
		onAddDocToChat={noop}
		onDeleteDoc={deleteDocFromFolder}
		onRenameDoc={renameDocInFolder}
		onMoveDoc={moveDocToFolder}
	/>
</Sidebar.Provider>
