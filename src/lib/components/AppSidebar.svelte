<script lang="ts">
	import { tick } from 'svelte';
	import * as Sidebar from '@/components/ui/sidebar/index.js';
	import * as Tooltip from '@/components/ui/tooltip/index.js';
	import * as DropdownMenu from '@/components/ui/dropdown-menu/index.js';
	import * as AlertDialog from '@/components/ui/alert-dialog/index.js';
	import { toast } from 'svelte-sonner';
	import type { ChatSession, ChatFolder } from '$lib/chat/tree';
	import { useSidebar } from '@/components/ui/sidebar/context.svelte.js';
	import logoDark from '../../assets/logo_dark.svg';
	import logoLight from '../../assets/logo_light.svg';

	interface Props {
		sessions: ChatSession[];
		activeSessionIndex: number;
		onSelectSession: (index: number) => void;
		onNewChat: () => void;
		onDeleteSession: (index: number) => void;
		folders: ChatFolder[];
		onNewFolder: () => string;
		onDeleteFolder: (folderId: string) => void;
		onRenameFolder: (folderId: string, name: string) => boolean;
		onMoveSessionToFolder: (sessionIndex: number, folderId: string | null) => void;
		activeDocKey: { folderId: string; fileId: string } | null;
		onUploadDoc: (folderId: string) => void;
		onSelectDoc: (folderId: string, fileId: string) => void;
		onDeleteDoc: (folderId: string, fileId: string) => void;
	}

	let {
		sessions,
		activeSessionIndex,
		onSelectSession,
		onNewChat,
		onDeleteSession,
		folders,
		onNewFolder,
		onDeleteFolder,
		onRenameFolder,
		onMoveSessionToFolder,
		activeDocKey,
		onUploadDoc,
		onSelectDoc,
		onDeleteDoc
	}: Props = $props();

	const sidebar = useSidebar();

	let logoHovered = $state(false);
	let expandedFolders: Record<string, boolean> = $state({});
	let editingFolderId: string | null = $state(null);
	let editingFolderName = $state('');

	function toggleFolder(folderId: string) {
		expandedFolders = { ...expandedFolders, [folderId]: !expandedFolders[folderId] };
	}

	let deleteFolderTarget: ChatFolder | null = $state(null);

	async function startRenameFolder(folder: ChatFolder) {
		editingFolderId = folder.id;
		editingFolderName = folder.name;
		await tick();
		const input = document.querySelector<HTMLInputElement>('[data-rename-folder-input]');
		input?.focus();
		input?.select();
	}

	function commitRenameFolder() {
		if (editingFolderId && editingFolderName.trim()) {
			const ok = onRenameFolder(editingFolderId, editingFolderName.trim());
			if (!ok) {
				toast.error(`A folder named "${editingFolderName.trim()}" already exists`);
				return;
			}
		}
		editingFolderId = null;
		editingFolderName = '';
	}

	async function handleNewFolder() {
		const id = onNewFolder();
		expandedFolders = { ...expandedFolders, [id]: true };
		const folder = folders.find((f) => f.id === id);
		if (folder) {
			editingFolderId = id;
			editingFolderName = folder.name;
			await tick();
			const input = document.querySelector<HTMLInputElement>('[data-rename-folder-input]');
			input?.focus();
			input?.select();
		}
	}

	function sessionsInFolder(folderId: string): { session: ChatSession; index: number }[] {
		return sessions
			.map((s, i) => ({ session: s, index: i }))
			.filter(({ session }) => session.folderId === folderId);
	}

	let unfolderedSessions = $derived(
		sessions.map((s, i) => ({ session: s, index: i })).filter(({ session }) => !session.folderId)
	);
</script>

