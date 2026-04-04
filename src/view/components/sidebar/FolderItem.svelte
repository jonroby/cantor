<script lang="ts">
	import { tick } from 'svelte';
	import { toast } from 'svelte-sonner';
	import {
		ChevronRight,
		Ellipsis,
		Folder,
		FilePlus,
		Upload,
		FolderUp,
		Pencil,
		Download,
		Trash2
	} from 'lucide-svelte';
	import * as app from '@/app';
	import * as Sidebar from '@/view/primitives/sidebar';
	import * as DropdownMenu from '@/view/primitives/dropdown-menu';
	import InlineRenameInput from '@/view/primitives/inline-rename-input/InlineRenameInput.svelte';
	import DocumentItem from './DocumentItem.svelte';

	interface Props {
		folder: app.documents.Folder;
		expanded: boolean;
		isDragOver: boolean;
		startEditing?: boolean;
		editingDocumentFileId: string | null;
		editingDocumentFileName: string;
		draggingDocumentFileId: string | null;
		onToggle: () => void;
		onOpenFolder: () => void;
		onNewDocument: () => void;
		onUploadDocument: () => void;
		onUploadFolder: () => void;
		onRenameFolder: (name: string) => string | null;
		onDownloadFolder: () => void;
		onDeleteFolder: () => void;
		onSelectDocument: (fileId: string) => void;
		onSelectSubfolderDocument: (subfolderId: string, fileId: string) => void;
		onAddDocumentToChat: (fileId: string) => void;
		onAddSubfolderDocumentToChat: (subfolderId: string, fileId: string) => void;
		onStartRenameFile: (fileId: string, fileName: string) => void;
		onCommitRenameFile: (name: string) => void;
		onCancelRenameFile: () => void;
		onDeleteDocument: (fileId: string, fileName: string) => void;
		onDeleteSubfolderDocument: (subfolderId: string, fileId: string, fileName: string) => void;
		onDragStart: (fileId: string, e: DragEvent) => void;
		onDragEnd: () => void;
		onDrop: (e: DragEvent) => void;
		onDragOver: (e: DragEvent) => void;
		onDragLeave: (e: DragEvent) => void;
	}

	let {
		folder,
		expanded,
		isDragOver,
		startEditing = false,
		editingDocumentFileId,
		editingDocumentFileName = $bindable(),
		draggingDocumentFileId,
		onToggle,
		onOpenFolder,
		onNewDocument,
		onUploadDocument,
		onUploadFolder,
		onRenameFolder,
		onDownloadFolder,
		onDeleteFolder,
		onSelectDocument,
		onSelectSubfolderDocument,
		onAddDocumentToChat,
		onAddSubfolderDocumentToChat,
		onStartRenameFile,
		onCommitRenameFile,
		onCancelRenameFile,
		onDeleteDocument,
		onDeleteSubfolderDocument,
		onDragStart,
		onDragEnd,
		onDrop,
		onDragOver,
		onDragLeave
	}: Props = $props();

	let editingFolderName = $state('');
	let isEditingFolder = $state(false);
	let handledStartEditing = $state(false);
	let expandedSubfolders: Record<string, boolean> = $state({});

	$effect(() => {
		if (startEditing && !handledStartEditing) {
			handledStartEditing = true;
			editingFolderName = folder.name;
			isEditingFolder = true;
		}
		if (!startEditing) {
			handledStartEditing = false;
		}
	});

	async function startRenameFolder() {
		editingFolderName = folder.name;
		isEditingFolder = true;
		await tick();
	}

	function commitRenameFolder(name: string) {
		const result = onRenameFolder(name);
		if (result && result !== name.trim()) {
			toast.warning(`Renamed to "${result}" to avoid duplicate`);
		}
		isEditingFolder = false;
		editingFolderName = '';
	}

	function downloadDocument(file: { name: string; content: string }) {
		const blob = new Blob([file.content], { type: 'text/markdown;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = file.name;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		setTimeout(() => URL.revokeObjectURL(url), 100);
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div ondragover={onDragOver} ondragleave={onDragLeave} ondrop={onDrop}>
	<Sidebar.MenuItem>
		<Sidebar.MenuButton
			onclick={onToggle}
			class={`folder-item-button ${isDragOver ? 'folder-item-button-dragover' : ''}`}
		>
			<span class="chevron-icon" style:transform={expanded ? 'rotate(90deg)' : 'rotate(0deg)'}>
				<ChevronRight size={16} strokeWidth={1.5} />
			</span>
			{#if isEditingFolder}
				<InlineRenameInput
					bind:value={editingFolderName}
					onCommit={commitRenameFolder}
					onCancel={() => {
						isEditingFolder = false;
						editingFolderName = '';
					}}
				/>
			{:else}
				<span
					ondblclick={(e) => {
						e.stopPropagation();
						startRenameFolder();
					}}>{folder.name}</span
				>
			{/if}
		</Sidebar.MenuButton>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger class="folder-item-menu-trigger" onclick={(e) => e.stopPropagation()}>
				<Ellipsis size={14} />
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content align="start" side="right" class="folder-item-menu-content">
					<DropdownMenu.Item class="folder-item-menu-action" onclick={onOpenFolder}>
						<Folder size={14} strokeWidth={1.5} />
						Open
					</DropdownMenu.Item>
					<DropdownMenu.Separator class="folder-item-menu-separator" />
					<DropdownMenu.Item class="folder-item-menu-action" onclick={onNewDocument}>
						<FilePlus size={14} strokeWidth={1.5} />
						New file
					</DropdownMenu.Item>
					<DropdownMenu.Item class="folder-item-menu-action" onclick={onUploadDocument}>
						<Upload size={14} strokeWidth={1.5} />
						Upload file
					</DropdownMenu.Item>
					<DropdownMenu.Item class="folder-item-menu-action" onclick={onUploadFolder}>
						<FolderUp size={14} strokeWidth={1.5} />
						Upload folder
					</DropdownMenu.Item>
					<DropdownMenu.Item class="folder-item-menu-action" onclick={startRenameFolder}>
						<Pencil size={14} strokeWidth={1.5} />
						Rename
					</DropdownMenu.Item>
					<DropdownMenu.Item class="folder-item-menu-action" onclick={onDownloadFolder}>
						<Download size={14} strokeWidth={1.5} />
						Download
					</DropdownMenu.Item>
					<DropdownMenu.Separator class="folder-item-menu-separator" />
					<DropdownMenu.Item
						class="folder-item-menu-action folder-item-menu-action-destructive"
						onclick={onDeleteFolder}
					>
						<Trash2 size={14} strokeWidth={1.5} />
						Delete
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>
	</Sidebar.MenuItem>

	{#if expanded}
		{#each folder.files ?? [] as file (file.id)}
			<DocumentItem
				{file}
				isEditing={editingDocumentFileId === file.id}
				bind:editingName={editingDocumentFileName}
				isDragging={draggingDocumentFileId === file.id}
				onOpen={() => onSelectDocument(file.id)}
				onAddToChat={() => onAddDocumentToChat(file.id)}
				onStartRename={() => onStartRenameFile(file.id, file.name)}
				onCommitRename={onCommitRenameFile}
				onCancelRename={onCancelRenameFile}
				onDownload={() => downloadDocument(file)}
				onDelete={() => onDeleteDocument(file.id, file.name)}
				onDragStart={(e) => onDragStart(file.id, e)}
				{onDragEnd}
			/>
		{/each}
		{#each folder.folders ?? [] as subfolder (subfolder.id)}
			<Sidebar.MenuItem>
				<button
					class="subfolder-btn"
					onclick={() =>
						(expandedSubfolders = {
							...expandedSubfolders,
							[subfolder.id]: !expandedSubfolders[subfolder.id]
						})}
				>
					<span
						class="chevron-icon"
						style:transform={expandedSubfolders[subfolder.id] ? 'rotate(90deg)' : 'rotate(0deg)'}
					>
						<ChevronRight size={14} strokeWidth={1.5} />
					</span>
					<Folder size={14} strokeWidth={1.5} class="subfolder-folder-icon" />
					<span class="subfolder-name">{subfolder.name}</span>
				</button>
			</Sidebar.MenuItem>
			{#if expandedSubfolders[subfolder.id]}
				{#each subfolder.files ?? [] as file (file.id)}
					<DocumentItem
						{file}
						isEditing={editingDocumentFileId === file.id}
						bind:editingName={editingDocumentFileName}
						isDragging={draggingDocumentFileId === file.id}
						indent
						onOpen={() => onSelectSubfolderDocument(subfolder.id, file.id)}
						onAddToChat={() => onAddSubfolderDocumentToChat(subfolder.id, file.id)}
						onStartRename={() => onStartRenameFile(file.id, file.name)}
						onCommitRename={onCommitRenameFile}
						onCancelRename={onCancelRenameFile}
						onDownload={() => downloadDocument(file)}
						onDelete={() => onDeleteSubfolderDocument(subfolder.id, file.id, file.name)}
						onDragStart={(e) => onDragStart(file.id, e)}
						{onDragEnd}
					/>
				{/each}
			{/if}
		{/each}
		{#if (folder.files ?? []).length === 0 && (folder.folders ?? []).length === 0}
			<div class="folder-empty-label">Empty</div>
		{/if}
	{/if}
</div>

<style>
	.chevron-icon {
		display: inline-flex;
		flex-shrink: 0;
		transition: transform 120ms;
	}

	:global(.folder-item-button) {
		border-radius: 0.5rem;
		padding: 0.5rem 0.75rem;
	}

	:global(.folder-item-button-dragover) {
		box-shadow: inset 0 0 0 2px hsl(var(--primary));
	}

	:global(li[data-sidebar='menu-item']:hover .folder-item-button),
	:global(li[data-sidebar='menu-item'][data-state='open'] .folder-item-button) {
		background: var(--sidebar-surface-tint);
		color: var(--sidebar-surface-tint-foreground);
	}

	:global(.folder-item-menu-trigger) {
		position: absolute;
		top: 50%;
		right: 0.25rem;
		display: flex;
		height: 1.5rem;
		width: 1.5rem;
		align-items: center;
		justify-content: center;
		transform: translateY(-50%);
		border: none;
		border-radius: 0.375rem;
		background: transparent;
		color: var(--sidebar-icon-muted);
		opacity: 0;
		outline: none;
		transition:
			opacity 120ms ease,
			color 120ms ease,
			background 120ms ease;
	}

	:global(li[data-sidebar='menu-item']:hover .folder-item-menu-trigger),
	:global(.folder-item-menu-trigger[data-state='open']) {
		opacity: 1;
	}

	:global(.folder-item-menu-trigger:hover) {
		background: var(--sidebar-surface-tint);
		color: var(--sidebar-icon-strong);
	}

	:global(.folder-item-menu-trigger:focus-visible) {
		box-shadow: 0 0 0 2px var(--focus-ring-color);
	}

	:global(.folder-item-menu-content) {
		z-index: 50;
		min-width: var(--dropdown-min-w);
		padding: 0.25rem;
		border: 1px solid var(--surface-floating-border);
		border-radius: 0.5rem;
		background: var(--surface-floating);
		color: var(--surface-floating-foreground);
		box-shadow: var(--surface-floating-shadow);
	}

	:global(.folder-item-menu-action) {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.5rem;
		border-radius: 0.375rem;
		font-size: var(--text-sm);
		cursor: pointer;
	}

	:global(.folder-item-menu-action:hover) {
		background: var(--surface-tint);
	}

	:global(.folder-item-menu-action-destructive) {
		color: hsl(var(--destructive));
	}

	:global(.folder-item-menu-action-destructive:hover) {
		background: var(--surface-tint);
	}

	:global(.folder-item-menu-separator) {
		height: 1px;
		margin: 0.25rem 0;
		background: var(--border-color);
	}

	.subfolder-btn {
		display: flex;
		width: 100%;
		cursor: pointer;
		align-items: center;
		gap: 0.375rem;
		border-radius: 0.5rem;
		border: none;
		background: transparent;
		padding: 0.375rem 0.75rem 0.375rem 2rem;
		font-size: var(--text-base);
		color: hsl(var(--sidebar-foreground));
		transition: background 120ms;
	}

	.subfolder-btn:hover {
		background: var(--sidebar-surface-tint);
	}

	.folder-empty-label {
		padding: 0.25rem 2rem;
		font-size: var(--text-xs);
		color: hsl(var(--sidebar-foreground) / 0.3);
	}

	:global(.subfolder-folder-icon) {
		flex-shrink: 0;
	}

	.subfolder-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
