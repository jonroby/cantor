<script lang="ts">
	import { Button } from '@/view/primitives';
	import { PROVIDER_LOGOS } from '@/view/assets';
	import { ArrowUp, Square, Plus, X, Settings } from 'lucide-svelte';
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
		totalTokens: number;
		contextLength: number | null;
		contextStrategy: 'full' | 'lru' | 'bm25';
		anchored?: boolean;
		onSubmit: () => void;
		onStop: () => void;
		onOpenPalette: () => void;
		onOpenContextPalette: () => void;
		onToggleMode?: () => void;
		onOpenAgentPalette?: () => void;
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
		totalTokens: _totalTokens,
		contextLength,
		contextStrategy: _contextStrategy,
		anchored = false,
		onSubmit,
		onStop,
		onOpenPalette,
		onOpenContextPalette,
		onToggleMode,
		onOpenAgentPalette
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
	class:composer-anchored={anchored}
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
					{#if agentMode && onOpenAgentPalette}
						<Button class="mode-chip" variant="outline" size="sm" onclick={onOpenAgentPalette}>
							Tools
						</Button>
					{/if}
				{/if}
				{#if submitDisabledReason && !inputMessage && activeModelLabel}
					<span class="composer-hint">{submitDisabledReason}</span>
				{/if}
			</div>
			{#if activeModelLabel}
				<div class="composer-footer-right">
					<button
						class="context-settings-btn"
						onclick={onOpenContextPalette}
						title="Context settings"
					>
						<Settings size={16} />
					</button>
					<span class="context-strategy-label">Context Window</span>
					{#if contextLength != null}
						<div class="progress-track compact">
							<div
								class="progress-fill"
								style={`width: ${Math.min(100, (usedTokens / Math.max(1, contextLength)) * 100)}%`}
							></div>
						</div>
					{/if}
					<span class="context-token-count"
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
	:global(.composer-send) {
		border-radius: 50% !important;
	}

	.composer {
		position: fixed;
		bottom: 1.5rem;
		left: 50%;
		z-index: 25;
		width: min(768px, calc(100vw - 2rem));
		transform: translateX(-50%);
	}

	.composer-anchored {
		position: relative;
		bottom: auto;
		left: auto;
		transform: none;
		width: 100%;
		max-width: var(--pane-content-width);
		margin: 0 auto;
		box-sizing: border-box;
	}

	.composer-shell {
		overflow: hidden;
		border-radius: 1.25rem;
		border: 1px solid hsl(var(--border));
		background: hsl(var(--card));
		box-shadow: 0 12px 40px hsl(var(--foreground) / 0.12);
	}

	.composer-images {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 0.75rem 0.75rem 0;
	}

	.composer-image-thumb {
		position: relative;
		width: 4rem;
		height: 4rem;
		overflow: hidden;
		border-radius: var(--radius-md);
		border: 1px solid hsl(var(--border));
	}

	.composer-image-thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.composer-image-remove {
		position: absolute;
		top: 0.125rem;
		right: 0.125rem;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		border: none;
		background: hsl(var(--foreground) / 0.7);
		color: hsl(var(--background));
		padding: 0;
		cursor: pointer;
	}

	.composer-image-remove:hover {
		background: hsl(var(--foreground));
	}

	.composer-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.85rem 1rem;
	}

	.composer-message {
		flex: 1;
		padding: 0 0.25rem;
		font-size: var(--text-base);
		color: hsl(var(--foreground) / 0.45);
	}

	.composer-attach {
		display: flex;
		height: 1.75rem;
		width: 1.75rem;
		flex-shrink: 0;
		cursor: pointer;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		border: 1px solid hsl(var(--border));
		background: transparent;
		color: hsl(var(--muted-foreground));
	}

	.composer-attach:hover {
		background: hsl(var(--muted));
		color: hsl(var(--foreground));
	}

	.composer-textarea {
		flex: 1;
		min-height: 1.5rem;
		max-height: 12rem;
		resize: none;
		overflow-y: auto;
		border: 0;
		background: transparent;
		padding: 0.125rem 0.5rem 0.125rem 0.25rem;
		font-family: inherit;
		font-size: var(--text-lg);
		color: hsl(var(--foreground));
		outline: none;
		line-height: 1.5;
	}

	.composer-footer {
		display: flex;
		align-items: center;
		border-top: 1px solid hsl(var(--border));
		padding: 0.85rem 1rem;
	}

	.composer-footer-left {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		gap: 0.75rem;
	}

	.composer-hint {
		font-size: var(--text-sm);
		color: hsl(var(--muted-foreground));
	}

	.composer-footer-right {
		margin-left: 0.75rem;
		display: flex;
		min-width: 0;
		flex: 1;
		align-items: center;
		align-self: stretch;
		gap: 0.65rem;
		border-left: 1px solid hsl(var(--border));
		padding-left: 0.75rem;
		font-size: var(--text-sm);
		color: hsl(var(--muted-foreground));
	}

	.progress-track {
		flex: 1;
		min-width: 0;
		height: 0.35rem;
		min-height: 0.35rem;
		overflow: hidden;
		border-radius: 999px;
		background: hsl(var(--muted));
	}

	.progress-fill {
		height: 100%;
		border-radius: inherit;
		background: hsl(var(--foreground));
	}

	.context-strategy-label {
		flex-shrink: 0;
		font-size: var(--text-sm);
		color: hsl(var(--muted-foreground));
	}

	.context-token-count {
		flex-shrink: 0;
		font-size: var(--text-sm);
		color: hsl(var(--muted-foreground));
		font-variant-numeric: tabular-nums;
	}

	.context-settings-btn {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.375rem;
		height: 1.375rem;
		padding: 0;
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: hsl(var(--muted-foreground));
		cursor: pointer;
		transition:
			background var(--duration-fast) ease,
			color var(--duration-fast) ease;
	}

	.context-settings-btn:hover {
		background: hsl(var(--muted));
		color: hsl(var(--foreground));
	}
</style>
