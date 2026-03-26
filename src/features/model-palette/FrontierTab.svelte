<script lang="ts">
	import { PROVIDER_MODELS, PROVIDER_CONFIG, KEY_BASED_PROVIDERS } from '@/lib/models';
	import type { ActiveModel, Provider } from '@/lib/models';
	import { PROVIDER_LOGOS } from '@/lib/models/logos';

	interface Props {
		activeModel: ActiveModel | null;
		apiKeys: Record<string, string>;
		vaultProviders: string[];
		onSelectProvider: (provider: string, modelId: string) => void;
		onForgetKey: (provider: string) => void;
	}

	let { activeModel, apiKeys, vaultProviders, onSelectProvider, onForgetKey }: Props = $props();

	function providerDisplayName(provider: string): string {
		return PROVIDER_CONFIG[provider as Exclude<Provider, 'ollama' | 'webllm'>]?.name ?? provider;
	}

	function getBadge(provider: string): string | undefined {
		if (apiKeys[provider]) return undefined;
		if (vaultProviders.length > 0) return 'locked';
		return 'add key';
	}
</script>

<div class="palette-tab-content">
	<div class="palette-providers-grid">
		<!-- Claude (active) -->
		<div class="palette-provider-group">
			<div class="palette-provider-title">
				<img src={PROVIDER_LOGOS.claude} alt="Claude" class="palette-provider-logo" />
				<span class="palette-provider-name">Claude</span>
			</div>
			<div class="palette-provider-models">
				{#each PROVIDER_MODELS.claude as model (model.id)}
					<button
						class="palette-model-row"
						class:active={activeModel?.provider === 'claude' && activeModel.modelId === model.id}
						onclick={() => onSelectProvider('claude', model.id)}
					>
						<span>{model.label}</span>
						<div class="palette-model-meta">
							{#if activeModel?.provider === 'claude' && activeModel.modelId === model.id}
								<span class="palette-active-dot"></span>
							{/if}
							{#if getBadge('claude')}
								<span class="palette-badge">{getBadge('claude')}</span>
							{/if}
						</div>
					</button>
				{/each}
				{#if apiKeys['claude']}
					<button class="palette-forget-key" onclick={() => onForgetKey('claude')}>
						Forget saved key
					</button>
				{/if}
			</div>
		</div>

		<!-- Other providers (coming soon) -->
		{#each KEY_BASED_PROVIDERS.filter((p) => p !== 'claude') as provider (provider)}
			{@const models = PROVIDER_MODELS[provider]}
			{@const logo = PROVIDER_LOGOS[provider]}
			{@const name = providerDisplayName(provider)}
			<div class="palette-provider-group">
				<div class="palette-provider-title">
					{#if logo}
						<img src={logo} alt={name} class="palette-provider-logo" />
					{/if}
					<span class="palette-provider-name">{name}</span>
					<span class="palette-soon-badge">soon</span>
				</div>
				<div class="palette-provider-models">
					{#each models as model (model.id)}
						<button class="palette-model-row disabled" disabled>
							<span>{model.label}</span>
							<div class="palette-model-meta"></div>
						</button>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</div>
