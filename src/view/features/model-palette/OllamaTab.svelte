<script lang="ts">
	import * as app from '@/app';
	import Button from '@/view/components/custom/button.svelte';
	import Input from '@/view/components/custom/input.svelte';

	interface Props {
		activeModel: app.providers.ActiveModel | null;
		ollamaUrl: string;
		ollamaStatus: app.providers.OllamaStatus;
		ollamaModels: string[];
		onConnectOllama: (url: string) => Promise<void>;
		onSelectModel: (model: app.providers.ActiveModel) => void;
	}

	let {
		activeModel,
		ollamaUrl,
		ollamaStatus,
		ollamaModels,
		onConnectOllama,
		onSelectModel
	}: Props = $props();

	let urlInput = $derived(ollamaUrl);
	const isOllamaConnected = $derived(ollamaStatus === 'connected');
</script>

<div class="palette-tab-content">
	<div class="palette-ollama-connect">
		<Input
			bind:value={urlInput}
			class="palette-connect-input"
			placeholder="localhost:11434"
			onkeydown={(e) => {
				if (e.key === 'Enter') onConnectOllama(urlInput);
			}}
		/>
		<Button
			size="sm"
			variant={isOllamaConnected ? 'secondary' : 'default'}
			class="palette-connect-btn"
			onclick={() => onConnectOllama(urlInput)}
			disabled={ollamaStatus === 'connecting'}
		>
			{ollamaStatus === 'connecting'
				? 'Connecting...'
				: isOllamaConnected
					? 'Reconnect'
					: 'Connect'}
		</Button>
		{#if ollamaStatus === 'error'}
			<span class="palette-connect-error">Failed</span>
		{/if}
	</div>
	{#if isOllamaConnected && ollamaModels.length === 0}
		<p class="palette-hint">No models found.</p>
	{/if}
	{#if isOllamaConnected && ollamaModels.length > 0}
		<div class="palette-model-grid">
			{#each ollamaModels as modelId (modelId)}
				<button
					class="palette-model-row"
					class:active={activeModel?.provider === 'ollama' && activeModel.modelId === modelId}
					onclick={() => onSelectModel({ provider: 'ollama', modelId })}
				>
					<span>{modelId}</span>
					<div class="palette-model-meta">
						{#if activeModel?.provider === 'ollama' && activeModel.modelId === modelId}
							<span class="palette-active-dot"></span>
						{/if}
					</div>
				</button>
			{/each}
		</div>
	{/if}
</div>
