<script lang="ts">
	import { Document as DocumentComponent } from '@/view/components/document';
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

	interface Props {
		folderId: string;
		folderName: string;
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
		<div class="folderview-header-actions">
			{#if pendingContent != null}
				<button class="diff-btn diff-accept" onclick={onAcceptPending}>Accept</button>
				<button class="diff-btn diff-reject" onclick={onRejectPending}>Reject</button>
			{/if}
			{#if onSwap}
				<button class="folderview-header-btn" onclick={onSwap} title="Swap panels">
					<ArrowLeftRight size={14} />
				</button>
			{/if}
			<button class="folderview-header-btn" onclick={onClose} title="Close" aria-label="Close">
				<X size={14} />
			</button>
			<button
				class="folderview-header-btn"
				onclick={() => documentRef?.downloadMarkdown()}
				title="Download as Markdown"
			>
				<Download size={14} />
			</button>
			{#if editing}
				{#if dirty}
					<button
						class="folderview-header-btn"
						onclick={() => documentRef?.revertToSaved()}
						title="Revert to saved"
					>
						<RotateCcw size={14} />
					</button>
				{/if}
				<button
					class="folderview-header-btn"
					onclick={() => documentRef?.cancelEdit()}
					title="Done (Esc)"
				>
					<Check size={14} />
				</button>
				<button
					class="folderview-header-btn save-btn"
					onclick={() => documentRef?.saveEdit()}
					title="Save (⌘S)"
				>
					<Save size={14} />
				</button>
			{:else}
				<button
					class="folderview-header-btn"
					onclick={() => documentRef?.enterEditMode()}
					title="Edit"
				>
					<Pencil size={14} />
				</button>
			{/if}
		</div>
	</Header>

	{#if activeFile}
		<DocumentComponent
			bind:this={documentRef}
			title={activeFile.name}
			content={activeFile.content}
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

	/* .docs-header uses .pane-header from layout.css — no overrides needed */

	/* Hide the Document's default icon and title — we show our own */
	.folderview-shell :global(.docs-header-inner > svg:first-child),
	.folderview-shell :global(.docs-header-inner > span:first-of-type) {
		display: none;
	}

	/* Overlays the Document's own header — absolute so it floats on top */
	:global(.folderview-header) {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		z-index: 1;
		pointer-events: none;
	}

	:global(.folderview-header) > * {
		pointer-events: auto;
	}

	.folderview-folder-name {
		color: hsl(var(--foreground) / 0.7);
		font-weight: 400;
	}

	:global(.folderview-header) {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.folderview-header-left,
	.folderview-header-actions {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.folderview-separator {
		color: hsl(var(--muted-foreground));
		font-weight: 400;
	}

	.folderview-file-picker {
		position: relative;
	}

	.diff-btn {
		padding: 3px 10px;
		border-radius: 5px;
		border: none;
		font-size: var(--text-sm);
		font-weight: 500;
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
		font-size: var(--text-base);
		font-weight: 400;
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
		border: 1px solid hsl(var(--border));
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
		font-size: var(--text-base);
		font-weight: 400;
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
