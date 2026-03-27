<script lang="ts">
	import { tick } from 'svelte';
	import { toast } from 'svelte-sonner';
	import * as Sidebar from '@/components/shadcn/ui/sidebar/index.js';
	import * as Tooltip from '@/components/shadcn/ui/tooltip/index.js';
	import { useSidebar } from '@/components/shadcn/ui/sidebar/context.svelte.js';
	import type { Chat } from '@/domain/tree';
	import type { ChatFolder } from '@/state/documents.svelte';
	import ChatItem from './ChatItem.svelte';
	import FolderItem from './FolderItem.svelte';
	import ConfirmDeleteDialog from './ConfirmDeleteDialog.svelte';

	interface Props {
		chats: Chat[];
		activeChatIndex: number;
		onSelectChat: (index: number) => void;
		onNewChat: () => number;
		onDeleteChat: (index: number) => void;
		onRenameChat: (index: number, name: string) => void;
		onDownloadChat: (index: number) => void;
		onUploadChat: () => void;
		folders: ChatFolder[];
		onNewFolder: () => string;
		onDeleteFolder: (folderId: string) => void;
		onDownloadFolder: (folderId: string) => void;
		onRenameFolder: (folderId: string, name: string) => boolean;
		onUploadDoc: (folderId: string) => void;
		onUploadFolder: (folderId: string) => void;
		onUploadNewFolder: () => void;
		onSelectDoc: (folderId: string, fileId: string) => void;
		onDeleteDoc: (folderId: string, fileId: string) => void;
		onRenameDoc: (folderId: string, fileId: string, name: string) => boolean;
		onMoveDoc: (fromFolderId: string, fileId: string, toFolderId: string) => boolean;
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
		onUploadDoc,
		onUploadFolder,
		onUploadNewFolder,
		onSelectDoc,
		onDeleteDoc,
		onRenameDoc,
		onMoveDoc
	}: Props = $props();

	const sidebar = useSidebar();

	// Folder expansion
	let expandedFolders: Record<string, boolean> = $state({});

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
		if (editingChatIndex !== null && name.trim()) {
			onRenameChat(editingChatIndex, name.trim());
		}
		editingChatIndex = null;
		editingChatName = '';
	}

	function cancelRenameChat() {
		editingChatIndex = null;
		editingChatName = '';
	}

	// Doc rename state
	let editingDocFileId: string | null = $state(null);
	let editingDocFileName = $state('');
	let editingDocFolderId: string | null = $state(null);

	function startRenameDoc(folderId: string, fileId: string, fileName: string) {
		editingDocFolderId = folderId;
		editingDocFileId = fileId;
		editingDocFileName = fileName;
	}

	function commitRenameDoc(name: string) {
		if (editingDocFolderId && editingDocFileId && name.trim()) {
			const ok = onRenameDoc(editingDocFolderId, editingDocFileId, name.trim());
			if (!ok) {
				toast.error(`"${name.trim()}" already exists in this folder`);
				return;
			}
		}
		editingDocFolderId = null;
		editingDocFileId = null;
		editingDocFileName = '';
	}

	function cancelRenameDoc() {
		editingDocFolderId = null;
		editingDocFileId = null;
		editingDocFileName = '';
	}

	// Drag-and-drop
	let draggingDoc: { folderId: string; fileId: string } | null = $state(null);
	let dragOverFolderId: string | null = $state(null);

	// Delete targets
	let deleteChatTarget: { index: number; name: string } | null = $state(null);
	let deleteFolderTarget: ChatFolder | null = $state(null);
	let deleteDocTarget: { folderId: string; fileId: string; fileName: string } | null = $state(null);

	// New folder
	let newlyCreatedFolderId: string | null = $state(null);

	function handleNewFolder() {
		const id = onNewFolder();
		expandedFolders = { ...expandedFolders, [id]: true };
		newlyCreatedFolderId = id;
	}

	let indexedChats = $derived(chats.map((c, i) => ({ chat: c, index: i })));

	let isDark = $state(document.documentElement.classList.contains('dark'));

	function toggleTheme() {
		isDark = !isDark;
		document.documentElement.classList.toggle('dark', isDark);
		localStorage.setItem('theme', isDark ? 'dark' : 'light');
	}
</script>

