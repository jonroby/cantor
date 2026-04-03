<script lang="ts">
	import './palette.css';
	import * as app from '@/app';
	import { toast } from 'svelte-sonner';
	import { Lock, Unlock } from 'lucide-svelte';
	import { PROVIDER_LOGOS } from '@/view/assets';
	import { Button, Input } from '@/view/components/custom';

	interface Props {
		open: boolean;
		onClose: () => void;
		state: app.providers.State;
		onConnect: (provider: app.providers.Provider, value?: string) => Promise<void>;
		onSelectModel: (model: app.providers.ActiveModel) => Promise<void> | void;
		onUnlockCredentials: (password: string) => Promise<void>;
		onSaveCredential: (provider: string, credential: string, password: string) => Promise<void>;
		onLockVault: () => Promise<void>;
		onRemoveCredential: (provider: string) => void;
		onSetContextSize: (size: app.providers.ContextSize) => void;
		onRemoveCachedModel: (provider: app.providers.Provider, modelId: string) => Promise<void>;
		onClearCachedModels: (provider: app.providers.Provider) => Promise<void>;
	}

	type CredentialFlow = {
		provider: app.providers.ProviderEntry;
		mode: 'unlock' | 'save';
		pendingModel: app.providers.ActiveModel | null;
		returnToPalette: boolean;
	};
	type Tab = 'ollama' | 'frontier' | 'webllm';

	let {
		open,
		onClose,
		state: providerState,
		onConnect,
		onSelectModel,
		onUnlockCredentials,
		onSaveCredential,
		onLockVault,
		onRemoveCredential,
		onSetContextSize: _onSetContextSize,
		onRemoveCachedModel: _onRemoveCachedModel,
		onClearCachedModels: _onClearCachedModels
	}: Props = $props();

	let credentialFlow: CredentialFlow | null = $state(null);
	let credentialInput = $state('');
	let passwordInput = $state('');
	let confirmPasswordInput = $state('');
	let credentialError: string | null = $state(null);
	let isSubmitting = $state(false);

	const activeModel = $derived(providerState.activeModel);
	const enabledRemoteProviders = $derived(
		providerState.providers.filter(
			(provider) => provider.kind === 'remote' && provider.models.some((m) => m.enabled)
		)
	);
	const comingSoonProviders = $derived(
		providerState.providers.filter(
			(provider) => provider.kind === 'remote' && !provider.models.some((m) => m.enabled)
		)
	);
	const ollamaProvider = $derived(
		providerState.providers.find((provider) => provider.id === 'ollama') ?? null
	);
	const webllmProvider = $derived(
		providerState.providers.find((provider) => provider.id === 'webllm') ?? null
	);

	const defaultTab: Tab = $derived.by(() => {
		if (!activeModel) return 'frontier';
		if (activeModel.provider === 'ollama') return 'ollama';
		if (activeModel.provider === 'webllm') return 'webllm';
		return 'frontier';
	});

	let activeTab: Tab = $state('frontier');

	$effect(() => {
		if (open) {
			activeTab = defaultTab;
		}
	});

	function handleClose() {
		credentialFlow = null;
		credentialInput = '';
		passwordInput = '';
		confirmPasswordInput = '';
		credentialError = null;
		onClose();
	}

	function getWebLLMMemoryHint(): string {
		if (!webllmProvider?.context) return '';
		if (webllmProvider.context.value <= 4096) return 'Low memory';
		if (webllmProvider.context.value <= 8192) return 'Moderate';
		return 'More memory';
	}

	function beginAuth(provider: app.providers.ProviderEntry) {
		credentialError = null;
		credentialInput = '';
		passwordInput = '';
		confirmPasswordInput = '';
		const firstEnabled = provider.models.find((m) => m.enabled);
		const defaultModel = firstEnabled ? { provider: provider.id, modelId: firstEnabled.id } : null;
		if (providerState.vaultState === 'locked') {
			credentialFlow = {
				provider,
				mode: 'unlock',
				pendingModel: defaultModel,
				returnToPalette: true
			};
		} else {
			credentialFlow = {
				provider,
				mode: 'save',
				pendingModel: defaultModel,
				returnToPalette: true
			};
		}
	}

	async function beginModelSelection(provider: app.providers.ProviderEntry, modelId: string) {
		const model = provider.models.find((item) => item.id === modelId);
		if (!model?.enabled) return;

		const selection = { provider: provider.id, modelId };
		if (providerState.vaultState === 'locked') {
			credentialError = null;
			credentialInput = '';
			passwordInput = '';
			confirmPasswordInput = '';
			credentialFlow = {
				provider,
				mode: 'unlock',
				pendingModel: selection,
				returnToPalette: false
			};
			return;
		}
		if (provider.credentialState === 'missing') {
			credentialError = null;
			credentialInput = '';
			passwordInput = '';
			confirmPasswordInput = '';
			credentialFlow = { provider, mode: 'save', pendingModel: selection, returnToPalette: false };
			return;
		}

		await onSelectModel(selection);
		const modelEntry = provider.models.find((m) => m.id === modelId);
		toast.success(`${modelEntry?.label ?? modelId} selected`);
	}

	async function submitCredentialFlow() {
		if (!credentialFlow) return;
		credentialError = null;

		if (credentialFlow.mode === 'save') {
			const isNewVault = providerState.vaultState === 'empty';
			if (isNewVault) {
				if (passwordInput !== confirmPasswordInput) {
					credentialError = 'Passwords do not match.';
					return;
				}
				if (passwordInput.length < 8) {
					credentialError = 'Password must be at least 8 characters.';
					return;
				}
			}
		}

		isSubmitting = true;
		try {
			if (credentialFlow.mode === 'unlock') {
				await onUnlockCredentials(passwordInput);
			} else {
				await onSaveCredential(credentialFlow.provider.id, credentialInput.trim(), passwordInput);
			}
			if (credentialFlow.pendingModel) {
				await onSelectModel(credentialFlow.pendingModel);
			}
			if (credentialFlow.returnToPalette) {
				toast.success('Logged in');
				credentialFlow = null;
			} else {
				const modelEntry = credentialFlow.pendingModel
					? credentialFlow.provider.models.find(
							(m) => m.id === credentialFlow!.pendingModel!.modelId
						)
					: null;
				toast.success(`${modelEntry?.label ?? 'Model'} selected`);
				handleClose();
			}
		} catch (error) {
			credentialError = error instanceof Error ? error.message : 'Action failed.';
		} finally {
			isSubmitting = false;
		}
	}
