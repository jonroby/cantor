<script lang="ts">
	import { tick } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { renameWithDedup } from '@/domain/rename';
	import * as Sidebar from '@/view/components/shadcn/ui/sidebar/index.js';
	import * as DropdownMenu from '@/view/components/shadcn/ui/dropdown-menu/index.js';
	import type { ChatFolder } from '@/state/documents.svelte';
	import InlineRenameInput from './InlineRenameInput.svelte';
	import DocItem from './DocItem.svelte';

	interface Props {
		folder: ChatFolder;
		expanded: boolean;
		isDragOver: boolean;
		startEditing?: boolean;
		editingDocFileId: string | null;
		editingDocFileName: string;
		draggingDocFileId: string | null;
		onToggle: () => void;
		onNewDoc: () => void;
		onUploadDoc: () => void;
		onUploadFolder: () => void;
		onRenameFolder: (name: string) => boolean;
		onDownloadFolder: () => void;
		onDeleteFolder: () => void;
		onSelectDoc: (fileId: string) => void;
		onAddDocToChat: (fileId: string) => void;
		onStartRenameDoc: (fileId: string, fileName: string) => void;
		onCommitRenameDoc: (name: string) => void;
		onCancelRenameDoc: () => void;
		onDeleteDoc: (fileId: string, fileName: string) => void;
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
		editingDocFileId,
		editingDocFileName = $bindable(),
		draggingDocFileId,
		onToggle,
		onNewDoc,
		onUploadDoc,
		onUploadFolder,
		onRenameFolder,
		onDownloadFolder,
		onDeleteFolder,
		onSelectDoc,
		onAddDocToChat,
		onStartRenameDoc,
		onCommitRenameDoc,
		onCancelRenameDoc,
		onDeleteDoc,
		onDragStart,
		onDragEnd,
		onDrop,
		onDragOver,
		onDragLeave
	}: Props = $props();

	let editingFolderName = $state('');
	let isEditingFolder = $state(false);
	let handledStartEditing = $state(false);

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
		const result = renameWithDedup(name, onRenameFolder);
		if (result && result !== name.trim()) {
			toast.warning(`Renamed to "${result}" to avoid duplicate`);
		}
		isEditingFolder = false;
		editingFolderName = '';
	}

	function downloadDoc(file: { name: string; content: string }) {
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
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="shrink-0 transition-transform"
				style:transform={expanded ? 'rotate(90deg)' : 'rotate(0deg)'}
			>
				<path d="M9 6l6 6-6 6" />
			</svg>
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
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
				>
					<circle cx="5" cy="12" r="1" />
					<circle cx="12" cy="12" r="1" />
					<circle cx="19" cy="12" r="1" />
				</svg>
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content
					align="start"
					side="right"
					class="rounded-lg bg-popover p-1 text-popover-foreground shadow-md z-50 min-w-[140px] border"
				>
					<DropdownMenu.Item
						class="gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent flex cursor-pointer items-center"
						onclick={onNewDoc}
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
							<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
							<polyline points="14 2 14 8 20 8" />
							<line x1="12" y1="18" x2="12" y2="12" />
							<line x1="9" y1="15" x2="15" y2="15" />
						</svg>
						Create new .md
					</DropdownMenu.Item>
					<DropdownMenu.Item
						class="gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent flex cursor-pointer items-center"
						onclick={onUploadDoc}
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
						Upload .md
					</DropdownMenu.Item>
					<DropdownMenu.Item
						class="gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent flex cursor-pointer items-center"
						onclick={onUploadFolder}
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
							<path d="M2 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" />
							<path d="M12 11v6" />
							<polyline points="9 14 12 11 15 14" />
						</svg>
						Upload folder
					</DropdownMenu.Item>
					<DropdownMenu.Item
						class="gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent flex cursor-pointer items-center"
						onclick={startRenameFolder}
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
							<path d="M12 20h9" />
							<path
								d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"
							/>
						</svg>
						Rename
					</DropdownMenu.Item>
					<DropdownMenu.Item
						class="gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent flex cursor-pointer items-center"
						onclick={onDownloadFolder}
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
							<polyline points="7 10 12 15 17 10" />
							<line x1="12" y1="15" x2="12" y2="3" />
						</svg>
						Download
					</DropdownMenu.Item>
					<DropdownMenu.Separator class="my-1 bg-border h-px" />
					<DropdownMenu.Item
						class="gap-2 rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10 flex cursor-pointer items-center"
						onclick={onDeleteFolder}
					>
						<svg
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.5"
							stroke-linecap="round"
						>
							<path
								d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
							/>
						</svg>
						Delete
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>
	</Sidebar.MenuItem>

	{#if expanded}
		{#each folder.files ?? [] as file (file.id)}
			<DocItem
				{file}
				isEditing={editingDocFileId === file.id}
				bind:editingName={editingDocFileName}
				isDragging={draggingDocFileId === file.id}
				onOpen={() => onSelectDoc(file.id)}
				onAddToChat={() => onAddDocToChat(file.id)}
				onStartRename={() => onStartRenameDoc(file.id, file.name)}
				onCommitRename={onCommitRenameDoc}
				onCancelRename={onCancelRenameDoc}
				onDownload={() => downloadDoc(file)}
				onDelete={() => onDeleteDoc(file.id, file.name)}
				onDragStart={(e) => onDragStart(file.id, e)}
				{onDragEnd}
			/>
		{/each}
		{#if (folder.files ?? []).length === 0}
			<div class="px-8 py-1 text-xs text-sidebar-foreground/30">Empty</div>
		{/if}
	{/if}
</div>
