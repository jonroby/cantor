<script lang="ts">
	import * as Sidebar from '@/view/primitives/sidebar';
	import * as DropdownMenu from '@/view/primitives/dropdown-menu';
	import * as app from '@/app';
	import InlineRenameInput from '@/view/primitives/inline-rename-input/InlineRenameInput.svelte';
	import MessageSquare from 'lucide-svelte/icons/message-square';
	import EllipsisVertical from 'lucide-svelte/icons/ellipsis-vertical';
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
	<Sidebar.MenuButton
		{isActive}
		tooltipContent={chat.name}
		onclick={onSelect}
		class={`chat-item-button ${indented ? 'chat-item-button-indented' : 'chat-item-button-root'}`}
	>
		<MessageSquare size={16} class="shrink-0" />
		{#if isEditing}
			<InlineRenameInput
				bind:value={editingName}
				onCommit={onCommitRename}
				onCancel={onCancelRename}
			/>
		{:else}
			<span data-chat-label>{chat.name}</span>
		{/if}
	</Sidebar.MenuButton>
	{#if !isEditing}
		<DropdownMenu.Root>
			<DropdownMenu.Trigger class="chat-item-menu-trigger" onclick={(e) => e.stopPropagation()}>
				<EllipsisVertical size={18} />
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content align="start" side="right" class="item-menu-content">
					<DropdownMenu.Item class="item-menu-action" onclick={onStartRename}>
						<Pencil size={14} />
						Rename
					</DropdownMenu.Item>
					<DropdownMenu.Item class="item-menu-action" onclick={onDownload}>
						<Download size={14} />
						Download
					</DropdownMenu.Item>
					{#if canDelete}
						<DropdownMenu.Separator class="item-menu-separator" />
						<DropdownMenu.Item
							class="item-menu-action item-menu-action-destructive"
							onclick={onDelete}
						>
							<Trash2 size={14} />
							Delete
						</DropdownMenu.Item>
					{/if}
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>
	{/if}
</Sidebar.MenuItem>

<style>
	:global([data-chat-label]) {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	:global(.chat-item-button) {
		border-radius: 0.5rem;
		padding-top: 0.5rem;
		padding-bottom: 0.5rem;
	}

	:global(.chat-item-button-root) {
		padding-left: 1.5rem;
		padding-right: 0.75rem;
	}

	:global(.chat-item-button-indented) {
		padding-left: 2rem;
		padding-right: 0.75rem;
	}

	:global(li[data-sidebar='menu-item']:hover .chat-item-button),
	:global(li[data-sidebar='menu-item']:has([data-state='open']) .chat-item-button),
	:global(
		li[data-sidebar='menu-item']:has(.bits-sidebar-menu-button[data-active='true'])
			.chat-item-button
	) {
		background: var(--sidebar-surface-tint);
		color: var(--sidebar-surface-tint-foreground);
		padding-right: 2.25rem;
	}

	:global(.chat-item-menu-trigger) {
		position: absolute;
		top: 50%;
		right: 0.25rem;
		display: flex;
		height: 2rem;
		width: 2rem;
		align-items: center;
		justify-content: center;
		transform: translateY(-50%);
		border: none;
		border-radius: 0.375rem;
		background: transparent;
		color: var(--sidebar-icon-muted);
		opacity: 0;
		outline: none;
		cursor: pointer;
		transition:
			opacity 120ms ease,
			color 120ms ease,
			background 120ms ease;
	}

	:global(li[data-sidebar='menu-item']:hover .chat-item-menu-trigger),
	:global(
		li[data-sidebar='menu-item']:has(.bits-sidebar-menu-button[data-active='true'])
			.chat-item-menu-trigger
	),
	:global(li[data-sidebar='menu-item']:has([data-state='open']) .chat-item-menu-trigger) {
		opacity: 1;
	}

	:global(.chat-item-menu-trigger:hover),
	:global(.chat-item-menu-trigger:active) {
		background: var(--sidebar-surface-tint);
		color: var(--sidebar-icon-strong);
		cursor: pointer;
	}

	:global(.chat-item-menu-trigger:focus-visible) {
		box-shadow: 0 0 0 2px var(--focus-ring-color);
	}

	:global(.item-menu-content) {
		z-index: 50;
		min-width: var(--dropdown-min-w);
		padding: 0.375rem;
		border: 1px solid var(--surface-floating-border);
		border-radius: 0.75rem;
		background: var(--surface-floating);
		color: var(--surface-floating-foreground);
		box-shadow: var(--surface-floating-shadow);
	}

	:global(.item-menu-action) {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		cursor: pointer;
	}

	:global(.item-menu-action:hover) {
		background: var(--surface-tint);
	}

	:global(.item-menu-action-destructive) {
		color: hsl(var(--destructive));
	}

	:global(.item-menu-action-destructive:hover) {
		background: var(--surface-tint);
	}

	:global(.item-menu-separator) {
		height: 1px;
		margin: 0.25rem 0;
		background: var(--border-color);
	}
</style>
