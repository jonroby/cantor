<script lang="ts">
	import { Document as DocumentComponent, DocToc } from '@/view/components/document';
	import * as app from '@/app';
	import {
		Folder,
		ChevronDown,
		File,
		X,
		ArrowLeftRight,
		Download,
		Pencil,
		Save,
		RotateCcw,
		Check
	} from 'lucide-svelte';
	import { Header } from '@/view/primitives';
	import * as Tooltip from '@/view/primitives/tooltip';

	interface Props {
		folderId: string;
		folderName: string;
		showToc?: boolean;
		files: app.documents.DocumentFile[];
		activeFileId: string | null;
		agentStreaming?: boolean;
		agentProvider?: app.providers.Provider | null;
		pendingContent?: string | null;
		onAcceptPending?: () => void;
		onRejectPending?: () => void;
		onSwap?: () => void;
		onClose: () => void;
		onSelectFile?: (fileId: string) => void;
		onContentChange?: (content: string) => void;
		resolveAsset?: (name: string) => string | null;
	}

	let {
		folderId: _folderId,
		folderName,
		showToc = false,
		files,
		activeFileId,
		agentStreaming = false,
		agentProvider,
		pendingContent = null,
		onAcceptPending,
		onRejectPending,
		onSwap,
		onClose,
		onSelectFile,
		onContentChange,
		resolveAsset
	}: Props = $props();

	let activeFile = $derived(files.find((f) => f.id === activeFileId) ?? null);
	let dropdownOpen = $state(false);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let documentRef: any = $state(null);
	let editing = $derived(documentRef?.isEditing() ?? false);
	let dirty = $derived(documentRef?.isDirty() ?? false);
	let scrollEl = $derived(documentRef?.getScrollEl() ?? null);

	function selectFile(fileId: string) {
		onSelectFile?.(fileId);
		dropdownOpen = false;
	}
</script>