</script>

{#if open}
	<button class="modal-scrim" type="button" aria-label="Close model palette" onclick={handleClose}
	></button>
	<div class="modal-panel palette-panel">
		{#if credentialFlow}
			<div class="palette-key-flow">
				<div>
					<h2 class="palette-heading">
						{credentialFlow.mode === 'unlock'
							? 'Unlock credentials'
							: `Save credential for ${credentialFlow.provider.name}`}
					</h2>
				</div>

				{#if credentialFlow.mode === 'save'}
					<div class="palette-field">
						<label class="palette-label" for="credential-input">API Key</label>
						<Input id="credential-input" type="password" bind:value={credentialInput} />
					</div>
				{/if}

				<div class="palette-field">
					<label class="palette-label" for="password-input">
						{credentialFlow.mode === 'unlock' ? 'Password' : 'Master Password'}
					</label>
					<Input id="password-input" type="password" bind:value={passwordInput} />
				</div>

				{#if credentialFlow.mode === 'save' && providerState.vaultState === 'empty'}
					<div class="palette-field">
						<label class="palette-label" for="confirm-password-input">Confirm Password</label>
						<Input id="confirm-password-input" type="password" bind:value={confirmPasswordInput} />
					</div>
				{/if}

				{#if credentialError}
					<p class="palette-error">{credentialError}</p>
				{/if}

				<div class="palette-actions">
					<Button variant="ghost" onclick={() => (credentialFlow = null)} disabled={isSubmitting}>
						Back
					</Button>
					<Button onclick={submitCredentialFlow} disabled={isSubmitting || !passwordInput}>
						{#if isSubmitting}
							Validating...
						{:else}
							{credentialFlow.mode === 'unlock' ? 'Unlock' : 'Save'}
						{/if}
					</Button>
				</div>

				{#if credentialFlow.mode === 'unlock'}
					<button
						class="palette-forget-key"
						onclick={() => {
							if (credentialFlow) {
								onRemoveCredential(credentialFlow.provider.id);
								credentialFlow = null;
							}
						}}
					>
						Forget saved key
					</button>
				{/if}
			</div>
		{:else}
			<div class="palette-content">
				<div class="palette-tabs">
					<button
						class="palette-tab"
						class:active={activeTab === 'frontier'}
						onclick={() => (activeTab = 'frontier')}
					>
						Frontier
					</button>
					<button
						class="palette-tab"
						class:active={activeTab === 'ollama'}
						onclick={() => (activeTab = 'ollama')}
					>
						Ollama
					</button>
					<button
						class="palette-tab palette-tab-muted"
						class:active={activeTab === 'webllm'}
						onclick={() => (activeTab = 'webllm')}
					>
						WebLLM
					</button>
				</div>

				<div class="palette-scroll">
					{#if activeTab === 'frontier'}
						{#if providerState.vaultState === 'unlocked'}
							<div class="palette-vault-bar">
								<Unlock size={13} />
								<span class="palette-vault-label">Vault unlocked</span>
								<button
									class="palette-vault-btn palette-vault-btn-lock"
									onclick={async () => {
										await onLockVault();
										toast.success('Vault locked');
									}}
								>
									Lock
								</button>
							</div>
						{:else if providerState.vaultState === 'locked'}
							<div class="palette-vault-bar">
								<Lock size={13} />
								<span class="palette-vault-label">Vault locked</span>
								<button
									class="palette-vault-btn palette-vault-btn-unlock"
									onclick={() => {
										const dummyProvider = enabledRemoteProviders[0];
										if (dummyProvider) beginAuth(dummyProvider);
									}}
								>
									Unlock
								</button>
							</div>
						{/if}
						<div class="palette-providers-grid">
							{#each enabledRemoteProviders as provider (provider.id)}
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
										{#if providerState.vaultState !== 'locked'}
											<span class="palette-provider-auth">
												{#if provider.credentialState === 'ready'}
													<button
														class="palette-auth-btn"
														onclick={() => {
															onRemoveCredential(provider.id);
															toast.success(`Removed ${provider.name} key`);
														}}
													>
														Remove key
													</button>
												{:else}
													<button class="palette-auth-btn" onclick={() => beginAuth(provider)}>
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
												onclick={() => beginModelSelection(provider, model.id)}
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
					{:else if activeTab === 'ollama'}
						{#if ollamaProvider}
							<div class="palette-tab-content">
								<div class="palette-provider-group">
									<div class="palette-provider-title">
										{#if PROVIDER_LOGOS[ollamaProvider.id]}
											<img
												src={PROVIDER_LOGOS[ollamaProvider.id]}
												alt={ollamaProvider.name}
												class="palette-provider-logo"
											/>
										{/if}
										<span class="palette-provider-name">{ollamaProvider.name}</span>
										{#if ollamaProvider.connection}
											<span class="palette-provider-auth">
												<button
													class="palette-auth-btn"
													onclick={() =>
														onConnect(ollamaProvider.id, ollamaProvider.connection?.value)}
													disabled={ollamaProvider.connection.status === 'connecting'}
												>
													{ollamaProvider.connection.status === 'connecting'
														? 'Connecting...'
														: ollamaProvider.connection.status === 'connected'
															? 'Reconnect'
															: 'Connect'}
												</button>
											</span>
										{/if}
									</div>

									{#if ollamaProvider.connection}
										<div class="palette-ollama-connect">
											<Input
												value={ollamaProvider.connection.value}
												class="palette-connect-input"
												placeholder="localhost:11434"
											/>
											{#if ollamaProvider.connection.status === 'error'}
												<span class="palette-connect-error">Failed</span>
											{/if}
										</div>
									{/if}

									{#if ollamaProvider.connection?.status === 'connected' && ollamaProvider.models.length === 0}
										<p class="palette-hint">No models found.</p>
									{/if}
									{#if ollamaProvider.connection?.status === 'connected' && ollamaProvider.models.length > 0}
										<div class="palette-provider-models">
											{#each ollamaProvider.models as model (model.id)}
												<button
													class="palette-model-row"
													class:active={activeModel?.provider === 'ollama' &&
														activeModel?.modelId === model.id}
													onclick={() => beginModelSelection(ollamaProvider, model.id)}
												>
													<span>{model.label}</span>
												</button>
											{/each}
										</div>
									{/if}
								</div>
							</div>
						{/if}
					{:else if webllmProvider}
						<div class="palette-tab-content palette-disabled-overlay">
							<p class="palette-hint" style="padding-top: 0.5rem;">Coming Soon</p>

							{#if webllmProvider.context}
								<div class="palette-webllm-context">
									<span class="palette-webllm-context-label">Context window:</span>
									{#each webllmProvider.context.options as option (option.value)}
										<button
											class="palette-webllm-context-btn"
											class:active={webllmProvider.context.value === option.value}
											disabled
										>
											{option.label}
										</button>
									{/each}
									<span class="palette-webllm-context-hint">{getWebLLMMemoryHint()}</span>
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
								{#each webllmProvider.models.slice(0, 20) as model (model.id)}
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

							{#if webllmProvider.models.length > 0}
								<p class="palette-hint">
									{webllmProvider.models.length} models available.
								</p>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.palette-panel {
		width: min(900px, calc(100vw - 2rem));
		max-height: 85vh;
		padding: 0;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.palette-content {
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.palette-tabs {
		display: flex;
		border-bottom: 1px solid hsl(var(--border));
		padding: 0 1.5rem;
		gap: 0;
	}

	.palette-tab {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		flex: 1;
		padding: 0.875rem 1rem;
		font-size: var(--text-base);
		font-weight: 500;
		color: hsl(var(--muted-foreground));
		background: transparent;
		border: none;
		border-bottom: 2px solid transparent;
		cursor: pointer;
		transition:
			color var(--duration-normal),
			border-color var(--duration-normal);
		margin-bottom: -1px;
	}

	.palette-tab:hover {
		color: hsl(var(--foreground));
	}

	.palette-tab.active {
		color: hsl(var(--foreground));
		border-bottom-color: hsl(var(--primary));
	}

	.palette-scroll {
		overflow-y: auto;
		flex: 1;
		padding: 1rem 1.5rem 1.5rem;
	}
</style>
