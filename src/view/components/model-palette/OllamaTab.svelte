<script lang="ts">
	import { Input } from '@/view/primitives';
	import { PROVIDER_LOGOS } from '@/view/assets';
	import type * as app from '@/app';

	interface Props {
		provider: app.providers.ProviderEntry;
		activeModel: app.providers.ActiveModel | null;
		onConnect: (provider: app.providers.Provider, value?: string) => Promise<void>;
		onSelectModel: (provider: app.providers.ProviderEntry, modelId: string) => void;
	}

	let { provider, activeModel, onConnect, onSelectModel }: Props = $props();
</script>

<div class="palette-tab-content">
	<div class="palette-provider-group">
		<div class="palette-provider-title">
			{#if PROVIDER_LOGOS[provider.id]}
				<img src={PROVIDER_LOGOS[provider.id]} alt={provider.name} class="palette-provider-logo" />
			{/if}
			<span class="palette-provider-name">{provider.name}</span>
			{#if provider.connection}
				<span class="palette-provider-auth">
					<button
						class="palette-auth-btn"
						onclick={() => onConnect(provider.id, provider.connection?.value)}
						disabled={provider.connection.status === 'connecting'}
					>
						{provider.connection.status === 'connecting'
							? 'Connecting...'
							: provider.connection.status === 'connected'
								? 'Reconnect'
								: 'Connect'}
					</button>
				</span>
			{/if}
		</div>

		{#if provider.connection}
			<div class="palette-ollama-connect">
				<Input
					value={provider.connection.value}
					class="palette-connect-input"
					placeholder="localhost:11434"
				/>
				{#if provider.connection.status === 'error'}
					<span class="palette-connect-error">Failed</span>
				{/if}
			</div>
		{/if}

		{#if provider.connection?.status === 'connected' && provider.models.length === 0}
			<p class="palette-hint">No models found.</p>
		{/if}
		{#if provider.connection?.status === 'connected' && provider.models.length > 0}
			<div class="palette-provider-models">
				{#each provider.models as model (model.id)}
					<button
						class="palette-model-row"
						class:active={activeModel?.provider === 'ollama' && activeModel?.modelId === model.id}
						onclick={() => onSelectModel(provider, model.id)}
					>
						<span>{model.label}</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>
