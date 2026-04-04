<script lang="ts">
	import * as Sidebar from '@/view/primitives/sidebar';
	import * as DropdownMenu from '@/view/primitives/dropdown-menu';
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
	class={isDragging ? 'document-item-dragging' : undefined}
>
	<Sidebar.MenuButton
		isActive={false}
		tooltipContent={file.name}
		class={`document-item-button ${indent ? 'document-item-button-indented' : 'document-item-button-root'}`}
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
		<DropdownMenu.Trigger class="document-item-menu-trigger" onclick={(e) => e.stopPropagation()}>
			<EllipsisVertical size={14} />
		</DropdownMenu.Trigger>
		<DropdownMenu.Portal>
			<DropdownMenu.Content align="start" side="right" class="document-item-menu-content">
				<DropdownMenu.Item class="document-item-menu-action" onclick={onOpen}>
					<FileText size={14} />
					Open
				</DropdownMenu.Item>
				<DropdownMenu.Item class="document-item-menu-action" onclick={onAddToChat}>
					<MessageCircle size={14} />
					Add to chat
				</DropdownMenu.Item>
				<DropdownMenu.Item class="document-item-menu-action" onclick={onStartRename}>
					<Pencil size={14} />
					Rename
				</DropdownMenu.Item>
				<DropdownMenu.Item class="document-item-menu-action" onclick={onDownload}>
					<Download size={14} />
					Download
				</DropdownMenu.Item>
				<DropdownMenu.Separator class="document-item-menu-separator" />
				<DropdownMenu.Item
					class="document-item-menu-action document-item-menu-action-destructive"
					onclick={onDelete}
				>
					<Trash2 size={14} />
					Delete
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Portal>
	</DropdownMenu.Root>
</Sidebar.MenuItem>

<style>
	:global(.document-item-dragging) {
		opacity: 0.5;
	}

	:global(.document-item-button) {
		cursor: default;
		border-radius: 0.5rem;
		padding-top: 0.5rem;
		padding-bottom: 0.5rem;
		padding-right: 0.75rem;
	}

	:global(.document-item-button-root) {
		padding-left: 2rem;
	}

	:global(.document-item-button-indented) {
		padding-left: 3rem;
	}

	:global(li[data-sidebar='menu-item']:hover .document-item-button),
	:global(li[data-sidebar='menu-item'][data-state='open'] .document-item-button) {
		background: var(--sidebar-surface-tint);
		color: var(--sidebar-surface-tint-foreground);
	}

	:global(.document-item-menu-trigger) {
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

	:global(li[data-sidebar='menu-item']:hover .document-item-menu-trigger),
	:global(.document-item-menu-trigger[data-state='open']) {
		opacity: 1;
	}

	:global(.document-item-menu-trigger:hover) {
		background: var(--sidebar-surface-tint);
		color: var(--sidebar-icon-strong);
	}

	:global(.document-item-menu-trigger:focus-visible) {
		box-shadow: 0 0 0 2px var(--focus-ring-color);
	}

	:global(.document-item-menu-content) {
		z-index: 50;
		min-width: var(--dropdown-min-w);
		padding: 0.25rem;
		border: 1px solid var(--surface-floating-border);
		border-radius: 0.5rem;
		background: var(--surface-floating);
		color: var(--surface-floating-foreground);
		box-shadow: var(--surface-floating-shadow);
	}

	:global(.document-item-menu-action) {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.5rem;
		border-radius: 0.375rem;
		cursor: pointer;
	}

	:global(.document-item-menu-action:hover) {
		background: var(--surface-tint);
	}

	:global(.document-item-menu-action-destructive) {
		color: hsl(var(--destructive));
	}

	:global(.document-item-menu-action-destructive:hover) {
		background: var(--surface-tint);
	}

	:global(.document-item-menu-separator) {
		height: 1px;
		margin: 0.25rem 0;
		background: var(--border-color);
	}
</style>
