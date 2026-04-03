<script lang="ts">
	import { tick } from 'svelte';
	import { toast } from 'svelte-sonner';
	import * as app from '@/app';
	import * as Sidebar from '@/view/primitives/bits/sidebar';
	import * as Tooltip from '@/view/primitives/bits/tooltip';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { SidebarLeftIcon } from '@hugeicons/core-free-icons';
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
						<img src={powersetLogo} alt="Cantor" width="18" height="20" />
						<span class="sidebar-brand-name">Cantor</span>
						<Tooltip.Root>
							<Tooltip.Trigger>
								<span class="sidebar-alpha-badge">Alpha</span>
							</Tooltip.Trigger>
							<Tooltip.Content side="bottom" class="sidebar-tooltip sidebar-tooltip-wide">
								Some features are still being refined.
							</Tooltip.Content>
						</Tooltip.Root>
					</div>
					<button
						class="sidebar-icon-btn"
						onclick={() => sidebar.toggle()}
						aria-label="Collapse sidebar"
					>
						<HugeiconsIcon icon={SidebarLeftIcon} size={20} />
					</button>
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
			<!-- New chat -->
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
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="1.5"
									stroke-linecap="round"
									stroke-linejoin="round"
									class="shrink-0"
								>
									<path d="M12 20h9" />
									<path
										d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"
									/>
								</svg>
								<span>New chat</span>
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>

			{#if sidebar.state === 'expanded'}
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
										<svg
											width="14"
											height="14"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="1.5"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
											<polyline points="17 8 12 3 7 8" />
											<line x1="12" y1="3" x2="12" y2="15" />
										</svg>
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

				<Sidebar.Separator class="sidebar-section-separator" />

				<!-- New folder -->
				<Sidebar.Group class="sidebar-group-reset">
					<Sidebar.GroupContent>
						<Sidebar.Menu>
							<Sidebar.MenuItem>
								<Sidebar.MenuButton
									size="default"
									tooltipContent="New folder"
									onclick={handleNewFolder}
									class="sidebar-primary-action"
								>
									<svg
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="1.5"
										stroke-linecap="round"
										stroke-linejoin="round"
										class="shrink-0"
									>
										<path d="M12 10v6M9 13h6" />
										<path
											d="M2 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"
										/>
									</svg>
									<span>New folder</span>
								</Sidebar.MenuButton>
							</Sidebar.MenuItem>
						</Sidebar.Menu>
					</Sidebar.GroupContent>
				</Sidebar.Group>

				<!-- Folders list -->
				{#if folders.length > 0}
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
											<svg
												width="14"
												height="14"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="1.5"
												stroke-linecap="round"
												stroke-linejoin="round"
											>
												<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
												<polyline points="17 8 12 3 7 8" />
												<line x1="12" y1="3" x2="12" y2="15" />
											</svg>
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
		height: 3.5rem;
		align-items: center;
		padding: 0 0.75rem;
	}

	.sidebar-brand {
		display: flex;
		flex: 1;
		align-items: center;
		gap: 0.5rem;
	}

	.sidebar-brand-name {
		font-size: var(--text-sm);
		font-weight: 600;
		color: hsl(var(--sidebar-foreground));
	}

	.sidebar-alpha-badge {
		border-radius: 9999px;
		background: hsl(var(--accent));
		padding: 0.125rem 0.375rem;
		font-size: var(--text-xs);
		font-weight: 600;
		color: hsl(var(--accent-foreground));
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
		color: inherit;
	}

	.sidebar-icon-btn:hover {
		background: hsl(var(--sidebar-accent));
	}

	.sidebar-collapsed-header {
		display: flex;
		height: 3.5rem;
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
		color: inherit;
	}

	.sidebar-logo-btn:hover {
		background: hsl(var(--sidebar-accent));
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
		padding-left: 0.5rem;
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
		margin: 0.5rem 0;
		background: hsl(var(--sidebar-border));
	}

	:global(.sidebar-section-label) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.25rem;
		padding: 0 0.75rem;
		font-size: var(--text-xs);
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
		color: hsl(var(--sidebar-foreground) / 0.4);
		cursor: pointer;
		transition: color 120ms ease;
	}

	.sidebar-upload-btn:hover {
		color: hsl(var(--sidebar-foreground));
	}

	:global(.sidebar-tooltip) {
		font-size: var(--text-xs);
	}

	:global(.sidebar-tooltip-wide) {
		max-width: var(--dropdown-max-w);
	}
</style>
