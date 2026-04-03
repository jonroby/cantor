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
	import * as Sidebar from '@/view/components/shadcn/ui/sidebar';
	import * as DropdownMenu from '@/view/components/shadcn/ui/dropdown-menu';
	import InlineRenameInput from './InlineRenameInput.svelte';
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
			class="rounded-lg px-3 py-2 group-hover/menu-item:bg-sidebar-accent group-hover/menu-item:text-sidebar-accent-foreground group-has-data-[state=open]/menu-item:bg-sidebar-accent group-has-data-[state=open]/menu-item:text-sidebar-accent-foreground {isDragOver
				? 'ring-primary ring-2 ring-inset'
				: ''}"
		>
			<span
				class="inline-flex shrink-0 transition-transform"
				style:transform={expanded ? 'rotate(90deg)' : 'rotate(0deg)'}
			>
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
			<DropdownMenu.Trigger
				class="right-1 w-6 h-6 rounded-md text-sidebar-foreground/40 hover:text-sidebar-foreground absolute top-1/2 flex -translate-y-1/2 items-center justify-center opacity-0 transition-opacity group-hover/menu-item:opacity-100 data-[state=open]:opacity-100"
				onclick={(e) => e.stopPropagation()}
			>
				<Ellipsis size={14} />
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content
					align="start"
					side="right"
					class="rounded-lg bg-popover p-1 text-popover-foreground shadow-md z-50 min-w-[140px] border"
				>
					<DropdownMenu.Item
						class="gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent flex cursor-pointer items-center"
						onclick={onOpenFolder}
					>
						<Folder size={14} strokeWidth={1.5} />
						Open
					</DropdownMenu.Item>
					<DropdownMenu.Separator class="my-1 bg-border h-px" />
					<DropdownMenu.Item
						class="gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent flex cursor-pointer items-center"
						onclick={onNewDocument}
					>
						<FilePlus size={14} strokeWidth={1.5} />
						New file
					</DropdownMenu.Item>
					<DropdownMenu.Item
						class="gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent flex cursor-pointer items-center"
						onclick={onUploadDocument}
					>
						<Upload size={14} strokeWidth={1.5} />
						Upload file
					</DropdownMenu.Item>
					<DropdownMenu.Item
						class="gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent flex cursor-pointer items-center"
						onclick={onUploadFolder}
					>
						<FolderUp size={14} strokeWidth={1.5} />
						Upload folder
					</DropdownMenu.Item>
					<DropdownMenu.Item
						class="gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent flex cursor-pointer items-center"
						onclick={startRenameFolder}
					>
						<Pencil size={14} strokeWidth={1.5} />
						Rename
					</DropdownMenu.Item>
					<DropdownMenu.Item
						class="gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent flex cursor-pointer items-center"
						onclick={onDownloadFolder}
					>
						<Download size={14} strokeWidth={1.5} />
						Download
					</DropdownMenu.Item>
					<DropdownMenu.Separator class="my-1 bg-border h-px" />
					<DropdownMenu.Item
						class="gap-2 rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10 flex cursor-pointer items-center"
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
					class="subfolder-row"
					onclick={() =>
						(expandedSubfolders = {
							...expandedSubfolders,
							[subfolder.id]: !expandedSubfolders[subfolder.id]
						})}
				>
					<span
						class="inline-flex shrink-0 transition-transform"
						style:transform={expandedSubfolders[subfolder.id] ? 'rotate(90deg)' : 'rotate(0deg)'}
					>
						<ChevronRight size={14} strokeWidth={1.5} />
					</span>
					<Folder size={14} strokeWidth={1.5} class="shrink-0" />
					<span class="truncate">{subfolder.name}</span>
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
			<div class="px-8 py-1 text-xs text-sidebar-foreground/30">Empty</div>
		{/if}
	{/if}
</div>

<style>
	.subfolder-row {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		width: 100%;
		padding: 0.375rem 0.75rem 0.375rem 2rem;
		border-radius: 0.5rem;
		font-size: var(--text-base);
		color: hsl(var(--sidebar-foreground));
		cursor: pointer;
		transition: background-color var(--duration-normal);
	}

	.subfolder-row:hover {
		background: hsl(var(--sidebar-accent));
	}
</style>
