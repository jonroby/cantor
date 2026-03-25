<script lang="ts">
	import * as Sidebar from '@/components/ui/sidebar/index.js';
	import * as Tooltip from '@/components/ui/tooltip/index.js';
	import type { ChatSession } from '$lib/chat/tree';
	import { useSidebar } from '@/components/ui/sidebar/context.svelte.js';

	interface Props {
		sessions: ChatSession[];
		activeSessionIndex: number;
		onSelectSession: (index: number) => void;
		onNewChat: () => void;
		onDeleteSession: (index: number) => void;
	}

	let { sessions, activeSessionIndex, onSelectSession, onNewChat, onDeleteSession }: Props =
		$props();

	const sidebar = useSidebar();

	let logoHovered = $state(false);
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
								class="w-8 h-8 rounded-lg hover:bg-sidebar-accent flex cursor-e-resize items-center justify-center transition-colors"
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
									<!-- Logo placeholder -->
									<svg
										width="20"
										height="20"
										viewBox="0 0 24 24"
										fill="none"
										class="text-sidebar-foreground"
									>
										<path d="M12 2L2 7l10 5 10-5-10-5Z" fill="currentColor" opacity="0.8" />
										<path
											d="M2 17l10 5 10-5"
											stroke="currentColor"
											stroke-width="1.5"
											stroke-linecap="round"
											stroke-linejoin="round"
										/>
										<path
											d="M2 12l10 5 10-5"
											stroke="currentColor"
											stroke-width="1.5"
											stroke-linecap="round"
											stroke-linejoin="round"
										/>
									</svg>
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
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						class="text-sidebar-foreground shrink-0"
					>
						<path d="M12 2L2 7l10 5 10-5-10-5Z" fill="currentColor" opacity="0.8" />
						<path
							d="M2 17l10 5 10-5"
							stroke="currentColor"
							stroke-width="1.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
						<path
							d="M2 12l10 5 10-5"
							stroke="currentColor"
							stroke-width="1.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
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

			<!-- Chat list -->
			<Sidebar.Group class="p-0">
				<Sidebar.GroupLabel class="px-3 text-xs text-sidebar-foreground/50 mb-1">
					Chats
				</Sidebar.GroupLabel>
				<Sidebar.GroupContent>
					<Sidebar.Menu>
						{#each sessions as session, index (session.id)}
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
		{/if}
	</Sidebar.Content>

	<Sidebar.Rail />
</Sidebar.Root>
