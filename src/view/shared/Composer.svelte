<script lang="ts">
	import { Button, Input } from '@/view/components/custom';
	import { PROVIDER_LOGOS } from '@/view/assets';

	interface Props {
		composerValue: string;
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
	}

	let {
		composerValue = $bindable(),
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
		onOpenPalette
	}: Props = $props();

	let inputRef: ReturnType<typeof Input> | undefined = $state();

	export function focus() {
		inputRef?.focus();
	}
</script>

<form
	class="composer"
	onsubmit={(e: Event) => {
		e.preventDefault();
		onSubmit();
	}}
>
	<div class="composer-shell">
		<div class="composer-row">
			{#if inputMessage}
				<span class="composer-message">{inputMessage}</span>
			{:else}
				<Input
					bind:this={inputRef}
					bind:value={composerValue}
					class="composer-input"
					placeholder={agentMode ? 'Agent...' : (submitDisabledReason ?? 'Chat...')}
				/>
			{/if}
			{#if streaming}
				<Button
					class="composer-send composer-stop"
					type="button"
					size="icon"
					onclick={onStop}
					ariaLabel="Stop response"
				>
					<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
						<rect x="4" y="4" width="8" height="8" rx="1" />
					</svg>
				</Button>
			{:else}
				<Button
					class="composer-send"
					type="submit"
					size="icon"
					disabled={!!submitDisabledReason || !composerValue.trim()}
					ariaLabel="Send message"
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="none"
						stroke="currentColor"
						stroke-width="1.6"
						><path d="M8 3v7M5 7l3-3 3 3" stroke-linecap="round" stroke-linejoin="round" /></svg
					>
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
							style="height: 1.5rem; width: 1.5rem; object-fit: contain; border-radius: 0.25rem;"
						/>
					{/if}
					{activeModelLabel ?? 'Choose model'}
				</Button>
				<Button class="mode-chip" variant="outline" size="sm">
					{agentMode ? 'Agent' : 'Chat'}
				</Button>
				<Button class="strategy-chip" variant="outline" size="sm" onclick={onCycleStrategy}>
					{contextStrategy === 'full' ? 'Full' : contextStrategy === 'lru' ? 'LRU' : 'BM25'}
				</Button>
				{#if submitDisabledReason && !inputMessage}
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
