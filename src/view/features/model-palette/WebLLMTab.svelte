<script lang="ts">
	import * as app from '@/app';
	import Input from '@/view/components/custom/input.svelte';

	interface Props {
		activeModel: app.providers.ActiveModel | null;
		webllmStatus: app.providers.WebLLMStatus;
		webllmProgress: number;
		webllmProgressText: string;
		webllmModels: app.providers.WebLLMModelEntry[];
		webllmError: string | null;
		webllmContextSize: app.providers.WebLLMContextSize;
		webllmContextOptions: ReadonlyArray<{ label: string; value: app.providers.WebLLMContextSize }>;
		onWebLLMContextSizeChange: (size: app.providers.WebLLMContextSize) => void;
		onLoadWebLLMModel: (modelId: string) => Promise<void>;
		onDeleteWebLLMCache: (modelId: string) => Promise<void>;
		onDeleteAllWebLLMCaches: () => Promise<void>;
	}

	let {
		activeModel,
		webllmStatus,
		webllmProgress,
		webllmProgressText,
		webllmModels,
		webllmError,
		webllmContextSize,
		webllmContextOptions,
		onWebLLMContextSizeChange,
		onLoadWebLLMModel,
		onDeleteWebLLMCache,
		onDeleteAllWebLLMCaches
	}: Props = $props();

	let webllmSearchQuery = $state('');

	const filteredWebLLMModels = $derived(
		webllmSearchQuery.trim()
			? webllmModels.filter((m) =>
					m.id.toLowerCase().includes(webllmSearchQuery.trim().toLowerCase())
				)
			: webllmModels.slice(0, 20)
	);
</script>

<div class="palette-tab-content">
	<div class="palette-webllm-context">
		<span class="palette-webllm-context-label">Context window:</span>
		{#each webllmContextOptions as opt (opt.value)}
			<button
				class="palette-webllm-context-btn"
				class:active={webllmContextSize === opt.value}
				disabled={webllmStatus === 'loading'}
				onclick={() => onWebLLMContextSizeChange(opt.value)}
			>
				{opt.label}
			</button>
		{/each}
		<span class="palette-webllm-context-hint">
			{webllmContextSize <= 4096
				? 'Low memory'
				: webllmContextSize <= 8192
					? 'Moderate'
					: 'More memory'}
		</span>
	</div>

	{#if webllmStatus === 'loading'}
		<div class="palette-webllm-loading">
			<div class="palette-webllm-progress-bar">
				<div class="palette-webllm-progress-fill" style="width: {webllmProgress * 100}%"></div>
			</div>
			<p class="palette-hint">
				{webllmProgressText || `Loading... ${Math.round(webllmProgress * 100)}%`}
			</p>
		</div>
	{/if}

	{#if webllmError}
		<p class="palette-error">{webllmError}</p>
	{/if}

	<div class="palette-webllm-search">
		<Input
			bind:value={webllmSearchQuery}
			placeholder="Search models (e.g. Llama, Phi, Qwen, SmolLM...)"
			class="palette-connect-input"
		/>
	</div>

	<div class="palette-model-grid">
		{#each filteredWebLLMModels as model (model.id)}
			{@const isLoaded = activeModel?.provider === 'webllm' && activeModel.modelId === model.id}
			{@const isLoading = webllmStatus === 'loading'}
			<button
				class="palette-model-row"
				class:active={isLoaded}
				disabled={isLoading}
				onclick={() => onLoadWebLLMModel(model.id)}
			>
				<span>{model.id}</span>
				<div class="palette-model-meta">
					{#if model.vramMB}
						<span class="palette-vram"
							>{model.vramMB < 1024
								? `${model.vramMB}MB`
								: `${(model.vramMB / 1024).toFixed(1)}GB`}</span
						>
					{/if}
					{#if isLoaded}
						<span class="palette-active-dot"></span>
					{/if}
				</div>
			</button>
		{/each}
	</div>

	{#if webllmSearchQuery && filteredWebLLMModels.length === 0}
		<p class="palette-hint">No models match "{webllmSearchQuery}"</p>
	{/if}
	{#if !webllmSearchQuery}
		<p class="palette-hint">
			{webllmModels.length} models available. Search to find more.
		</p>
	{/if}

	<div class="palette-webllm-cache-actions">
		{#if activeModel?.provider === 'webllm'}
			<button class="palette-forget-key" onclick={() => onDeleteWebLLMCache(activeModel!.modelId)}>
				Remove cached model ({activeModel.modelId})
			</button>
		{/if}
		<button class="palette-forget-key" onclick={onDeleteAllWebLLMCaches}>
			Clear all cached models
		</button>
	</div>
</div>
