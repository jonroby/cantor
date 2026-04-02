<script lang="ts">
	import { Document } from '@/view/features/document';
	import * as app from '@/app';

	interface Props {
		folderId: string;
		agentStreaming?: boolean;
		agentProvider?: app.providers.Provider | null;
		pendingContent?: string | null;
		onAcceptPending?: () => void;
		onRejectPending?: () => void;
		onSwap?: () => void;
		onClose: () => void;
		selectedFileId?: string;
		onSelectFile?: (fileId: string) => void;
	}

	let {
		folderId,
		agentStreaming = false,
		agentProvider,
		pendingContent = null,
		onAcceptPending,
		onRejectPending,
		onSwap,
		onClose,
		selectedFileId,
		onSelectFile
	}: Props = $props();

	let folder = $derived(app.documents.getState().folders.find((f) => f.id === folderId));
	let files = $derived(folder?.files ?? []);
	let activeFileId = $derived(selectedFileId ?? files[0]?.id ?? null);
	let activeFile = $derived(files.find((f) => f.id === activeFileId) ?? null);
	let dropdownOpen = $state(false);

	let openDocumentIndex = $derived.by(() => {
		if (!activeFileId) return -1;
		return app.documents
			.getState()
			.openDocuments.findIndex(
				(d) => d.documentKey?.folderId === folderId && d.documentKey?.fileId === activeFileId
			);
	});

	function selectFile(fileId: string) {
		onSelectFile?.(fileId);
		dropdownOpen = false;
	}
</script>

<div class="folderview-shell">
	<div class="folderview-header">
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path
				d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"
			/>
		</svg>
		<span class="folderview-folder-name">{folder?.name ?? 'Folder'}</span>
		<span class="folderview-separator">/</span>
		<div class="folderview-file-picker">
			<button class="folderview-file-btn" onclick={() => (dropdownOpen = !dropdownOpen)}>
				{activeFile?.name ?? 'No files'}
				<svg
					width="12"
					height="12"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="folderview-chevron"
					class:folderview-chevron-open={dropdownOpen}
				>
					<path d="M6 9l6 6 6-6" />
				</svg>
			</button>
			{#if dropdownOpen}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="folderview-dropdown-scrim" onclick={() => (dropdownOpen = false)}></div>
				<div class="folderview-dropdown">
					{#each files as file (file.id)}
						<button
							class="folderview-dropdown-item"
							class:folderview-dropdown-item-active={file.id === activeFileId}
							onclick={() => selectFile(file.id)}
						>
							<svg
								width="14"
								height="14"
								viewBox="0 0 16 16"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
							>
								<path d="M3 2h7l3 3v9H3V2z" />
								<path d="M10 2v3h3" />
							</svg>
							{file.name}
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	{#if activeFile}
		<Document
			title={activeFile.name}
			content={activeFile.content}
			{agentStreaming}
			{agentProvider}
			{pendingContent}
			{onAcceptPending}
			{onRejectPending}
			{onSwap}
			onContentChange={(c) => {
				if (openDocumentIndex >= 0) app.documents.updateDocumentContent(openDocumentIndex, c);
			}}
			onClose={() => {
				if (openDocumentIndex >= 0) {
					app.documents.closeDocument(openDocumentIndex);
				}
				app.bootstrap.clearOpenDocument();
				onClose();
			}}
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

	.folderview-shell :global(.docs-header) {
		height: 52px;
		padding: 0 12px;
		gap: 8px;
		border-bottom: 1px solid hsl(var(--border));
		background: hsl(var(--background) / 0.97);
		font-size: 13px;
		font-weight: 600;
		color: hsl(var(--muted-foreground));
		letter-spacing: 0.02em;
	}

	/* Hide the Document's default icon and title — we show our own */
	.folderview-shell :global(.docs-header-inner > svg:first-child),
	.folderview-shell :global(.docs-header-inner > span:first-of-type) {
		display: none;
	}

	.folderview-header {
		position: absolute;
		top: 0;
		left: 1rem;
		right: 1rem;
		height: 52px;
		display: flex;
		align-items: center;
		gap: 6px;
		max-width: 720px;
		margin: 0 auto;
		font-size: 13px;
		color: hsl(var(--muted-foreground));
		letter-spacing: 0.02em;
		z-index: 1;
	}

	.folderview-folder-name {
		color: hsl(var(--foreground) / 0.7);
		font-weight: 400;
	}

	.folderview-separator {
		color: hsl(var(--muted-foreground));
		font-weight: 400;
	}

	.folderview-file-picker {
		position: relative;
	}

	.folderview-file-btn {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 2px 6px;
		border: none;
		border-radius: 4px;
		background: transparent;
		color: hsl(var(--foreground) / 0.7);
		font-size: 13px;
		font-weight: 400;
		cursor: pointer;
		transition: background 150ms ease;
	}

	.folderview-file-btn:hover {
		background: hsl(var(--muted));
	}

	.folderview-chevron {
		transition: transform 150ms ease;
	}

	.folderview-chevron-open {
		transform: rotate(180deg);
	}

	.folderview-dropdown-scrim {
		position: fixed;
		inset: 0;
		z-index: 49;
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
		border-radius: 8px;
		background: hsl(var(--background));
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
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
		font-size: 13px;
		font-weight: 400;
		cursor: pointer;
		transition: background 100ms ease;
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
