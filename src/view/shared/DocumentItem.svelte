<script lang="ts">
	import * as Sidebar from '@/view/components/shadcn/ui/sidebar';
	import * as DropdownMenu from '@/view/components/shadcn/ui/dropdown-menu';
	import InlineRenameInput from './InlineRenameInput.svelte';
	import {
		File,
		EllipsisVertical,
		FileText,
		MessageCircle,
		Pencil,
		Download,
		Trash2
	} from 'lucide-svelte';

	interface Props {
		file: { name: string };
		isEditing: boolean;
		editingName: string;
		isDragging: boolean;
		indent?: boolean;
		onOpen: () => void;
		onAddToChat: () => void;
		onStartRename: () => void;
		onCommitRename: (name: string) => void;
		onCancelRename: () => void;
		onDownload: () => void;
		onDelete: () => void;
		onDragStart: (e: DragEvent) => void;
		onDragEnd: () => void;
	}

	let {
		file,
		isEditing,
		editingName = $bindable(),
		isDragging,
		onOpen,
		onAddToChat,
		onStartRename,
		onCommitRename,
		onCancelRename,
		onDownload,
		onDelete,
		indent = false,
		onDragStart,
		onDragEnd
	}: Props = $props();
</script>

<Sidebar.MenuItem
	draggable={true}
	ondragstart={onDragStart}
	ondragend={onDragEnd}
	class={isDragging ? 'opacity-50' : ''}
>
	<Sidebar.MenuButton
		isActive={false}
		tooltipContent={file.name}
		class="rounded-lg pr-3 py-2 group-hover/menu-item:bg-sidebar-accent group-hover/menu-item:text-sidebar-accent-foreground group-has-data-[state=open]/menu-item:bg-sidebar-accent group-has-data-[state=open]/menu-item:text-sidebar-accent-foreground cursor-default {indent
			? 'pl-12'
			: 'pl-8'}"
		ondblclick={onOpen}
	>
		<File size={16} class="shrink-0" />
		{#if isEditing}
			<InlineRenameInput
				bind:value={editingName}
				onCommit={onCommitRename}
				onCancel={onCancelRename}
			/>
		{:else}
			<span>{file.name}</span>
		{/if}
	</Sidebar.MenuButton>
	<DropdownMenu.Root>
		<DropdownMenu.Trigger
			class="right-1 w-6 h-6 rounded-md text-sidebar-foreground/40 hover:text-sidebar-foreground absolute top-1/2 flex -translate-y-1/2 items-center justify-center opacity-0 transition-opacity group-hover/menu-item:opacity-100 data-[state=open]:opacity-100"
			onclick={(e) => e.stopPropagation()}
		>
			<EllipsisVertical size={14} />
		</DropdownMenu.Trigger>
		<DropdownMenu.Portal>
			<DropdownMenu.Content
				align="start"
				side="right"
				class="rounded-lg bg-popover p-1 text-popover-foreground shadow-md z-50 min-w-[140px] border"
			>
				<DropdownMenu.Item
					class="gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent flex cursor-pointer items-center"
					onclick={onOpen}
				>
					<FileText size={14} />
					Open
				</DropdownMenu.Item>
				<DropdownMenu.Item
					class="gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent flex cursor-pointer items-center"
					onclick={onAddToChat}
				>
					<MessageCircle size={14} />
					Add to chat
				</DropdownMenu.Item>
				<DropdownMenu.Item
					class="gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent flex cursor-pointer items-center"
					onclick={onStartRename}
				>
					<Pencil size={14} />
					Rename
				</DropdownMenu.Item>
				<DropdownMenu.Item
					class="gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent flex cursor-pointer items-center"
					onclick={onDownload}
				>
					<Download size={14} />
					Download
				</DropdownMenu.Item>
				<DropdownMenu.Separator class="my-1 bg-border h-px" />
				<DropdownMenu.Item
					class="gap-2 rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10 flex cursor-pointer items-center"
					onclick={onDelete}
				>
					<Trash2 size={14} />
					Delete
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Portal>
	</DropdownMenu.Root>
</Sidebar.MenuItem>
