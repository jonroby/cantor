<script lang="ts">
	import Button from '@/components/custom/button.svelte';
	import Input from '@/components/custom/input.svelte';
	import logoDark from '@/assets/logo_dark.svg';
	import logoLight from '@/assets/logo_light.svg';

	interface Props {
		composerValue: string;
		canvasMode: boolean;
		submitDisabledReason: string | null;
		activeModelId: string | null;
		usedTokens: number;
		contextLength: number | null;
		onSubmit: () => void;
		onToggleCanvasMode: () => void;
		onOpenPalette: () => void;
	}

	let {
		composerValue = $bindable(),
		canvasMode = $bindable(),
		submitDisabledReason,
		activeModelId,
		usedTokens,
		contextLength,
		onSubmit,
		onToggleCanvasMode,
		onOpenPalette
	}: Props = $props();
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
			<button
				type="button"
				class="canvas-toggle"
				onclick={onToggleCanvasMode}
				aria-label={canvasMode ? 'Disable canvas mode' : 'Enable canvas mode'}
			>
				<img src={canvasMode ? logoDark : logoLight} alt="Canvas mode" width="24" height="24" />
			</button>
			<Input
				bind:value={composerValue}
				class="composer-input"
				placeholder={canvasMode
					? 'Ask about the canvas...'
					: (submitDisabledReason ?? 'Message...')}
			/>
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
		</div>
		<div class="composer-footer">
			<Button class="model-chip" variant="outline" size="sm" onclick={onOpenPalette}>
				{activeModelId ?? 'Connect a model'}
			</Button>
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
