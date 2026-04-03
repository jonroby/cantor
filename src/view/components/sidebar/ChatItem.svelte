<script lang="ts">
	import * as Sidebar from '@/view/primitives/sidebar';
	import * as DropdownMenu from '@/view/primitives/dropdown-menu';
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
		<div class="chat-item-editing" class:chat-item-indented={indented}>
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
			class={`chat-item-button ${indented ? 'chat-item-button-indented' : 'chat-item-button-root'}`}
		>
			<MessageSquare size={16} class="shrink-0" />
			<span class="chat-item-label">{chat.name}</span>
		</Sidebar.MenuButton>
	{/if}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger class="chat-item-menu-trigger" onclick={(e) => e.stopPropagation()}>
			<Ellipsis size={14} />
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
</Sidebar.MenuItem>

<style>
	.chat-item-editing {
		display: flex;
		width: 100%;
		align-items: center;
		gap: 0.5rem;
		overflow: hidden;
		border-radius: 0.5rem;
		padding: 0.5rem 0.75rem;
		text-align: left;
		font-size: var(--text-sm);
	}

	.chat-item-indented {
		padding-left: 2rem;
		padding-right: 0.75rem;
	}

	.chat-item-label {
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
		padding-left: 0.75rem;
		padding-right: 0.75rem;
	}

	:global(.chat-item-button-indented) {
		padding-left: 2rem;
		padding-right: 0.75rem;
	}

	:global(li[data-sidebar='menu-item']:hover .chat-item-button),
	:global(li[data-sidebar='menu-item'][data-state='open'] .chat-item-button) {
		background: hsl(var(--sidebar-accent));
		color: hsl(var(--sidebar-accent-foreground));
	}

	:global(li[data-sidebar='menu-item']:hover .chat-item-label) {
		text-overflow: clip;
		mask-image: linear-gradient(to right, black 40%, transparent 85%);
		-webkit-mask-image: linear-gradient(to right, black 40%, transparent 85%);
	}

	:global(.chat-item-menu-trigger) {
		position: absolute;
		top: 50%;
		right: 0.25rem;
		display: flex;
		height: 1.5rem;
		width: 1.5rem;
		align-items: center;
		justify-content: center;
		transform: translateY(-50%);
		border-radius: 0.375rem;
		color: hsl(var(--sidebar-foreground) / 0.4);
		opacity: 0;
		transition:
			opacity 120ms ease,
			color 120ms ease;
	}

	:global(li[data-sidebar='menu-item']:hover .chat-item-menu-trigger),
	:global(.chat-item-menu-trigger[data-state='open']) {
		opacity: 1;
	}

	:global(.chat-item-menu-trigger:hover) {
		color: hsl(var(--sidebar-foreground));
	}

	:global(.item-menu-content) {
		z-index: 50;
		min-width: var(--dropdown-min-w);
		padding: 0.25rem;
		border: 1px solid hsl(var(--border));
		border-radius: 0.5rem;
		background: hsl(var(--popover));
		color: hsl(var(--popover-foreground));
		box-shadow: 0 10px 24px hsl(var(--foreground) / 0.12);
	}

	:global(.item-menu-action) {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.5rem;
		border-radius: 0.375rem;
		font-size: var(--text-sm);
		cursor: pointer;
	}

	:global(.item-menu-action:hover) {
		background: hsl(var(--accent));
	}

	:global(.item-menu-action-destructive) {
		color: hsl(var(--destructive));
	}

	:global(.item-menu-action-destructive:hover) {
		background: hsl(var(--destructive) / 0.1);
	}

	:global(.item-menu-separator) {
		height: 1px;
		margin: 0.25rem 0;
		background: hsl(var(--border));
	}
</style>
