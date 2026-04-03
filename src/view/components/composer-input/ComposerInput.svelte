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
