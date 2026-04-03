<script lang="ts">
	import { Document } from '@/view/components/document';
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

	let result = $derived(app.documents.getDocument(folderId, fileId));
</script>

<div class="documentview-shell">
	{#if result}
		<Document
			title={result.file.name}
			content={result.file.content}
			{agentStreaming}
			{agentProvider}
			{pendingContent}
			resolveAsset={(name) => app.documents.resolveAsset(folderId, name)}
			{onAcceptPending}
			{onRejectPending}
			{onSwap}
			onContentChange={(c) => app.documents.updateOpenDocumentContent(folderId, fileId, c)}
			{onClose}
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
</style>
