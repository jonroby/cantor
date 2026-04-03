<script lang="ts">
	import { Button } from '@/view/primitives';
	import { PROVIDER_LOGOS } from '@/view/assets';
	import { ArrowUp, Square, Plus, X } from 'lucide-svelte';
	import type * as app from '@/app';

	type ImageAttachment = app.chat.ImageAttachment;

	interface Props {
		composerValue: string;
		pendingImages: ImageAttachment[];
		agentMode: boolean;
		inputMessage: string | null;
		submitDisabledReason: string | null;
		streaming: boolean;
		activeModelLabel: string | null;
		activeProvider: string | null;
		usedTokens: number;
		contextLength: number | null;
		contextStrategy: 'full' | 'lru' | 'bm25';
		onCycleStrategy: () => void;
		onSubmit: () => void;
		onStop: () => void;
		onOpenPalette: () => void;
		onToggleMode?: () => void;
	}

	let {
		composerValue = $bindable(),
		pendingImages = $bindable(),
		agentMode,
		inputMessage,
		submitDisabledReason,
		streaming,
		activeModelLabel,
		activeProvider,
		usedTokens,
		contextLength,
		contextStrategy,
		onCycleStrategy,
		onSubmit,
		onStop,
		onOpenPalette,
		onToggleMode
	}: Props = $props();

	let textareaEl: HTMLTextAreaElement | undefined = $state();
	let fileInputEl: HTMLInputElement | undefined = $state();

	export function focus() {
		textareaEl?.focus();
	}

	function autoResize() {
		if (!textareaEl) return;
		textareaEl.style.height = 'auto';
		textareaEl.style.height = `${textareaEl.scrollHeight}px`;
	}

	function resetSize() {
		if (!textareaEl) return;
		textareaEl.style.height = 'auto';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			onSubmit();
			resetSize();
		}
	}

	function openFilePicker() {
		fileInputEl?.click();
	}

	async function handleFiles(e: Event) {
		const input = e.target as HTMLInputElement;
		const files = input.files;
		if (!files) return;

		for (const file of files) {
			const base64 = await fileToBase64(file);
			pendingImages = [
				...pendingImages,
				{ mimeType: file.type as ImageAttachment['mimeType'], base64 }
			];
		}
		input.value = '';
	}

	function removeImage(index: number) {
		pendingImages = pendingImages.filter((_, i) => i !== index);
	}

	function fileToBase64(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				const dataUrl = reader.result as string;
				resolve(dataUrl.split(',')[1]!);
			};
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}
</script>

<input
	bind:this={fileInputEl}
	type="file"
	accept="image/jpeg,image/png,image/gif,image/webp"
	multiple
	style="display: none"
	onchange={handleFiles}
/>

<form
	class="composer"
	onsubmit={(e: Event) => {
		e.preventDefault();
		onSubmit();
		resetSize();
	}}