<Sidebar.Root collapsible="icon">
	<Sidebar.Header class="p-0">
		<div class="h-14 px-3 flex items-center group-data-[state=collapsed]:justify-center">
			{#if sidebar.state === 'collapsed'}
				<button
					class="rounded-lg hover:bg-sidebar-accent p-1 flex cursor-e-resize items-center justify-center overflow-hidden transition-colors"
					onclick={() => sidebar.toggle()}
					aria-label="Open sidebar"
				>
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="text-sidebar-foreground"
					>
						<rect x="3" y="3" width="18" height="18" rx="2" />
						<path d="M9 3v18" />
						<path d="M14 9l3 3-3 3" />
					</svg>
				</button>
			{:else}
				<span class="text-sm font-semibold text-sidebar-foreground tracking-widest flex-1"
					>POWERSET</span
				>
				<Sidebar.Trigger />
			{/if}
		</div>
	</Sidebar.Header>

	<Sidebar.Content class="px-2">
		<!-- New chat -->
		<Sidebar.Group class="p-0">
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							size="default"
							tooltipContent="New chat"
							onclick={async () => {
								const index = onNewChat();
								const name = chats[index]?.name ?? '';
								await tick();
								startRenameChat(index, name);
							}}
							class="rounded-lg px-3 py-2"
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
			<Sidebar.Separator class="my-2 bg-sidebar-border" />

			<!-- Chat list (unfoldered) -->
			<Sidebar.Group class="p-0">
				<Sidebar.GroupLabel
					class="px-3 text-xs text-sidebar-foreground/50 mb-1 flex items-center justify-between"
				>
					<span>Chats</span>
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<button
									{...props}
									class="rounded-md p-0.5 text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors"
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
						<Tooltip.Content side="right" class="bg-neutral-900 text-white text-xs border-none">
							Upload chat
						</Tooltip.Content>
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

			<Sidebar.Separator class="my-2 bg-sidebar-border" />

			<!-- New folder -->
			<Sidebar.Group class="p-0">
				<Sidebar.GroupContent>
					<Sidebar.Menu>
						<Sidebar.MenuItem>
							<Sidebar.MenuButton
								size="default"
								tooltipContent="New folder"
								onclick={handleNewFolder}
								class="rounded-lg px-3 py-2"
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
				<Sidebar.Group class="p-0 mt-1">
					<Sidebar.GroupLabel
						class="px-3 text-xs text-sidebar-foreground/50 mb-1 flex items-center justify-between"
					>
						<span>Folders</span>
						<Tooltip.Root>
							<Tooltip.Trigger>
								{#snippet child({ props })}
									<button
										{...props}
										class="rounded-md p-0.5 text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors"
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
							<Tooltip.Content side="right" class="bg-neutral-900 text-white text-xs border-none">
								Upload folder
							</Tooltip.Content>
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
									{editingDocFileId}
									bind:editingDocFileName
									draggingDocFileId={draggingDoc?.fileId ?? null}
									onToggle={() => toggleFolder(folder.id)}
									onUploadDoc={() => onUploadDoc(folder.id)}
									onUploadFolder={() => onUploadFolder(folder.id)}
									onRenameFolder={(name) => onRenameFolder(folder.id, name)}
									onDownloadFolder={() => onDownloadFolder(folder.id)}
									onDeleteFolder={() => (deleteFolderTarget = folder)}
									onSelectDoc={(fileId) => onSelectDoc(folder.id, fileId)}
									onStartRenameDoc={(fileId, fileName) =>
										startRenameDoc(folder.id, fileId, fileName)}
									onCommitRenameDoc={commitRenameDoc}
									onCancelRenameDoc={cancelRenameDoc}
									onDeleteDoc={(fileId, fileName) =>
										(deleteDocTarget = {
											folderId: folder.id,
											fileId,
											fileName
										})}
									onDragStart={(fileId, e) => {
										draggingDoc = { folderId: folder.id, fileId };
										e.dataTransfer?.setData('text/plain', fileId);
										if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
									}}
									onDragEnd={() => {
										draggingDoc = null;
										dragOverFolderId = null;
									}}
									onDrop={(e) => {
										e.preventDefault();
										if (draggingDoc && draggingDoc.folderId !== folder.id) {
											const ok = onMoveDoc(draggingDoc.folderId, draggingDoc.fileId, folder.id);
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
										draggingDoc = null;
										dragOverFolderId = null;
									}}
									onDragOver={(e) => {
										if (!draggingDoc || draggingDoc.folderId === folder.id) return;
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

	<Sidebar.Footer class="p-2">
		<button
			class="rounded-lg p-2 hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground flex items-center justify-center transition-colors"
			onclick={toggleTheme}
			aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
		>
			{#if isDark}
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<circle cx="12" cy="12" r="4" />
					<path
						d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
					/>
				</svg>
			{:else}
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
				</svg>
			{/if}
		</button>
	</Sidebar.Footer>

	<Sidebar.Rail />
</Sidebar.Root>

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
	open={!!deleteDocTarget}
	title="Delete document"
	description={`Are you sure you want to delete "${deleteDocTarget?.fileName}"?`}
	onConfirm={() => {
		if (deleteDocTarget) {
			onDeleteDoc(deleteDocTarget.folderId, deleteDocTarget.fileId);
			toast.success(`Deleted "${deleteDocTarget.fileName}"`);
		}
		deleteDocTarget = null;
	}}
	onCancel={() => (deleteDocTarget = null)}
/>
