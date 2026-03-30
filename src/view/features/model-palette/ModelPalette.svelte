<script lang="ts">
	import './palette.css';
	import * as app from '@/app';
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
		onClearCredential: (provider: string) => void;
		onSetContextSize: (size: app.providers.ContextSize) => void;
		onRemoveCachedModel: (provider: app.providers.Provider, modelId: string) => Promise<void>;
		onClearCachedModels: (provider: app.providers.Provider) => Promise<void>;
	}

	type CredentialFlow = {
		provider: app.providers.ProviderEntry;
		mode: 'unlock' | 'save';
		pendingModel: app.providers.ActiveModel | null;
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
		onClearCredential,
		onSetContextSize,
		onRemoveCachedModel,
		onClearCachedModels
	}: Props = $props();

	let credentialFlow: CredentialFlow | null = $state(null);
	let credentialInput = $state('');
	let passwordInput = $state('');
	let confirmPasswordInput = $state('');
	let credentialError: string | null = $state(null);
	let isSubmitting = $state(false);
	let webllmSearchQuery = $state('');

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
			webllmSearchQuery = '';
		}
	});

	function handleClose() {
		credentialFlow = null;
		credentialInput = '';
		passwordInput = '';
		confirmPasswordInput = '';
		credentialError = null;
		webllmSearchQuery = '';
		onClose();
	}

	function getActiveTabLabel(): string {
		if (!activeModel) return 'Frontier';
		if (activeModel.provider === 'ollama') return 'Ollama';
		if (activeModel.provider === 'webllm') return 'WebLLM';
		return 'Frontier';
	}

	function getActiveModelLabel(): string {
		if (!activeModel) return 'No model selected';
		const provider = providerState.providers.find((item) => item.id === activeModel.provider);
		const model = provider?.models.find((item) => item.id === activeModel.modelId);
		return model?.label ?? activeModel.modelId;
	}

	function getCredentialBadge(provider: app.providers.ProviderEntry): string | undefined {
		if (provider.credentialState === 'ready' || provider.credentialState === 'not-required') {
			return undefined;
		}
		return provider.credentialState === 'locked' ? 'locked' : 'add key';
	}

	function getWebLLMMemoryHint(): string {
		if (!webllmProvider?.context) return '';
		if (webllmProvider.context.value <= 4096) return 'Low memory';
		if (webllmProvider.context.value <= 8192) return 'Moderate';
		return 'More memory';
	}

	const filteredWebLLMModels = $derived.by(() => {
		const models = webllmProvider?.models ?? [];
		const query = webllmSearchQuery.trim().toLowerCase();
		if (!query) return models.slice(0, 20);
		return models.filter((model) => model.id.toLowerCase().includes(query));
	});

	async function beginModelSelection(provider: app.providers.ProviderEntry, modelId: string) {
		const model = provider.models.find((item) => item.id === modelId);
		if (!model?.enabled) return;

		const selection = { provider: provider.id, modelId };
		if (provider.credentialState === 'locked') {
			credentialFlow = { provider, mode: 'unlock', pendingModel: selection };
			return;
		}
		if (provider.credentialState === 'missing') {
			credentialFlow = { provider, mode: 'save', pendingModel: selection };
			return;
		}

		await onSelectModel(selection);
		handleClose();
	}

	async function submitCredentialFlow() {
		if (!credentialFlow) return;
		credentialError = null;

		if (credentialFlow.mode === 'save') {
			if (passwordInput !== confirmPasswordInput) {
				credentialError = 'Passwords do not match.';
				return;
			}
			if (passwordInput.length < 8) {
				credentialError = 'Password must be at least 8 characters.';
				return;
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
			handleClose();
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
						<label class="palette-label" for="credential-input">Credential</label>
						<Input id="credential-input" type="password" bind:value={credentialInput} />
					</div>
				{/if}

				<div class="palette-field">
					<label class="palette-label" for="password-input">
						{credentialFlow.mode === 'unlock' ? 'Password' : 'Master Password'}
					</label>
					<Input id="password-input" type="password" bind:value={passwordInput} />
				</div>

				{#if credentialFlow.mode === 'save'}
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
						{credentialFlow.mode === 'unlock' ? 'Unlock' : 'Save & Use'}
					</Button>
				</div>
			</div>
		{:else}
			<div class="palette-content">
				<div class="palette-current-model">
					<span class="palette-current-label">Current:</span>
					<span class="palette-current-provider">{getActiveTabLabel()}</span>
					<span class="palette-current-separator">/</span>
					<span class="palette-current-name">{getActiveModelLabel()}</span>
				</div>

				<div class="palette-tabs">
					<button
						class="palette-tab"
						class:active={activeTab === 'ollama'}
						onclick={() => (activeTab = 'ollama')}
					>
						{#if PROVIDER_LOGOS.ollama}
							<img src={PROVIDER_LOGOS.ollama} alt="Ollama" class="palette-tab-icon" />
						{/if}
						Ollama
					</button>
					<button
						class="palette-tab"
						class:active={activeTab === 'frontier'}
						onclick={() => (activeTab = 'frontier')}
					>
						Frontier
					</button>
					<button
						class="palette-tab"
						class:active={activeTab === 'webllm'}
						onclick={() => (activeTab = 'webllm')}
					>
						{#if PROVIDER_LOGOS.webllm}
							<img src={PROVIDER_LOGOS.webllm} alt="WebLLM" class="palette-tab-icon" />
						{/if}
						WebLLM
					</button>
				</div>

				<div class="palette-scroll">
					{#if activeTab === 'frontier'}
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
									</div>

									<div class="palette-provider-models">
										{#each provider.models as model (model.id)}
											<button
												class="palette-model-row"
												class:active={activeModel?.provider === provider.id &&
													activeModel?.modelId === model.id}
												disabled={!model.enabled}
												onclick={() => beginModelSelection(provider, model.id)}
											>
												<span>{model.label}</span>
												<div class="palette-model-meta">
													{#if activeModel?.provider === provider.id && activeModel?.modelId === model.id}
														<span class="palette-active-dot"></span>
													{/if}
													{#if getCredentialBadge(provider)}
														<span class="palette-badge">{getCredentialBadge(provider)}</span>
													{/if}
												</div>
											</button>
										{/each}
										{#if provider.credentialState === 'ready'}
											<button
												class="palette-forget-key"
												onclick={() => onClearCredential(provider.id)}
											>
												Forget saved credential
											</button>
										{/if}
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
										<span class="palette-soon-badge">soon</span>
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
								<div class="palette-provider-title">
									{#if PROVIDER_LOGOS[ollamaProvider.id]}
										<img
											src={PROVIDER_LOGOS[ollamaProvider.id]}
											alt={ollamaProvider.name}
											class="palette-provider-logo"
										/>
									{/if}
									<span class="palette-provider-name">{ollamaProvider.name}</span>
								</div>
								{#if ollamaProvider.connection}
									<div class="palette-ollama-connect">
										<Input
											value={ollamaProvider.connection.value}
											class="palette-connect-input"
											placeholder="localhost:11434"
										/>
										<Button
											size="sm"
											variant={ollamaProvider.connection.status === 'connected'
												? 'secondary'
												: 'default'}
											class="palette-connect-btn"
											onclick={() => onConnect(ollamaProvider.id, ollamaProvider.connection?.value)}
											disabled={ollamaProvider.connection.status === 'connecting'}
										>
											{ollamaProvider.connection.status === 'connecting'
												? 'Connecting...'
												: ollamaProvider.connection.status === 'connected'
													? 'Reconnect'
													: 'Connect'}
										</Button>
										{#if ollamaProvider.connection.status === 'error'}
											<span class="palette-connect-error">Failed</span>
										{/if}
									</div>
								{/if}

								{#if ollamaProvider.connection?.status === 'connected' && ollamaProvider.models.length === 0}
									<p class="palette-hint">No models found.</p>
								{/if}
								{#if ollamaProvider.connection?.status === 'connected' && ollamaProvider.models.length > 0}
									<div class="palette-model-grid">
										{#each ollamaProvider.models as model (model.id)}
											<button
												class="palette-model-row"
												class:active={activeModel?.provider === 'ollama' &&
													activeModel?.modelId === model.id}
												onclick={() => beginModelSelection(ollamaProvider, model.id)}
											>
												<span>{model.label}</span>
												<div class="palette-model-meta">
													{#if activeModel?.provider === 'ollama' && activeModel?.modelId === model.id}
														<span class="palette-active-dot"></span>
													{/if}
												</div>
											</button>
										{/each}
									</div>
								{/if}
							</div>
						{/if}
					{:else if webllmProvider}
						<div class="palette-tab-content">
							<div class="palette-provider-title">
								{#if PROVIDER_LOGOS[webllmProvider.id]}
									<img
										src={PROVIDER_LOGOS[webllmProvider.id]}
										alt={webllmProvider.name}
										class="palette-provider-logo"
									/>
								{/if}
								<span class="palette-provider-name">{webllmProvider.name}</span>
							</div>

							{#if webllmProvider.context}
								<div class="palette-webllm-context">
									<span class="palette-webllm-context-label">Context window:</span>
									{#each webllmProvider.context.options as option (option.value)}
										<button
											class="palette-webllm-context-btn"
											class:active={webllmProvider.context.value === option.value}
											disabled={webllmProvider.loadState?.status === 'loading'}
											onclick={() => onSetContextSize(option.value)}
										>
											{option.label}
										</button>
									{/each}
									<span class="palette-webllm-context-hint">{getWebLLMMemoryHint()}</span>
								</div>
							{/if}

							{#if webllmProvider.loadState?.status === 'loading'}
								<div class="palette-webllm-loading">
									<div class="palette-webllm-progress-bar">
										<div
											class="palette-webllm-progress-fill"
											style={`width: ${webllmProvider.loadState.progress * 100}%`}
										></div>
									</div>
									<p class="palette-hint">
										{webllmProvider.loadState.text ||
											`Loading... ${Math.round(webllmProvider.loadState.progress * 100)}%`}
									</p>
								</div>
							{/if}

							{#if webllmProvider.loadState?.error}
								<p class="palette-error">{webllmProvider.loadState.error}</p>
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
									<button
										class="palette-model-row"
										class:active={activeModel?.provider === 'webllm' &&
											activeModel?.modelId === model.id}
										disabled={webllmProvider.loadState?.status === 'loading'}
										onclick={() => beginModelSelection(webllmProvider, model.id)}
									>
										<span>{model.id}</span>
										<div class="palette-model-meta">
											{#if model.meta}
												<span class="palette-vram">{model.meta}</span>
											{/if}
											{#if activeModel?.provider === 'webllm' && activeModel?.modelId === model.id}
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
									{webllmProvider.models.length} models available. Search to find more.
								</p>
							{/if}

							<div class="palette-webllm-cache-actions">
								{#if activeModel?.provider === 'webllm'}
									<button
										class="palette-forget-key"
										onclick={() => onRemoveCachedModel('webllm', activeModel.modelId)}
									>
										Remove cached model ({activeModel.modelId})
									</button>
								{/if}
								<button class="palette-forget-key" onclick={() => onClearCachedModels('webllm')}>
									Clear all cached models
								</button>
							</div>
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

	.palette-current-model {
		padding: 0.75rem 1.5rem;
		border-bottom: 1px solid hsl(var(--border));
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.8125rem;
	}

	.palette-current-label {
		color: hsl(var(--muted-foreground));
	}

	.palette-current-provider {
		font-weight: 600;
		color: hsl(var(--foreground));
		text-transform: lowercase;
	}

	.palette-current-separator {
		color: hsl(var(--muted-foreground));
	}

	.palette-current-name {
		color: hsl(var(--foreground));
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
		gap: 0.375rem;
		padding: 0.625rem 1rem;
		font-size: 0.8125rem;
		font-weight: 500;
		color: hsl(var(--muted-foreground));
		background: transparent;
		border: none;
		border-bottom: 2px solid transparent;
		cursor: pointer;
		transition:
			color 0.15s,
			border-color 0.15s;
		margin-bottom: -1px;
	}

	.palette-tab:hover {
		color: hsl(var(--foreground));
	}

	.palette-tab.active {
		color: hsl(var(--foreground));
		border-bottom-color: hsl(var(--primary));
	}

	.palette-tab-icon {
		height: 0.875rem;
		width: 0.875rem;
		object-fit: contain;
		border-radius: 2px;
	}

	.palette-scroll {
		overflow-y: auto;
		flex: 1;
		padding: 1rem 1.5rem 1.5rem;
	}

	@media (max-width: 900px) {
		:global(.palette-providers-grid) {
			grid-template-columns: 1fr;
		}

		:global(.palette-model-grid) {
			grid-template-columns: 1fr;
		}
	}
</style>
