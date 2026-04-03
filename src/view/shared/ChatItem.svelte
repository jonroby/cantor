<script lang="ts">
	import * as Sidebar from '@/view/components/shadcn/ui/sidebar';
	import * as DropdownMenu from '@/view/components/shadcn/ui/dropdown-menu';
	import * as app from '@/app';
	import InlineRenameInput from './InlineRenameInput.svelte';
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
			class="ring-sidebar-ring gap-2 rounded-lg p-2 text-sm flex w-full items-center overflow-hidden text-left {indented
				? 'pl-8 pr-3'
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
				? 'pl-8 pr-3'
				: 'px-3'} py-2 group-hover/menu-item:bg-sidebar-accent group-hover/menu-item:text-sidebar-accent-foreground group-has-data-[state=open]/menu-item:bg-sidebar-accent group-has-data-[state=open]/menu-item:text-sidebar-accent-foreground"
		>
			<MessageSquare size={16} class="shrink-0" />
			<span class="sidebar-fade-text">{chat.name}</span>
		</Sidebar.MenuButton>
	{/if}
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
				{#if canDelete}
					<DropdownMenu.Separator class="my-1 bg-border h-px" />
					<DropdownMenu.Item
						class="gap-2 rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10 flex cursor-pointer items-center"
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