<div class="folderview-shell">
	<Header class="folderview-header">
		<div class="folderview-header-left">
			<Folder size={16} />
			<span class="folderview-folder-name">{folderName}</span>
			<span class="folderview-separator">/</span>
			<div class="folderview-file-picker">
				<button class="folderview-file-btn" onclick={() => (dropdownOpen = !dropdownOpen)}>
					{activeFile?.name ?? 'No files'}
					<span class="folderview-chevron" class:folderview-chevron-open={dropdownOpen}>
						<ChevronDown size={12} />
					</span>
				</button>
				{#if dropdownOpen}
					<button
						type="button"
						class="folderview-dropdown-scrim"
						aria-label="Close dropdown"
						onclick={() => (dropdownOpen = false)}
					></button>
					<div class="folderview-dropdown">
						{#each files as file (file.id)}
							<button
								class="folderview-dropdown-item"
								class:folderview-dropdown-item-active={file.id === activeFileId}
								onclick={() => selectFile(file.id)}
							>
								<File size={14} />
								{file.name}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>
		<Tooltip.Provider>
		<div class="folderview-header-actions">
			{#if pendingContent != null}
				<button class="diff-btn diff-accept" onclick={onAcceptPending}>Accept</button>
				<button class="diff-btn diff-reject" onclick={onRejectPending}>Reject</button>
			{/if}
			{#if onSwap}
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<button {...props} class="folderview-header-btn" onclick={onSwap}>
								<ArrowLeftRight size={14} />
							</button>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content>Swap panels</Tooltip.Content>
				</Tooltip.Root>
			{/if}
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<button {...props} class="folderview-header-btn" onclick={onClose}>
							<X size={14} />
						</button>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content>Close</Tooltip.Content>
			</Tooltip.Root>
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<button {...props} class="folderview-header-btn" onclick={() => documentRef?.downloadMarkdown()}>
							<Download size={14} />
						</button>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content>Download as Markdown</Tooltip.Content>
			</Tooltip.Root>
			{#if editing}
				{#if dirty}
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<button {...props} class="folderview-header-btn" onclick={() => documentRef?.revertToSaved()}>
									<RotateCcw size={14} />
								</button>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content>Revert to saved</Tooltip.Content>
					</Tooltip.Root>
				{/if}
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<button {...props} class="folderview-header-btn" onclick={() => documentRef?.cancelEdit()}>
								<Check size={14} />
							</button>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content>Done (Esc)</Tooltip.Content>
				</Tooltip.Root>
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<button {...props} class="folderview-header-btn save-btn" onclick={() => documentRef?.saveEdit()}>
								<Save size={14} />
							</button>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content>Save (⌘S)</Tooltip.Content>
				</Tooltip.Root>
			{:else}
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<button {...props} class="folderview-header-btn" onclick={() => documentRef?.enterEditMode()}>
								<Pencil size={14} />
							</button>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content>Edit</Tooltip.Content>
				</Tooltip.Root>
			{/if}
		</div>
		</Tooltip.Provider>
	</Header>

	{#if activeFile}
		<DocumentComponent
			bind:this={documentRef}
			title={activeFile.name}
			content={activeFile.content}
			embedded={true}
			{agentStreaming}
			{agentProvider}
			{pendingContent}
			{resolveAsset}
			{onAcceptPending}
			{onRejectPending}
			{onSwap}
			{onContentChange}
			{onClose}
		/>
		{#if showToc}
			<DocToc content={activeFile.content} {scrollEl} />
		{/if}
	{/if}
</div>

<style>
	.folderview-shell {
		position: relative;
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		min-width: 0;
		overflow: hidden;
	}

	.folderview-shell > :global(.document) {
		width: 100%;
		flex: 1;
		border: none;
		border-radius: 0;
		height: auto;
	}

	.folderview-folder-name {
		color: hsl(var(--foreground) / 0.7);
		font-weight: var(--font-weight-normal);
	}

	.folderview-header-left {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex: 1;
	}

	.folderview-header-actions {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.folderview-separator {
		color: hsl(var(--muted-foreground));
		font-weight: var(--font-weight-normal);
	}

	.folderview-file-picker {
		position: relative;
	}

	.diff-btn {
		padding: 3px 10px;
		border-radius: 5px;
		border: none;
		font-weight: var(--font-weight-medium);
		cursor: pointer;
		transition:
			background var(--duration-fast) ease,
			color var(--duration-fast) ease;
	}

	.diff-accept {
		background: hsl(142 71% 45%);
		color: white;
	}

	.diff-accept:hover {
		background: hsl(142 71% 38%);
	}

	.diff-reject {
		background: hsl(var(--muted, 0 0% 96%));
		color: hsl(var(--foreground, 0 0% 9%));
	}

	.diff-reject:hover {
		background: hsl(var(--foreground) / 0.1);
	}

	.folderview-header-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
		padding: 0;
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--icon-muted);
		cursor: pointer;
		outline: none;
		transition:
			background var(--duration-fast) ease,
			color var(--duration-fast) ease;
	}

	.folderview-header-btn:hover {
		background: var(--surface-tint);
		color: var(--icon-strong);
	}

	.save-btn {
		color: hsl(var(--primary, 220 90% 56%));
	}

	.save-btn:hover {
		background: hsl(var(--primary, 220 90% 56%) / 0.1);
		color: hsl(var(--primary, 220 90% 56%));
	}

	.folderview-file-btn {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 2px 6px;
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: hsl(var(--foreground) / 0.7);
		font-weight: var(--font-weight-normal);
		cursor: pointer;
		transition: background var(--duration-normal) ease;
	}

	.folderview-file-btn:hover {
		background: hsl(var(--muted));
	}

	.folderview-chevron {
		display: inline-flex;
		transition: transform var(--duration-normal) ease;
	}

	.folderview-chevron-open {
		transform: rotate(180deg);
	}

	.folderview-dropdown-scrim {
		position: fixed;
		inset: 0;
		z-index: 49;
		padding: 0;
		border: none;
		background: transparent;
		cursor: default;
	}

	.folderview-dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		z-index: 50;
		min-width: 260px;
		max-height: 300px;
		overflow-y: auto;
		padding: 4px;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		background: hsl(var(--background));
		box-shadow: 0 8px 24px hsl(var(--foreground) / 0.1);
	}

	.folderview-dropdown-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 6px 10px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: hsl(var(--foreground));
		font-weight: var(--font-weight-normal);
		cursor: pointer;
		transition: background var(--duration-fast) ease;
		text-align: left;
	}

	.folderview-dropdown-item :global(svg) {
		color: hsl(var(--muted-foreground));
	}

	.folderview-dropdown-item:hover {
		background: hsl(var(--muted));
	}

	.folderview-dropdown-item-active {
		background: hsl(var(--primary) / 0.08);
	}
</style>
