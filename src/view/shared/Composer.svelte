<script lang="ts">
	import Button from '@/view/components/custom/button.svelte';
	import Input from '@/view/components/custom/input.svelte';

	interface Props {
		composerValue: string;
		canvasMode: boolean;
		ephemeralMode: boolean;
		ephemeralAvailable: boolean;
		submitDisabledReason: string | null;
		streaming: boolean;
		activeModelId: string | null;
		usedTokens: number;
		contextLength: number | null;
		onSubmit: () => void;
		onStop: () => void;
		onToggleCanvasMode: () => void;
		onOpenPalette: () => void;
	}

	let {
		composerValue = $bindable(),
		canvasMode = $bindable(),
		ephemeralMode = $bindable(),
		ephemeralAvailable,
		submitDisabledReason,
		streaming,
		activeModelId,
		usedTokens,
		contextLength,
		onSubmit,
		onStop,
		onToggleCanvasMode: _onToggleCanvasMode,
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
	<div class="composer-shell" class:canvas-mode={canvasMode}>
		<div class="composer-row">
			<Input
				bind:this={inputRef}
				bind:value={composerValue}
				class="composer-input"
				placeholder={ephemeralMode
					? 'Ephemeral...'
					: canvasMode
						? 'Ask about the canvas...'
						: (submitDisabledReason ?? 'Message...')}
			/>
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
				{activeModelId ?? 'Connect a model'}
			</Button>
			{#if ephemeralAvailable}
				<div class="composer-divider"></div>
				<button
					class="ephemeral-toggle"
					class:ephemeral-active={ephemeralMode}
					type="button"
					onclick={() => (ephemeralMode = !ephemeralMode)}
					title={ephemeralMode ? 'Switch to Chat mode' : 'Switch to Ephemeral mode'}
				>
					<svg
						width="12"
						height="12"
						viewBox="0 0 12 12"
						fill="none"
						stroke="currentColor"
						stroke-width="1.2"
						stroke-linecap="round"
					>
						<circle cx="6" cy="6" r="4.5" />
						{#if ephemeralMode}
							<path d="M4 6h4" />
						{:else}
							<path d="M6 4v4M4 6h4" />
						{/if}
					</svg>
					<span>{ephemeralMode ? 'Ephemeral' : 'Chat'}</span>
				</button>
			{/if}
			{#if activeModelId}
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
			{#if submitDisabledReason}
				<span class="composer-hint">{submitDisabledReason}</span>
			{/if}
		</div>
	</div>
</form>
