<script lang="ts">
	import { tick } from 'svelte';
	import { toast } from 'svelte-sonner';
	import * as app from '@/app';
	import * as Sidebar from '@/view/primitives/sidebar';
	import * as Tooltip from '@/view/primitives/tooltip';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { SidebarLeftIcon } from '@hugeicons/core-free-icons';
	import { MessageSquarePlus, Upload, FolderPlus } from 'lucide-svelte';
	import ChatItem from './ChatItem.svelte';
	import FolderItem from './FolderItem.svelte';
	import ConfirmDeleteDialog from '@/view/primitives/confirm-delete-dialog/ConfirmDeleteDialog.svelte';
	import powersetLogo from '@/view/assets/powerset-logo.svg';

	interface Props {
		chats: app.chat.Chat[];
		activeChatIndex: number;
		onSelectChat: (index: number) => void;
		onNewChat: () => number;
		onDeleteChat: (index: number) => void;
		onRenameChat: (index: number, name: string) => string | null;
		onDownloadChat: (index: number) => void;
		onUploadChat: () => void;
		folders: app.documents.Folder[];
		onNewFolder: () => string;
		onDeleteFolder: (folderId: string) => void;
		onDownloadFolder: (folderId: string) => void;
		onRenameFolder: (folderId: string, name: string) => string | null;
		onNewDocument: (folderId: string) => void;
		onUploadDocument: (folderId: string) => void;
		onUploadFolder: (folderId: string) => void;
		onUploadNewFolder: () => void;
		onOpenFolder: (folderId: string) => void;
		onSelectDocument: (folderId: string, fileId: string) => void;
		onAddDocumentToChat: (folderId: string, fileId: string) => void;
		onDeleteDocument: (folderId: string, fileId: string) => void;
		onRenameDocument: (
			folderId: string,
			fileId: string,
			name: string
		) => { result: string | null; error?: string };
		onMoveDocument: (fromFolderId: string, fileId: string, toFolderId: string) => boolean;
		expandedFolders?: Record<string, boolean>;
	}

	let {
		chats,
		activeChatIndex,
		onSelectChat,
		onNewChat,
		onDeleteChat,
		onRenameChat,
		onDownloadChat,
		onUploadChat,
		folders,
		onNewFolder,
		onDeleteFolder,
		onDownloadFolder,
		onRenameFolder,
		onNewDocument,
		onUploadDocument,
		onUploadFolder,
		onUploadNewFolder,
		onOpenFolder,
		onSelectDocument,
		onAddDocumentToChat,
		onDeleteDocument,
		onRenameDocument,
		onMoveDocument,
		expandedFolders = $bindable({})
	}: Props = $props();

	const sidebar = Sidebar.useSidebar();

	function toggleFolder(folderId: string) {
		expandedFolders = { ...expandedFolders, [folderId]: !expandedFolders[folderId] };
	}

	// Chat rename state
	let editingChatIndex: number | null = $state(null);
	let editingChatName = $state('');

	async function startRenameChat(index: number, name: string) {
		editingChatIndex = index;
		editingChatName = name;
		await tick();
	}

	function commitRenameChat(name: string) {
		if (editingChatIndex !== null) {
			const result = onRenameChat(editingChatIndex!, name);
			if (result && result !== name.trim()) {
				toast.warning(`Renamed to "${result}" to avoid duplicate`);
			}
		}
		editingChatIndex = null;
		editingChatName = '';
	}

	function cancelRenameChat() {
		editingChatIndex = null;
		editingChatName = '';
	}

	// Document rename state
	let editingDocumentFileId: string | null = $state(null);
	let editingDocumentFileName = $state('');
	let editingDocumentFolderId: string | null = $state(null);

	function startRenameDocument(folderId: string, fileId: string, fileName: string) {
		editingDocumentFolderId = folderId;
		editingDocumentFileId = fileId;
		editingDocumentFileName = fileName;
	}

	function commitRenameDocument(name: string) {
		if (editingDocumentFolderId && editingDocumentFileId) {
			const { result, error } = onRenameDocument(
				editingDocumentFolderId!,
				editingDocumentFileId!,
				name
			);
			if (error) {
				toast.error(error);
			} else if (result && result !== name.trim()) {
				toast.warning(`Renamed to "${result}" to avoid duplicate`);
			}
		}
		editingDocumentFolderId = null;
		editingDocumentFileId = null;
		editingDocumentFileName = '';
	}

	function cancelRenameDocument() {
		editingDocumentFolderId = null;
		editingDocumentFileId = null;
		editingDocumentFileName = '';
	}

	// Drag-and-drop
	let draggingDocument: { folderId: string; fileId: string } | null = $state(null);
	let dragOverFolderId: string | null = $state(null);

	// Delete targets
	let deleteChatTarget: { index: number; name: string } | null = $state(null);
	let deleteFolderTarget: app.documents.Folder | null = $state(null);
	let deleteDocumentTarget: { folderId: string; fileId: string; fileName: string } | null =
		$state(null);

	// New folder
	let newlyCreatedFolderId: string | null = $state(null);

	function handleNewFolder() {
		const id = onNewFolder();
		expandedFolders = { ...expandedFolders, [id]: true };
		newlyCreatedFolderId = id;
		tick().then(() => {
			if (newlyCreatedFolderId === id) {
				newlyCreatedFolderId = null;
			}
		});
	}

	let indexedChats = $derived(chats.map((c, i) => ({ chat: c, index: i })));
