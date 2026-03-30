<script lang="ts">
	import * as Sidebar from '@/view/components/shadcn/ui/sidebar';
	import * as DropdownMenu from '@/view/components/shadcn/ui/dropdown-menu';
	import * as app from '@/app';
	import InlineRenameInput from './InlineRenameInput.svelte';

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
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				class="shrink-0"
			>
				<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
			</svg>
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
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				class="shrink-0"
			>
				<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
			</svg>
			<span class="sidebar-fade-text">{chat.name}</span>
		</Sidebar.MenuButton>
	{/if}
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
					onclick={onStartRename}
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
					onclick={onDownload}
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
				{#if canDelete}
					<DropdownMenu.Separator class="my-1 bg-border h-px" />
					<DropdownMenu.Item
						class="gap-2 rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10 flex cursor-pointer items-center"
						onclick={onDelete}
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
