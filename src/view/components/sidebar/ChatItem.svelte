<script lang="ts">
	import * as Sidebar from '@/view/primitives/shadcn/ui/sidebar';
	import * as DropdownMenu from '@/view/primitives/shadcn/ui/dropdown-menu';
	import * as app from '@/app';
	import InlineRenameInput from '@/view/primitives/inline-rename-input/InlineRenameInput.svelte';
	import MessageSquare from 'lucide-svelte/icons/message-square';
	import Ellipsis from 'lucide-svelte/icons/ellipsis';
	import Pencil from 'lucide-svelte/icons/pencil';
	import Download from 'lucide-svelte/icons/download';
	import Trash2 from 'lucide-svelte/icons/trash-2';

	interface Props {
		chat: app.chat.Chat;
		isActive: boolean;
		isEditing: boolean;
		editingName: string;
		canDelete: boolean;
		indented?: boolean;
		onSelect: () => void;
		onStartRename: () => void;
		onCommitRename: (name: string) => void;
		onCancelRename: () => void;
		onDownload: () => void;
		onDelete: () => void;
	}

	let {
		chat,
		isActive,
		isEditing,
		editingName = $bindable(),
		canDelete,
		indented = false,
		onSelect,
		onStartRename,
		onCommitRename,
		onCancelRename,
		onDownload,
		onDelete
	}: Props = $props();
</script>

<Sidebar.MenuItem>
	{#if isEditing}
		<div
			class="flex w-full items-center gap-2 overflow-hidden rounded-lg p-2 text-left text-sm ring-sidebar-ring {indented
				? 'pr-3 pl-8'
				: 'px-3'} py-2"
		>
			<MessageSquare size={16} class="shrink-0" />
			<InlineRenameInput
				bind:value={editingName}
				onCommit={onCommitRename}
				onCancel={onCancelRename}
			/>
		</div>
	{:else}
		<Sidebar.MenuButton
			{isActive}
			tooltipContent={chat.name}
			onclick={onSelect}
			class="rounded-lg {indented
				? 'pr-3 pl-8'
				: 'px-3'} py-2 group-hover/menu-item:bg-sidebar-accent group-hover/menu-item:text-sidebar-accent-foreground group-has-data-[state=open]/menu-item:bg-sidebar-accent group-has-data-[state=open]/menu-item:text-sidebar-accent-foreground"
		>
			<MessageSquare size={16} class="shrink-0" />
			<span class="sidebar-fade-text">{chat.name}</span>
		</Sidebar.MenuButton>
	{/if}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger
			class="absolute top-1/2 right-1 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-sidebar-foreground/40 opacity-0 transition-opacity group-hover/menu-item:opacity-100 hover:text-sidebar-foreground data-[state=open]:opacity-100"
			onclick={(e) => e.stopPropagation()}
		>
			<Ellipsis size={14} />
		</DropdownMenu.Trigger>
		<DropdownMenu.Portal>
			<DropdownMenu.Content
				align="start"
				side="right"
				class="z-50 min-w-(--dropdown-min-w) rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
			>
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
				{#if canDelete}
					<DropdownMenu.Separator class="my-1 h-px bg-border" />
					<DropdownMenu.Item
						class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
						onclick={onDelete}
					>
						<Trash2 size={14} />
						Delete
					</DropdownMenu.Item>
				{/if}
			</DropdownMenu.Content>
		</DropdownMenu.Portal>
	</DropdownMenu.Root>
</Sidebar.MenuItem>

<style>
	.sidebar-fade-text {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	:global(.group\/menu-item:hover) .sidebar-fade-text {
		text-overflow: clip;
		mask-image: linear-gradient(to right, black 40%, transparent 85%) !important;
		-webkit-mask-image: linear-gradient(to right, black 40%, transparent 85%) !important;
	}
</style>
