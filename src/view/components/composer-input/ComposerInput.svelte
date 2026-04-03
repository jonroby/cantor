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
		anchored?: boolean;
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
		anchored = false,
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
	class="hidden"
	onchange={handleFiles}
/>

<form
	class={anchored
		? 'composer mx-auto box-border w-full max-w-[var(--pane-content-width)]'
		: 'composer fixed bottom-6 left-1/2 z-[25] w-[min(768px,calc(100vw-2rem))] -translate-x-1/2'}
	onsubmit={(e: Event) => {
		e.preventDefault();
		onSubmit();
		resetSize();
	}}
>
	<!-- shell -->
	<div
		class="overflow-hidden rounded-[1.25rem] border border-border bg-card shadow-[0_12px_40px_hsl(var(--foreground)/0.12)]"
	>
		{#if pendingImages.length > 0}
			<div class="flex flex-wrap gap-2 px-3 pt-3">
				{#each pendingImages as img, i (i)}
					<div
						class="relative h-16 w-16 overflow-hidden rounded-[var(--radius-md)] border border-border"
					>
						<img
							src={`data:${img.mimeType};base64,${img.base64}`}
							alt=""
							class="h-full w-full object-cover"
						/>
						<button
							class="absolute top-0.5 right-0.5 flex h-[18px] w-[18px] cursor-pointer items-center justify-center rounded-full border-none bg-[hsl(var(--foreground)/0.7)] p-0 text-[hsl(var(--background))] hover:bg-[hsl(var(--foreground))]"
							type="button"
							onclick={() => removeImage(i)}
						>
							<X size={12} />
						</button>
					</div>
				{/each}
			</div>
		{/if}
		<div class="flex items-end gap-[0.6rem] p-3">
			{#if inputMessage}
				<span class="flex-1 px-1 text-[length:var(--text-base)] text-[hsl(var(--foreground)/0.45)]"
					>{inputMessage}</span
				>
			{:else}
				{#if activeModelLabel}
					<button
						class="mb-[0.15rem] flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center self-end rounded-full border border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
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
					class="max-h-48 min-h-10 flex-1 resize-none overflow-y-auto border-0 bg-transparent p-2 pl-1 font-[inherit] text-[length:var(--text-lg)] text-foreground outline-none"
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
					class="composer-send composer-stop h-[2.3rem] min-h-[2.3rem] w-[2.3rem] min-w-[2.3rem] shrink-0 self-end rounded-full bg-[hsl(var(--foreground)/0.25)] text-black"
					type="button"
					size="icon"
					onclick={onStop}
					ariaLabel="Stop response"
				>
					<Square size={13} fill="currentColor" />
				</Button>
			{:else}
				<Button
					class="composer-send h-[2.3rem] min-h-[2.3rem] w-[2.3rem] min-w-[2.3rem] shrink-0 self-end rounded-full"
					type="submit"
					size="icon"
					disabled={!!submitDisabledReason || (!composerValue.trim() && pendingImages.length === 0)}
					ariaLabel="Send message"
				>
					<ArrowUp size={15} strokeWidth={2.5} />
				</Button>
			{/if}
		</div>
		<div class="flex items-center border-t border-border px-4 py-[0.85rem]">
			<div class="flex shrink-0 items-center gap-3">
				<Button
					class={activeModelLabel
						? 'model-chip rounded-full text-muted-foreground'
						: 'model-chip rounded-full border-foreground! bg-foreground! text-background!'}
					variant="outline"
					size="sm"
					onclick={onOpenPalette}
				>
					{#if activeProvider && PROVIDER_LOGOS[activeProvider]}
						<img
							src={PROVIDER_LOGOS[activeProvider]}
							alt=""
							class="h-[1.15rem] w-[1.15rem] object-contain"
						/>
					{/if}
					{activeModelLabel ?? 'Choose model'}
				</Button>
				{#if activeModelLabel}
					{#if onToggleMode}
						<Button
							class="mode-chip w-16 justify-center rounded-full text-muted-foreground"
							variant="outline"
							size="sm"
							onclick={onToggleMode}
						>
							{agentMode ? 'Agent' : 'Chat'}
						</Button>
					{/if}
					<Button
						class="strategy-chip w-16 justify-center rounded-full text-muted-foreground"
						variant="outline"
						size="sm"
						onclick={onCycleStrategy}
					>
						{contextStrategy === 'full' ? 'Full' : contextStrategy === 'lru' ? 'LRU' : 'BM25'}
					</Button>
				{/if}
				{#if submitDisabledReason && !inputMessage && activeModelLabel}
					<span class="text-[length:var(--text-sm)] text-muted-foreground"
						>{submitDisabledReason}</span
					>
				{/if}
			</div>
			{#if activeModelLabel}
				<div
					class="ml-3 flex min-w-0 flex-1 items-center items-stretch gap-[0.65rem] self-stretch border-l border-border pl-3 text-[length:var(--text-sm)] text-muted-foreground"
				>
					<span>Context</span>
					{#if contextLength != null}
						<div
							class="h-[0.35rem] min-h-[0.35rem] min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
						>
							<div
								class="h-full rounded-[inherit] bg-foreground"
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
