<script lang="ts">
	import { Button, Input } from '@/view/components/custom';
	import { PROVIDER_LOGOS } from '@/view/assets';

	interface Props {
		composerValue: string;
		commandMode: boolean;
		inputMessage: string | null;
		submitDisabledReason: string | null;
		streaming: boolean;
		activeModelLabel: string | null;
		activeProvider: string | null;
		usedTokens: number;
		contextLength: number | null;
		onSubmit: () => void;
		onStop: () => void;
		onOpenPalette: () => void;
	}

	let {
		composerValue = $bindable(),
		commandMode,
		inputMessage,
		submitDisabledReason,
		streaming,
		activeModelLabel,
		activeProvider,
		usedTokens,
		contextLength,
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
					placeholder={commandMode ? 'Command...' : (submitDisabledReason ?? 'Chat...')}
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
			<Button class="model-chip" variant="outline" size="sm" onclick={onOpenPalette}>
				{#if activeProvider && PROVIDER_LOGOS[activeProvider]}
					<img
						src={PROVIDER_LOGOS[activeProvider]}
						alt=""
						style="height: 0.875rem; width: 0.875rem; object-fit: contain;"
					/>
				{/if}
				{activeModelLabel ?? 'Connect a model'}
			</Button>
			<div class="composer-divider"></div>
			<span class="mode-indicator" class:mode-active={commandMode}>
				{commandMode ? 'Command' : 'Chat'}
			</span>
			{#if activeModelLabel}
				<div class="composer-divider"></div>
				<div class="context-meta">
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
			{#if submitDisabledReason && !inputMessage}
				<span class="composer-hint">{submitDisabledReason}</span>
			{/if}
		</div>
	</div>
</form>