>
	<div class="composer-shell">
		{#if pendingImages.length > 0}
			<div class="composer-images">
				{#each pendingImages as img, i (i)}
					<div class="composer-image-thumb">
						<img src={`data:${img.mimeType};base64,${img.base64}`} alt="" />
						<button class="composer-image-remove" type="button" onclick={() => removeImage(i)}>
							<X size={12} />
						</button>
					</div>
				{/each}
			</div>
		{/if}
		<div class="composer-row">
			{#if inputMessage}
				<span class="composer-message">{inputMessage}</span>
			{:else}
				{#if activeModelLabel}
					<button
						class="composer-attach"
						type="button"
						onclick={openFilePicker}
						aria-label="Attach image"
					>
						<Plus size={18} />
					</button>
				{/if}
				<textarea
					bind:this={textareaEl}
					bind:value={composerValue}
					class="composer-textarea"
					placeholder={!activeModelLabel
						? 'Select a model to get started with chat or working with an agent'
						: agentMode
							? 'Agent...'
							: 'Chat...'}
					disabled={!activeModelLabel}
					rows={1}
					oninput={autoResize}
					onkeydown={handleKeydown}
				></textarea>
			{/if}
			{#if streaming}
				<Button
					class="composer-send composer-stop"
					type="button"
					size="icon"
					onclick={onStop}
					ariaLabel="Stop response"
				>
					<Square size={13} fill="currentColor" />
				</Button>
			{:else}
				<Button
					class="composer-send"
					type="submit"
					size="icon"
					disabled={!!submitDisabledReason || (!composerValue.trim() && pendingImages.length === 0)}
					ariaLabel="Send message"
				>
					<ArrowUp size={15} strokeWidth={2.5} />
				</Button>
			{/if}
		</div>
		<div class="composer-footer">
			<div class="composer-footer-left">
				<Button
					class={activeModelLabel ? 'model-chip' : 'model-chip model-chip-cta'}
					variant="outline"
					size="sm"
					onclick={onOpenPalette}
				>
					{#if activeProvider && PROVIDER_LOGOS[activeProvider]}
						<img
							src={PROVIDER_LOGOS[activeProvider]}
							alt=""
							style="height: 1.15rem; width: 1.15rem; object-fit: contain;"
						/>
					{/if}
					{activeModelLabel ?? 'Choose model'}
				</Button>
				{#if activeModelLabel}
					{#if onToggleMode}
						<Button class="mode-chip" variant="outline" size="sm" onclick={onToggleMode}>
							{agentMode ? 'Agent' : 'Chat'}
						</Button>
					{/if}
					<Button class="strategy-chip" variant="outline" size="sm" onclick={onCycleStrategy}>
						{contextStrategy === 'full' ? 'Full' : contextStrategy === 'lru' ? 'LRU' : 'BM25'}
					</Button>
				{/if}
				{#if submitDisabledReason && !inputMessage && activeModelLabel}
					<span class="composer-hint">{submitDisabledReason}</span>
				{/if}
			</div>
			{#if activeModelLabel}
				<div class="composer-footer-right">
					<span>Context</span>
					{#if contextLength != null}
						<div class="progress-track compact">
							<div
								class="progress-fill"
								style={`width: ${Math.min(100, (usedTokens / Math.max(1, contextLength)) * 100)}%`}
							></div>
						</div>
					{/if}
					<span
						>{usedTokens.toLocaleString()}{contextLength != null
							? ` / ${contextLength.toLocaleString()}`
							: ''}</span
					>
				</div>
			{/if}
		</div>
	</div>
</form>

<style>
	.composer {
		position: fixed;
		left: 50%;
		bottom: 1.5rem;
		z-index: 25;
		width: min(768px, calc(100vw - 2rem));
		transform: translateX(-50%);
	}

	.composer-shell {
		overflow: hidden;
		border: 1px solid hsl(var(--border));
		border-radius: 1.25rem;
		background: hsl(var(--card) / 1);
		box-shadow: 0 12px 40px rgba(15, 23, 42, 0.12);
	}

	.composer-row {
		display: flex;
		align-items: flex-end;
		gap: 0.6rem;
		padding: 0.75rem;
	}

	.composer-message {
		flex: 1;
		font-size: var(--text-base);
		color: hsl(var(--foreground) / 0.45);
		padding: 0 0.25rem;
	}

	.composer-textarea {
		flex: 1;
		min-height: 2.5rem;
		max-height: 12rem;
		border: 0;
		background: transparent;
		color: hsl(var(--foreground));
		font-size: var(--text-lg);
		font-family: inherit;
		line-height: 1.5;
		padding: 0.5rem 0.25rem;
		outline: none;
		resize: none;
		overflow-y: auto;
	}

	/* Passed as class prop to Button — must be :global() */
	:global(.composer-send) {
		height: 2.3rem;
		width: 2.3rem;
		min-height: 2.3rem;
		min-width: 2.3rem;
		border-radius: var(--radius-full);
		align-self: flex-end;
		flex-shrink: 0;
	}

	:global(.composer-stop) {
		background: hsl(var(--foreground) / 0.25);
		color: hsl(0 0% 0%);
	}

	.composer-footer {
		display: flex;
		align-items: center;
		padding: 0.85rem 1rem;
		border-top: 1px solid hsl(var(--border));
	}

	.composer-footer-left {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-shrink: 0;
	}

	.composer-footer-right {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		flex: 1;
		min-width: 0;
		padding-left: 0.75rem;
		margin-left: 0.75rem;
		border-left: 1px solid hsl(var(--border));
		align-self: stretch;
		font-size: var(--text-sm);
		color: hsl(var(--muted-foreground));
	}

	/* Passed as class prop to Button — must be :global() */
	:global(.model-chip) {
		border-radius: var(--radius-full);
		color: hsl(var(--muted-foreground));
	}

	:global(.model-chip-cta) {
		background: hsl(var(--foreground)) !important;
		color: hsl(var(--background)) !important;
		border-color: hsl(var(--foreground)) !important;
	}

	:global(.model-chip-cta:hover) {
		opacity: 0.85;
	}

	:global(.mode-chip.ui-button-outline) {
		border-radius: var(--radius-full);
		width: 4rem;
		justify-content: center;
		color: hsl(var(--muted-foreground));
	}

	:global(.strategy-chip.ui-button-outline) {
		border-radius: var(--radius-full);
		width: 4rem;
		justify-content: center;
		color: hsl(var(--muted-foreground));
	}

	.progress-track {
		height: 0.35rem;
		min-height: 0.35rem;
		border-radius: var(--radius-full);
		background: hsl(var(--muted));
		overflow: hidden;
	}

	.progress-track.compact {
		flex: 1;
		min-width: 0;
	}

	.progress-fill {
		height: 100%;
		border-radius: inherit;
		background: hsl(var(--foreground));
	}

	.composer-hint {
		font-size: var(--text-sm);
		color: hsl(var(--muted-foreground));
	}

	.composer-attach {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: 1px solid hsl(var(--border));
		background: transparent;
		color: hsl(var(--muted-foreground));
		cursor: pointer;
		flex-shrink: 0;
		align-self: flex-end;
		margin-bottom: 0.15rem;
	}

	.composer-attach:hover {
		background: hsl(var(--muted));
		color: hsl(var(--foreground));
	}

	.composer-images {
		display: flex;
		gap: 8px;
		padding: 0.75rem 0.75rem 0;
		flex-wrap: wrap;
	}

	.composer-image-thumb {
		position: relative;
		width: 64px;
		height: 64px;
		border-radius: var(--radius-md);
		overflow: hidden;
		border: 1px solid hsl(var(--border));
	}

	.composer-image-thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.composer-image-remove {
		position: absolute;
		top: 2px;
		right: 2px;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		border: none;
		background: hsl(var(--foreground) / 0.7);
		color: hsl(var(--background));
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		padding: 0;
	}

	.composer-image-remove:hover {
		background: hsl(var(--foreground));
	}
</style>
