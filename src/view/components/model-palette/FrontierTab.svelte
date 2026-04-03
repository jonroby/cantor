<script lang="ts">
	import { Lock, Unlock } from 'lucide-svelte';
	import { PROVIDER_LOGOS } from '@/view/assets';
	import type * as app from '@/app';

	interface Props {
		vaultState: app.providers.VaultState;
		activeModel: app.providers.ActiveModel | null;
		enabledProviders: app.providers.ProviderEntry[];
		comingSoonProviders: app.providers.ProviderEntry[];
		onLockVault: () => void;
		onUnlockVault: () => void;
		onBeginAuth: (provider: app.providers.ProviderEntry) => void;
		onRemoveCredential: (providerId: string) => void;
		onSelectModel: (provider: app.providers.ProviderEntry, modelId: string) => void;
	}

	let {
		vaultState,
		activeModel,
		enabledProviders,
		comingSoonProviders,
		onLockVault,
		onUnlockVault,
		onBeginAuth,
		onRemoveCredential,
		onSelectModel
	}: Props = $props();
</script>

{#if vaultState === 'unlocked'}
	<div class="palette-vault-bar">
		<Unlock size={13} />
		<span class="palette-vault-label">Vault unlocked</span>
		<button class="palette-vault-btn palette-vault-btn-lock" onclick={onLockVault}>Lock</button>
	</div>
{:else if vaultState === 'locked'}
	<div class="palette-vault-bar">
		<Lock size={13} />
		<span class="palette-vault-label">Vault locked</span>
		<button class="palette-vault-btn palette-vault-btn-unlock" onclick={onUnlockVault}>
			Unlock
		</button>
	</div>
{/if}
<div class="palette-providers-grid">
	{#each enabledProviders as provider (provider.id)}
		<div class="palette-provider-group">
			<div class="palette-provider-title">
				{#if PROVIDER_LOGOS[provider.id]}
					<img
						src={PROVIDER_LOGOS[provider.id]}
						alt={provider.name}
						class="palette-provider-logo"
					/>
				{/if}
				<span class="palette-provider-name">{provider.name}</span>
				{#if vaultState !== 'locked'}
					<span class="palette-provider-auth">
						{#if provider.credentialState === 'ready'}
							<button class="palette-auth-btn" onclick={() => onRemoveCredential(provider.id)}>
								Remove key
							</button>
						{:else}
							<button class="palette-auth-btn" onclick={() => onBeginAuth(provider)}>
								Add key
							</button>
						{/if}
					</span>
				{/if}
			</div>

			<div class="palette-provider-models">
				{#each provider.models as model (model.id)}
					{@const loggedIn = provider.credentialState === 'ready'}
					<button
						class="palette-model-row"
						class:active={loggedIn &&
							activeModel?.provider === provider.id &&
							activeModel?.modelId === model.id}
						class:disabled={!loggedIn}
						disabled={!model.enabled || !loggedIn}
						onclick={() => onSelectModel(provider, model.id)}
					>
						<span>{model.label}</span>
					</button>
				{/each}
			</div>
		</div>
	{/each}

	{#each comingSoonProviders as provider (provider.id)}
		<div class="palette-provider-group">
			<div class="palette-provider-title">
				{#if PROVIDER_LOGOS[provider.id]}
					<img
						src={PROVIDER_LOGOS[provider.id]}
						alt={provider.name}
						class="palette-provider-logo"
					/>
				{/if}
				<span class="palette-provider-name">{provider.name}</span>
				<span class="palette-soon-badge">Coming Soon</span>
			</div>

			<div class="palette-provider-models">
				{#each provider.models as model (model.id)}
					<button class="palette-model-row disabled" disabled>
						<span>{model.label}</span>
						<div class="palette-model-meta"></div>
					</button>
				{/each}
			</div>
		</div>
	{/each}
</div>
