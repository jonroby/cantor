<script lang="ts">
	import { Input } from '@/view/primitives';
	import type * as app from '@/app';

	interface Props {
		provider: app.providers.ProviderEntry;
	}

	let { provider }: Props = $props();

	function getMemoryHint(): string {
		if (!provider.context) return '';
		if (provider.context.value <= 4096) return 'Low memory';
		if (provider.context.value <= 8192) return 'Moderate';
		return 'More memory';
	}
</script>

<div class="palette-tab-content palette-disabled-overlay">
	<p class="palette-hint" style="padding-top: 0.5rem;">Coming Soon</p>

	{#if provider.context}
		<div class="palette-webllm-context">
			<span class="palette-webllm-context-label">Context window:</span>
			{#each provider.context.options as option (option.value)}
				<button
					class="palette-webllm-context-btn"
					class:active={provider.context.value === option.value}
					disabled
				>
					{option.label}
				</button>
			{/each}
			<span class="palette-webllm-context-hint">{getMemoryHint()}</span>
		</div>
	{/if}

	<div class="palette-webllm-search">
		<Input
			value=""
			placeholder="Search models (e.g. Llama, Phi, Qwen, SmolLM...)"
			class="palette-connect-input"
			disabled
		/>
	</div>

	<div class="palette-model-grid">
		{#each provider.models.slice(0, 20) as model (model.id)}
			<button class="palette-model-row disabled" disabled>
				<span>{model.id}</span>
				<div class="palette-model-meta">
					{#if model.meta}
						<span class="palette-vram">{model.meta}</span>
					{/if}
				</div>
			</button>
		{/each}
	</div>

	{#if provider.models.length > 0}
		<p class="palette-hint">
			{provider.models.length} models available.
		</p>
	{/if}
</div>
