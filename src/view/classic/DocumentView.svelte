<script lang="ts">
	import { Document } from '@/view/features/document';
	import * as app from '@/app';

	interface Props {
		folderId: string;
		fileId: string;
		agentStreaming?: boolean;
		agentProvider?: app.providers.Provider | null;
		pendingContent?: string | null;
		onAcceptPending?: () => void;
		onRejectPending?: () => void;
		onSwap?: () => void;
		onClose: () => void;
	}

	let {
		folderId,
		fileId,
		agentStreaming = false,
		agentProvider,
		pendingContent = null,
		onAcceptPending,
		onRejectPending,
		onSwap,
		onClose
	}: Props = $props();

	let documentFile = $derived.by(() => {
		const folder = app.documents.getState().folders.find((f) => f.id === folderId);
		return folder?.files?.find((f) => f.id === fileId) ?? null;
	});

	let openDocumentIndex = $derived.by(() => {
		return app.documents
			.getState()
			.openDocuments.findIndex(
				(d) => d.documentKey?.folderId === folderId && d.documentKey?.fileId === fileId
			);
	});
</script>

<div class="documentview-shell">
	{#if documentFile}
		<Document
			title={documentFile.name}
			content={documentFile.content}
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
	.documentview-shell {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		min-width: 0;
		overflow: hidden;
	}

	.documentview-shell > :global(.document) {
		width: 100%;
		height: 100%;
		border: none;
		border-radius: 0;
	}

	.documentview-shell :global(.docs-header) {
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
</style>
