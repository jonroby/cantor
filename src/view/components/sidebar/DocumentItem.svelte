<script lang="ts">
	import * as Sidebar from '@/view/primitives/shadcn/ui/sidebar';
	import * as DropdownMenu from '@/view/primitives/shadcn/ui/dropdown-menu';
	import InlineRenameInput from '@/view/primitives/inline-rename-input/InlineRenameInput.svelte';
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
		class="cursor-default rounded-lg py-2 pr-3 group-hover/menu-item:bg-sidebar-accent group-hover/menu-item:text-sidebar-accent-foreground group-has-data-[state=open]/menu-item:bg-sidebar-accent group-has-data-[state=open]/menu-item:text-sidebar-accent-foreground {indent
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
			class="absolute top-1/2 right-1 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-sidebar-foreground/40 opacity-0 transition-opacity group-hover/menu-item:opacity-100 hover:text-sidebar-foreground data-[state=open]:opacity-100"
			onclick={(e) => e.stopPropagation()}
		>
			<EllipsisVertical size={14} />
		</DropdownMenu.Trigger>
		<DropdownMenu.Portal>
			<DropdownMenu.Content
				align="start"
				side="right"
				class="z-50 min-w-[140px] rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
			>
				<DropdownMenu.Item
					class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
					onclick={onOpen}
				>
					<FileText size={14} />
					Open
				</DropdownMenu.Item>
				<DropdownMenu.Item
					class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
					onclick={onAddToChat}
				>
					<MessageCircle size={14} />
					Add to chat
				</DropdownMenu.Item>
				<DropdownMenu.Item
					class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
					onclick={onStartRename}
				>
					<Pencil size={14} />
					Rename
				</DropdownMenu.Item>
				<DropdownMenu.Item
					class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
					onclick={onDownload}
				>
					<Download size={14} />
					Download
				</DropdownMenu.Item>
				<DropdownMenu.Separator class="my-1 h-px bg-border" />
				<DropdownMenu.Item
					class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
					onclick={onDelete}
				>
					<Trash2 size={14} />
					Delete
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Portal>
	</DropdownMenu.Root>
</Sidebar.MenuItem>