</script>

<Tooltip.Provider>
	<Sidebar.Root collapsible="icon">
		<Sidebar.Header class="sidebar-header-shell">
			{#if sidebar.state === 'expanded'}
				<div class="sidebar-header-row">
					<div class="sidebar-brand">
						<span class="sidebar-brand-name">Cantor</span>
						<Tooltip.Root>
							<Tooltip.Trigger>
								{#snippet child({ props })}
									<button {...props} type="button" class="sidebar-alpha-trigger">
										<span class="sidebar-alpha-badge">Alpha</span>
									</button>
								{/snippet}
							</Tooltip.Trigger>
							<Tooltip.Content side="bottom" class="sidebar-tooltip sidebar-tooltip-wide">
								Some features are still being refined.
							</Tooltip.Content>
						</Tooltip.Root>
					</div>
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<button
									{...props}
									class="sidebar-icon-btn"
									onclick={() => sidebar.toggle()}
									aria-label="Collapse sidebar"
								>
									<HugeiconsIcon icon={SidebarLeftIcon} size={20} />
								</button>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content side="right" class="sidebar-tooltip">Collapse sidebar</Tooltip.Content>
					</Tooltip.Root>
				</div>
			{:else}
				<div class="sidebar-collapsed-header">
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<button
									{...props}
									class="sidebar-logo-btn"
									onclick={() => sidebar.toggle()}
									aria-label="Open sidebar"
								>
									<img
										src={powersetLogo}
										alt="Powerset Labs"
										width="24"
										height="28"
										class="sidebar-logo-img"
									/>
									<span class="sidebar-logo-icon">
										<HugeiconsIcon icon={SidebarLeftIcon} size={20} />
									</span>
								</button>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content side="right" class="sidebar-tooltip">Open sidebar</Tooltip.Content>
					</Tooltip.Root>
				</div>
			{/if}
		</Sidebar.Header>

		<Sidebar.Content class="sidebar-content-shell">
			{#if sidebar.state === 'expanded'}
				<!-- New chat + New folder -->
				<Sidebar.Group class="sidebar-group-reset">
					<Sidebar.GroupContent>
						<Sidebar.Menu>
							<Sidebar.MenuItem>
								<Sidebar.MenuButton
									size="default"
									tooltipContent="New chat"
									onclick={() => onNewChat()}
									class="sidebar-primary-action"
								>
									<MessageSquarePlus size={16} class="shrink-0" />
									<span>New chat</span>
								</Sidebar.MenuButton>
							</Sidebar.MenuItem>
							<Sidebar.MenuItem>
								<Sidebar.MenuButton
									size="default"
									tooltipContent="New folder"
									onclick={handleNewFolder}
									class="sidebar-primary-action"
								>
									<FolderPlus size={16} class="shrink-0" />
									<span>New folder</span>
								</Sidebar.MenuButton>
							</Sidebar.MenuItem>
						</Sidebar.Menu>
					</Sidebar.GroupContent>
				</Sidebar.Group>

				<Sidebar.Separator class="sidebar-section-separator" />

				<!-- Chat list (unfoldered) -->
				<Sidebar.Group class="sidebar-group-reset">
					<Sidebar.GroupLabel class="sidebar-section-label">
						<span>Chats</span>
						<Tooltip.Root>
							<Tooltip.Trigger>
								{#snippet child({ props })}
									<button
										{...props}
										class="sidebar-upload-btn"
										onclick={onUploadChat}
										aria-label="Upload chat"
									>
										<Upload size={14} />
									</button>
								{/snippet}
							</Tooltip.Trigger>
							<Tooltip.Content side="right" class="sidebar-tooltip">Upload chat</Tooltip.Content>
						</Tooltip.Root>
					</Sidebar.GroupLabel>
					<Sidebar.GroupContent>
						<Sidebar.Menu>
							{#each indexedChats as { chat, index } (chat.id)}
								<ChatItem
									{chat}
									isActive={index === activeChatIndex}
									isEditing={editingChatIndex === index}
									bind:editingName={editingChatName}
									canDelete={chats.length > 1}
									onSelect={() => onSelectChat(index)}
									onStartRename={() => startRenameChat(index, chat.name)}
									onCommitRename={commitRenameChat}
									onCancelRename={cancelRenameChat}
									onDownload={() => onDownloadChat(index)}
									onDelete={() => (deleteChatTarget = { index, name: chat.name })}
								/>
							{/each}
						</Sidebar.Menu>
					</Sidebar.GroupContent>
				</Sidebar.Group>

				<!-- Folders list -->
				{#if folders.length > 0}
					<Sidebar.Separator class="sidebar-section-separator" />
					<Sidebar.Group class="sidebar-group-folders">
						<Sidebar.GroupLabel class="sidebar-section-label">
							<span>Folders</span>
							<Tooltip.Root>
								<Tooltip.Trigger>
									{#snippet child({ props })}
										<button
											{...props}
											class="sidebar-upload-btn"
											onclick={onUploadNewFolder}
											aria-label="Upload folder"
										>
											<Upload size={14} />
										</button>
									{/snippet}
								</Tooltip.Trigger>
								<Tooltip.Content side="right" class="sidebar-tooltip">Upload folder</Tooltip.Content
								>
							</Tooltip.Root>
						</Sidebar.GroupLabel>
						<Sidebar.GroupContent>
							<Sidebar.Menu>
								{#each folders as folder (folder.id)}
									<FolderItem
										{folder}
										expanded={!!expandedFolders[folder.id]}
										isDragOver={dragOverFolderId === folder.id}
										startEditing={newlyCreatedFolderId === folder.id}
										{editingDocumentFileId}
										bind:editingDocumentFileName
										draggingDocumentFileId={draggingDocument?.fileId ?? null}
										onToggle={() => toggleFolder(folder.id)}
										onOpenFolder={() => onOpenFolder(folder.id)}
										onNewDocument={() => onNewDocument(folder.id)}
										onUploadDocument={() => onUploadDocument(folder.id)}
										onUploadFolder={() => onUploadFolder(folder.id)}
										onRenameFolder={(name) => onRenameFolder(folder.id, name)}
										onDownloadFolder={() => onDownloadFolder(folder.id)}
										onDeleteFolder={() => (deleteFolderTarget = folder)}
										onSelectDocument={(fileId) => onSelectDocument(folder.id, fileId)}
										onSelectSubfolderDocument={(subfolderId, fileId) =>
											onSelectDocument(subfolderId, fileId)}
										onAddDocumentToChat={(fileId) => onAddDocumentToChat(folder.id, fileId)}
										onAddSubfolderDocumentToChat={(subfolderId, fileId) =>
											onAddDocumentToChat(subfolderId, fileId)}
										onStartRenameFile={(fileId, fileName) =>
											startRenameDocument(folder.id, fileId, fileName)}
										onCommitRenameFile={commitRenameDocument}
										onCancelRenameFile={cancelRenameDocument}
										onDeleteDocument={(fileId, fileName) =>
											(deleteDocumentTarget = {
												folderId: folder.id,
												fileId,
												fileName
											})}
										onDeleteSubfolderDocument={(subfolderId, fileId, fileName) =>
											(deleteDocumentTarget = {
												folderId: subfolderId,
												fileId,
												fileName
											})}
										onDragStart={(fileId, e) => {
											draggingDocument = { folderId: folder.id, fileId };
											e.dataTransfer?.setData('text/plain', fileId);
											if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
										}}
										onDragEnd={() => {
											draggingDocument = null;
											dragOverFolderId = null;
										}}
										onDrop={(e) => {
											e.preventDefault();
											if (draggingDocument && draggingDocument.folderId !== folder.id) {
												const ok = onMoveDocument(
													draggingDocument.folderId,
													draggingDocument.fileId,
													folder.id
												);
												if (ok) {
													toast.success(`Moved to "${folder.name}"`);
													expandedFolders = {
														...expandedFolders,
														[folder.id]: true
													};
												} else {
													toast.error('A file with that name already exists in the target folder');
												}
											}
											draggingDocument = null;
											dragOverFolderId = null;
										}}
										onDragOver={(e) => {
											if (!draggingDocument || draggingDocument.folderId === folder.id) return;
											e.preventDefault();
											if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
											dragOverFolderId = folder.id;
										}}
										onDragLeave={(e) => {
											const el = e.currentTarget as HTMLElement;
											if (e.relatedTarget && el.contains(e.relatedTarget as Node)) return;
											if (dragOverFolderId === folder.id) dragOverFolderId = null;
										}}
									/>
								{/each}
							</Sidebar.Menu>
						</Sidebar.GroupContent>
					</Sidebar.Group>
				{/if}
			{/if}
		</Sidebar.Content>

		<Sidebar.Rail />
	</Sidebar.Root>
</Tooltip.Provider>

<!-- Delete dialogs -->
<ConfirmDeleteDialog
	open={!!deleteChatTarget}
	title="Delete chat"
	description={`Are you sure you want to delete "${deleteChatTarget?.name}"?`}
	onConfirm={() => {
		if (deleteChatTarget) {
			onDeleteChat(deleteChatTarget.index);
			toast.success(`Deleted "${deleteChatTarget.name}"`);
		}
		deleteChatTarget = null;
	}}
	onCancel={() => (deleteChatTarget = null)}
/>

<ConfirmDeleteDialog
	open={!!deleteFolderTarget}
	title="Delete folder"
	description={`Are you sure you want to delete "${deleteFolderTarget?.name}"? This will remove the folder and all its documents.`}
	onConfirm={() => {
		if (deleteFolderTarget) {
			onDeleteFolder(deleteFolderTarget.id);
			toast.success(`Deleted "${deleteFolderTarget.name}"`);
		}
		deleteFolderTarget = null;
	}}
	onCancel={() => (deleteFolderTarget = null)}
/>

<ConfirmDeleteDialog
	open={!!deleteDocumentTarget}
	title="Delete document"
	description={`Are you sure you want to delete "${deleteDocumentTarget?.fileName}"?`}
	onConfirm={() => {
		if (deleteDocumentTarget) {
			onDeleteDocument(deleteDocumentTarget.folderId, deleteDocumentTarget.fileId);
			toast.success(`Deleted "${deleteDocumentTarget.fileName}"`);
		}
		deleteDocumentTarget = null;
	}}
	onCancel={() => (deleteDocumentTarget = null)}
/>

<style>
	:global(.sidebar-header-shell) {
		padding: 0;
	}

	.sidebar-header-row {
		display: flex;
		height: 52px;
		align-items: center;
		padding: 0 0.75rem 0 2rem;
	}

	.sidebar-brand {
		display: flex;
		flex: 1;
		align-items: center;
		gap: 0.5rem;
	}

	.sidebar-brand-name {
		font-size: 17px;
		font-weight: var(--font-weight-semibold);
		color: hsl(var(--sidebar-foreground) / 0.88);
	}

	.sidebar-alpha-badge {
		display: inline-flex;
		align-items: center;
		margin-top: 3px;
		margin-left: 0.25rem;
		border: 1px solid hsl(215 80% 45%);
		border-radius: 9999px;
		background: hsl(215 90% 92%);
		padding: 0.125rem 0.45rem;
		font-size: 11px;
		font-weight: var(--font-weight-normal);
		line-height: 1.2;
		color: hsl(215 80% 35%);
	}

	.sidebar-alpha-trigger {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: none;
		background: transparent;
		cursor: default;
		color: inherit;
	}

	.sidebar-icon-btn {
		display: flex;
		cursor: pointer;
		align-items: center;
		justify-content: center;
		border-radius: 0.5rem;
		border: none;
		background: transparent;
		padding: 0.25rem;
		transition: background 120ms;
		color: var(--sidebar-icon-muted);
		outline: none;
	}

	.sidebar-icon-btn:hover {
		background: var(--sidebar-surface-tint);
		color: var(--sidebar-icon-strong);
	}

	.sidebar-collapsed-header {
		display: flex;
		height: 52px;
		align-items: center;
		justify-content: center;
	}

	.sidebar-logo-btn {
		display: flex;
		cursor: pointer;
		align-items: center;
		justify-content: center;
		border-radius: 0.5rem;
		border: none;
		background: transparent;
		padding: 0.25rem;
		transition: background 120ms;
		color: var(--sidebar-icon-muted);
		outline: none;
	}

	.sidebar-logo-btn:hover {
		background: var(--sidebar-surface-tint);
		color: var(--sidebar-icon-strong);
	}

	.sidebar-logo-img {
		display: block;
	}

	.sidebar-logo-btn:hover .sidebar-logo-img {
		display: none;
	}

	.sidebar-logo-icon {
		display: none;
	}

	.sidebar-logo-btn:hover .sidebar-logo-icon {
		display: block;
	}

	:global(.sidebar-content-shell) {
		padding-left: 1.25rem;
		padding-right: 0.5rem;
	}

	:global(.sidebar-group-reset) {
		padding: 0;
	}

	:global(.sidebar-group-folders) {
		margin-top: 0.25rem;
		padding: 0;
	}

	:global(.sidebar-primary-action) {
		border-radius: 0.5rem;
		padding: 0.5rem 0.75rem;
	}

	:global(.sidebar-section-separator) {
		height: 0;
		margin: 0.5rem 0;
		border: none;
		border-top: 1px solid hsl(var(--sidebar-border));
	}

	:global(.sidebar-section-label) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.25rem;
		padding: 0 0.75rem;
		font-size: 12px;
		color: hsl(var(--sidebar-foreground) / 0.5);
	}

	.sidebar-upload-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.125rem;
		border: none;
		border-radius: 0.375rem;
		background: transparent;
		color: var(--sidebar-icon-muted);
		cursor: pointer;
		outline: none;
		transition:
			color 120ms ease,
			background 120ms ease;
	}

	.sidebar-upload-btn:hover {
		background: var(--sidebar-surface-tint);
		color: var(--sidebar-icon-strong);
	}

	:global(.sidebar-tooltip-wide) {
		max-width: var(--dropdown-max-w);
	}
</style>
