<script lang="ts">
	import { Document as DocumentComponent, DocToc } from '@/view/components/document';
	import * as app from '@/app';

	interface Props {
		folderId: string;
		fileId: string;
		showToc?: boolean;
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
		showToc = false,
		agentStreaming = false,
		agentProvider,
		pendingContent = null,
		onAcceptPending,
		onRejectPending,
		onSwap,
		onClose
	}: Props = $props();

	let result = $derived(app.documents.getDocument(folderId, fileId));
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let docRef: any = $state(null);
	let scrollEl = $derived(docRef?.getScrollEl() ?? null);
</script>

<div class="documentview-shell">
	{#if result}
		<DocumentComponent
			bind:this={docRef}
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
		{#if showToc}
			<DocToc content={result.file.content} {scrollEl} />
		{/if}
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
		position: relative;
	}

	.documentview-shell > :global(.document) {
		width: 100%;
		height: 100%;
		border: none;
		border-radius: 0;
	}
</style>