<Sidebar.Root collapsible="icon">
	<Sidebar.Header class="p-0">
		<!-- Logo / trigger area -->
		<div
			class="h-14 px-3 flex items-center group-data-[state=collapsed]:justify-center"
			role="button"
			tabindex={-1}
			onmouseenter={() => (logoHovered = true)}
			onmouseleave={() => (logoHovered = false)}
		>
			{#if sidebar.state === 'collapsed'}
				<!-- Collapsed: show logo, on hover show expand icon -->
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<button
								{...props}
								class="rounded-lg hover:bg-sidebar-accent flex cursor-e-resize items-center justify-center overflow-hidden transition-colors"
								onclick={() => sidebar.toggle()}
								aria-label="Open sidebar"
							>
								{#if logoHovered}
									<!-- Expand sidebar icon (panel-left-open style) -->
									<svg
										width="20"
										height="20"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="1.5"
										stroke-linecap="round"
										stroke-linejoin="round"
										class="text-sidebar-foreground"
									>
										<rect x="3" y="3" width="18" height="18" rx="2" />
										<path d="M9 3v18" />
										<path d="M14 9l3 3-3 3" />
									</svg>
								{:else}
									<img src={logoLight} alt="Powerset" class="h-full w-full object-contain" />
								{/if}
							</button>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content side="right" class="bg-neutral-900 text-white text-xs border-none">
						Open sidebar
					</Tooltip.Content>
				</Tooltip.Root>
			{:else}
				<!-- Expanded: logo + title + collapse trigger -->
				<div class="gap-2 min-w-0 flex flex-1 items-center">
					<img src={logoDark} alt="Powerset" width="20" height="20" class="shrink-0" />
					<span class="text-sm font-semibold text-sidebar-foreground truncate">Superset</span>
				</div>
				<Sidebar.Trigger />
			{/if}
		</div>
	</Sidebar.Header>

	<Sidebar.Content class="px-2">
		<!-- New chat -->
		<Sidebar.Group class="p-0">
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							size="default"
							tooltipContent="New chat"
							onclick={onNewChat}
							class="rounded-lg px-3 py-2"
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
								class="shrink-0"
							>
								<path d="M12 20h9" />
								<path
									d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"
								/>
							</svg>
							<span>New chat</span>
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>

		{#if sidebar.state === 'expanded'}
			<Sidebar.Separator class="my-2 bg-sidebar-border" />

			<!-- Chat list (unfoldered) -->
			<Sidebar.Group class="p-0">
				<Sidebar.GroupLabel class="px-3 text-xs text-sidebar-foreground/50 mb-1">
					Chats
				</Sidebar.GroupLabel>
				<Sidebar.GroupContent>
					<Sidebar.Menu>
						{#each unfolderedSessions as { session, index } (session.id)}
							<Sidebar.MenuItem>
								<Sidebar.MenuButton
									isActive={index === activeSessionIndex}
									tooltipContent={session.name}
									onclick={() => onSelectSession(index)}
									class="rounded-lg px-3 py-2"
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
									<span>{session.name}</span>
								</Sidebar.MenuButton>
								{#if sessions.length > 1}
									<Sidebar.MenuAction
										showOnHover
										onclick={(e: MouseEvent) => {
											e.stopPropagation();
											onDeleteSession(index);
										}}
										aria-label="Delete chat"
										class="text-sidebar-foreground/40 hover:text-sidebar-foreground"
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
											<path d="M18 6L6 18M6 6l12 12" />
										</svg>
									</Sidebar.MenuAction>
								{/if}
							</Sidebar.MenuItem>
						{/each}
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>

			<Sidebar.Separator class="my-2 bg-sidebar-border" />

			<!-- New folder -->
			<Sidebar.Group class="p-0">
				<Sidebar.GroupContent>
					<Sidebar.Menu>
						<Sidebar.MenuItem>
							<Sidebar.MenuButton
								size="default"
								tooltipContent="New folder"
								onclick={handleNewFolder}
								class="rounded-lg px-3 py-2"
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
									class="shrink-0"
								>
									<path d="M12 10v6M9 13h6" />
									<path
										d="M2 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"
									/>
								</svg>
								<span>New folder</span>
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>

			<!-- Folders list -->
			{#if folders.length > 0}
				<Sidebar.Group class="p-0 mt-1">
					<Sidebar.GroupLabel class="px-3 text-xs text-sidebar-foreground/50 mb-1">
						Folders
					</Sidebar.GroupLabel>
					<Sidebar.GroupContent>
						<Sidebar.Menu>
							{#each folders as folder (folder.id)}
								<Sidebar.MenuItem>
									<Sidebar.MenuButton
										onclick={() => toggleFolder(folder.id)}
										class="rounded-lg px-3 py-2 group-hover/menu-item:bg-sidebar-accent group-hover/menu-item:text-sidebar-accent-foreground group-has-data-[state=open]/menu-item:bg-sidebar-accent group-has-data-[state=open]/menu-item:text-sidebar-accent-foreground"
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
											style:transform={expandedFolders[folder.id]
												? 'rotate(90deg)'
												: 'rotate(0deg)'}
										>
											<path d="M9 6l6 6-6 6" />
										</svg>
										{#if editingFolderId === folder.id}
											<!-- svelte-ignore a11y_autofocus -->
											<input
												type="text"
												data-rename-folder-input
												bind:value={editingFolderName}
												onblur={commitRenameFolder}
												onkeydown={(e) => {
													if (e.key === 'Enter') commitRenameFolder();
													if (e.key === 'Escape') {
														editingFolderId = null;
														editingFolderName = '';
													}
												}}
												autofocus
												class="text-sm text-sidebar-foreground w-full border-none bg-transparent outline-none"
											/>
										{:else}
											<span
												ondblclick={(e) => {
													e.stopPropagation();
													startRenameFolder(folder);
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
													onclick={() => onUploadDoc(folder.id)}
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
													onclick={() => startRenameFolder(folder)}
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
												<DropdownMenu.Separator class="my-1 bg-border h-px" />
												<DropdownMenu.Item
													class="gap-2 rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10 flex cursor-pointer items-center"
													onclick={() => (deleteFolderTarget = folder)}
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

								<!-- Folder contents -->
								{#if expandedFolders[folder.id]}
									{@const folderSessions = sessionsInFolder(folder.id)}
									{#each folderSessions as { session, index } (session.id)}
										<Sidebar.MenuItem>
											<Sidebar.MenuButton
												isActive={index === activeSessionIndex}
												tooltipContent={session.name}
												onclick={() => onSelectSession(index)}
												class="rounded-lg pl-8 pr-3 py-2"
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
												<span>{session.name}</span>
											</Sidebar.MenuButton>
											{#if sessions.length > 1}
												<Sidebar.MenuAction
													showOnHover
													onclick={(e: MouseEvent) => {
														e.stopPropagation();
														onMoveSessionToFolder(index, null);
													}}
													aria-label="Remove from folder"
													class="text-sidebar-foreground/40 hover:text-sidebar-foreground"
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
														<path d="M18 6L6 18M6 6l12 12" />
													</svg>
												</Sidebar.MenuAction>
											{/if}
										</Sidebar.MenuItem>
									{/each}
									{#each folder.files ?? [] as file (file.id)}
										<Sidebar.MenuItem>
											<Sidebar.MenuButton
												isActive={activeDocKey?.folderId === folder.id &&
													activeDocKey?.fileId === file.id}
												tooltipContent={file.name}
												onclick={() => onSelectDoc(folder.id, file.id)}
												class="rounded-lg pl-8 pr-3 py-2 group-hover/menu-item:bg-sidebar-accent group-hover/menu-item:text-sidebar-accent-foreground"
											>
												<svg
													width="16"
													height="16"
													viewBox="0 0 16 16"
													fill="none"
													stroke="currentColor"
													stroke-width="1.5"
													class="shrink-0"
												>
													<path d="M3 2h7l3 3v9H3V2z" />
													<path d="M10 2v3h3" />
												</svg>
												<span>{file.name}</span>
											</Sidebar.MenuButton>
											<Sidebar.MenuAction
												showOnHover
												onclick={(e: MouseEvent) => {
													e.stopPropagation();
													onDeleteDoc(folder.id, file.id);
												}}
												aria-label="Delete document"
												class="text-sidebar-foreground/40 hover:text-sidebar-foreground"
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
													<path d="M18 6L6 18M6 6l12 12" />
												</svg>
											</Sidebar.MenuAction>
										</Sidebar.MenuItem>
									{/each}
									{#if folderSessions.length === 0 && (folder.files ?? []).length === 0}
										<div class="px-8 py-1 text-xs text-sidebar-foreground/30">Empty</div>
									{/if}
								{/if}
							{/each}
						</Sidebar.Menu>
					</Sidebar.GroupContent>
				</Sidebar.Group>
			{/if}
		{/if}
	</Sidebar.Content>

	<Sidebar.Rail />
</Sidebar.Root>

<AlertDialog.Root
	open={!!deleteFolderTarget}
	onOpenChange={(open) => {
		if (!open) deleteFolderTarget = null;
	}}
>
	<AlertDialog.Portal>
		<AlertDialog.Overlay class="inset-0 bg-black/50 fixed z-50" />
		<AlertDialog.Content
			class="max-w-md rounded-xl bg-background p-6 shadow-lg fixed top-1/2 left-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2 border"
		>
			<AlertDialog.Header>
				<AlertDialog.Title class="text-lg font-semibold">Delete folder</AlertDialog.Title>
				<AlertDialog.Description class="text-sm text-muted-foreground mt-2">
					Are you sure you want to delete "{deleteFolderTarget?.name}"? This will remove the folder
					and all its documents. Chats will be moved out of the folder.
				</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer class="mt-6 gap-2 flex justify-end">
				<AlertDialog.Cancel class="rounded-lg px-4 py-2 text-sm hover:bg-muted border"
					>Cancel</AlertDialog.Cancel
				>
				<AlertDialog.Action
					class="rounded-lg bg-destructive px-4 py-2 text-sm text-destructive-foreground hover:bg-destructive/90"
					onclick={() => {
						if (deleteFolderTarget) {
							onDeleteFolder(deleteFolderTarget.id);
							toast.success(`Deleted "${deleteFolderTarget.name}"`);
						}
						deleteFolderTarget = null;
					}}
				>
					Delete
				</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Portal>
</AlertDialog.Root>
