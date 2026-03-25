<script lang="ts">
	import { PROVIDER_MODELS, PROVIDER_CONFIG, KEY_BASED_PROVIDERS } from '$lib/chat/models';
	import type { ActiveModel, OllamaStatus, Provider } from '$lib/chat/models';
	import type { WebLLMStatus, WebLLMModelEntry, WebLLMContextSize } from '$lib/chat/webllm';
	import Button from '$lib/components/ui/button.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import { PROVIDER_LOGOS } from '$lib/chat/logos';

	interface Props {
		open: boolean;
		onClose: () => void;
		activeModel: ActiveModel | null;
		onSelectModel: (model: ActiveModel) => void;
		ollamaUrl: string;
		ollamaStatus: OllamaStatus;
		ollamaModels: string[];
		onConnectOllama: (url: string) => Promise<void>;
		apiKeys: Record<string, string>;
		vaultProviders: string[];
		onUnlockKeys: (password: string) => Promise<void>;
		onSaveKey: (provider: string, apiKey: string, password: string) => Promise<void>;
		onForgetKey: (provider: string) => void;
		webllmStatus: WebLLMStatus;
		webllmProgress: number;
		webllmProgressText: string;
		webllmModels: WebLLMModelEntry[];
		webllmError: string | null;
		webllmContextSize: WebLLMContextSize;
		webllmContextOptions: ReadonlyArray<{ label: string; value: WebLLMContextSize }>;
		onWebLLMContextSizeChange: (size: WebLLMContextSize) => void;
		onLoadWebLLMModel: (modelId: string) => Promise<void>;
		onDeleteWebLLMCache: (modelId: string) => Promise<void>;
		onDeleteAllWebLLMCaches: () => Promise<void>;
	}

	type KeyFlow = { provider: string; mode: 'unlock' | 'setup' };
	type Tab = 'ollama' | 'frontier' | 'webllm';

	let {
		open,
		onClose,
		activeModel,
		onSelectModel,
		ollamaUrl,
		ollamaStatus,
		ollamaModels,
		onConnectOllama,
		apiKeys,
		vaultProviders,
		onUnlockKeys,
		onSaveKey,
		onForgetKey,
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

	let urlInput = $derived(ollamaUrl);
	let keyFlow: KeyFlow | null = $state(null);
	let pendingModel: ActiveModel | null = $state(null);
	let apiKeyInput = $state('');
	let passwordInput = $state('');
	let confirmPasswordInput = $state('');
	let keyError: string | null = $state(null);
	let isSubmitting = $state(false);

	// Default tab based on current active model provider
	const defaultTab: Tab = $derived.by(() => {
		if (!activeModel) return 'frontier';
		if (activeModel.provider === 'ollama') return 'ollama';
		if (activeModel.provider === 'webllm') return 'webllm';
		return 'frontier';
	});

	let activeTab: Tab = $state('frontier');

	// Reset tab to match active model when palette opens
	$effect(() => {
		if (open) {
			activeTab = defaultTab;
		}
	});

	function handleClose() {
		keyFlow = null;
		apiKeyInput = '';
		passwordInput = '';
		confirmPasswordInput = '';
		keyError = null;
		onClose();
	}

	function handleSelectModel(model: ActiveModel) {
		onSelectModel(model);
		handleClose();
	}

	function handleSelectProvider(provider: string, modelId: string) {
		if (apiKeys[provider]) {
			handleSelectModel({ provider: provider as Provider, modelId });
		} else if (vaultProviders.length > 0) {
			pendingModel = { provider: provider as Provider, modelId };
			keyFlow = { provider, mode: 'unlock' };
			passwordInput = '';
			keyError = null;
		} else {
			pendingModel = { provider: provider as Provider, modelId };
			keyFlow = { provider, mode: 'setup' };
			apiKeyInput = '';
			passwordInput = '';
			confirmPasswordInput = '';
			keyError = null;
		}
	}

	async function handleUnlock() {
		isSubmitting = true;
		keyError = null;
		try {
			await onUnlockKeys(passwordInput);
			if (pendingModel) {
				handleSelectModel(pendingModel);
			}
			keyFlow = null;
			passwordInput = '';
		} catch (err) {
			keyError = err instanceof Error ? err.message : 'Failed to unlock.';
		} finally {
			isSubmitting = false;
		}
	}

	async function handleSaveKey() {
		if (passwordInput !== confirmPasswordInput) {
			keyError = 'Passwords do not match.';
			return;
		}
		if (passwordInput.length < 8) {
			keyError = 'Password must be at least 8 characters.';
			return;
		}
		if (!keyFlow) return;
		isSubmitting = true;
		keyError = null;
		try {
			await onSaveKey(keyFlow.provider, apiKeyInput.trim(), passwordInput);
			if (pendingModel) {
				handleSelectModel(pendingModel);
			}
			keyFlow = null;
			apiKeyInput = '';
			passwordInput = '';
			confirmPasswordInput = '';
		} catch (err) {
			keyError = err instanceof Error ? err.message : 'Failed to save key.';
		} finally {
			isSubmitting = false;
		}
	}

	const isOllamaConnected = $derived(ollamaStatus === 'connected');

	function providerDisplayName(provider: string): string {
		return PROVIDER_CONFIG[provider as Exclude<Provider, 'ollama' | 'webllm'>]?.name ?? provider;
	}

	function keyPlaceholder(provider: string): string {
		return (
			PROVIDER_CONFIG[provider as Exclude<Provider, 'ollama' | 'webllm'>]?.keyPlaceholder ??
			'sk-...'
		);
	}

	function getBadge(provider: string): string | undefined {
		if (apiKeys[provider]) return undefined;
		if (vaultProviders.length > 0) return 'locked';
		return 'add key';
	}

	function getActiveTabLabel(): string {
		if (!activeModel) return 'None';
		if (activeModel.provider === 'ollama') return 'Ollama';
		if (activeModel.provider === 'webllm') return 'WebLLM';
		return 'Frontier';
	}

	function getActiveModelLabel(): string {
		if (!activeModel) return 'No model selected';
		// For frontier providers, try to find a nice label
		if (activeModel.provider !== 'ollama' && activeModel.provider !== 'webllm') {
			const models =
				PROVIDER_MODELS[activeModel.provider as Exclude<Provider, 'ollama' | 'webllm'>];
			const found = models?.find((m) => m.id === activeModel.modelId);
			if (found) return found.label;
		}
		return activeModel.modelId;
	}
</script>

{#if open}
	<button class="modal-scrim" type="button" aria-label="Close model palette" onclick={handleClose}
	></button>
	<div class="modal-panel palette-panel">
		{#if keyFlow}
			<div class="palette-key-flow">
				<div>
					<h2 class="palette-heading">
						{keyFlow.mode === 'unlock'
							? 'Unlock API Keys'
							: `Add ${providerDisplayName(keyFlow.provider)} API Key`}
					</h2>
				</div>

				{#if keyFlow.mode === 'setup'}
					<div class="palette-field">
						<label class="palette-label">API Key</label>
						<Input
							type="password"
							placeholder={keyPlaceholder(keyFlow.provider)}
							bind:value={apiKeyInput}
							autofocus
						/>
						<p class="palette-hint">
							Your key is encrypted with your password and stored locally. It never leaves your
							device.
						</p>
					</div>
				{/if}

				<div class="palette-field">
					<label class="palette-label">
						{keyFlow.mode === 'unlock' ? 'Password' : 'Master Password'}
					</label>
					<Input
						type="password"
						placeholder={keyFlow.mode === 'unlock' ? 'Enter your password' : 'Choose a password'}
						bind:value={passwordInput}
						autofocus={keyFlow.mode === 'unlock'}
						onkeydown={(e) => {
							if (e.key === 'Enter' && keyFlow?.mode === 'unlock') handleUnlock();
						}}
					/>
				</div>

				{#if keyFlow.mode === 'setup'}
					<div class="palette-field">
						<label class="palette-label">Confirm Password</label>
						<Input
							type="password"
							placeholder="Confirm your password"
							bind:value={confirmPasswordInput}
							onkeydown={(e) => {
								if (e.key === 'Enter') handleSaveKey();
							}}
						/>
					</div>
				{/if}

				{#if keyError}
					<p class="palette-error">{keyError}</p>
				{/if}

				<div class="palette-actions">
					<Button
						variant="ghost"
						onclick={() => {
							keyFlow = null;
							keyError = null;
						}}
						disabled={isSubmitting}
					>
						Back
					</Button>
					<Button
						onclick={keyFlow.mode === 'unlock' ? handleUnlock : handleSaveKey}
						disabled={isSubmitting ||
							!passwordInput ||
							(keyFlow.mode === 'setup' && (!apiKeyInput || !confirmPasswordInput))}
					>
						{isSubmitting ? '...' : keyFlow.mode === 'unlock' ? 'Unlock' : 'Save & Use'}
					</Button>
				</div>
			</div>
		{:else}
			<div class="palette-content">
				<!-- Current model indicator -->
				<div class="palette-current-model">
					<span class="palette-current-label">Current:</span>
					<span class="palette-current-provider">{getActiveTabLabel()}</span>
					<span class="palette-current-separator">/</span>
					<span class="palette-current-name">{getActiveModelLabel()}</span>
				</div>

				<!-- Tabs -->
				<div class="palette-tabs">
					<button
						class="palette-tab"
						class:active={activeTab === 'ollama'}
						onclick={() => (activeTab = 'ollama')}
					>
						<img src={PROVIDER_LOGOS.ollama} alt="Ollama" class="palette-tab-icon" />
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
						<img src={PROVIDER_LOGOS.webllm} alt="WebLLM" class="palette-tab-icon" />
						WebLLM
					</button>
				</div>

				<!-- Tab content -->
				<div class="palette-scroll">
					{#if activeTab === 'ollama'}
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
											class:active={activeModel?.provider === 'ollama' &&
												activeModel.modelId === modelId}
											onclick={() => handleSelectModel({ provider: 'ollama', modelId })}
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
					{:else if activeTab === 'frontier'}
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
												class:active={activeModel?.provider === 'claude' &&
													activeModel.modelId === model.id}
												onclick={() => handleSelectProvider('claude', model.id)}
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
					{:else if activeTab === 'webllm'}
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
										<div
											class="palette-webllm-progress-fill"
											style="width: {webllmProgress * 100}%"
										></div>
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
									{@const isLoaded =
										activeModel?.provider === 'webllm' && activeModel.modelId === model.id}
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
									<button
										class="palette-forget-key"
										onclick={() => onDeleteWebLLMCache(activeModel!.modelId)}
									>
										Remove cached model ({activeModel.modelId})
									</button>
								{/if}
								<button class="palette-forget-key" onclick={onDeleteAllWebLLMCaches}>
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

	/* Current model indicator */
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

	/* Tabs */
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

	.palette-heading {
		font-size: 1.125rem;
		font-weight: 600;
		margin-bottom: 0.25rem;
	}

	.palette-scroll {
		overflow-y: auto;
		flex: 1;
		padding: 1rem 1.5rem 1.5rem;
	}

	.palette-tab-content {
		/* wrapper for tab content */
	}

	/* Ollama connect */
	.palette-ollama-connect {
		padding: 0.5rem 0;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	:global(.palette-connect-input) {
		height: 1.75rem;
		font-size: 0.75rem;
		flex: 1;
	}

	:global(.palette-connect-btn) {
		height: 1.75rem;
		font-size: 0.75rem;
		flex-shrink: 0;
	}

	.palette-connect-error {
		font-size: 0.75rem;
		color: hsl(var(--destructive));
		flex-shrink: 0;
	}

	/* Provider grid */
	.palette-providers-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 2rem 2rem;
	}

	.palette-provider-group {
		/* individual provider column */
	}

	.palette-provider-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.palette-provider-logo {
		height: 1rem;
		width: 1rem;
		object-fit: contain;
		flex-shrink: 0;
	}

	.palette-provider-name {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: hsl(var(--muted-foreground));
	}

	.palette-soon-badge {
		font-size: 10px;
		background: hsl(var(--muted));
		color: hsl(var(--muted-foreground));
		border-radius: 0.25rem;
		padding: 0.125rem 0.375rem;
		font-weight: 500;
	}

	.palette-provider-models {
		display: flex;
		flex-direction: column;
	}

	/* Model rows */
	.palette-model-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0 2rem;
		margin-top: 0.25rem;
	}

	.palette-model-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.25rem;
		text-align: left;
		font-size: 0.875rem;
		width: 100%;
		transition: background-color 0.15s;
		border-radius: 0.25rem;
		border: 0;
		border-bottom: 1px solid hsl(var(--border));
		background: transparent;
		color: hsl(var(--foreground));
		cursor: pointer;
	}

	.palette-model-row:hover:not(.disabled) {
		background: hsl(var(--muted) / 0.5);
	}

	.palette-model-row.active {
		font-weight: 500;
	}

	.palette-model-row.disabled {
		color: hsl(var(--muted-foreground) / 0.5);
		cursor: not-allowed;
	}

	.palette-model-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.palette-active-dot {
		height: 0.375rem;
		width: 0.375rem;
		border-radius: 50%;
		background: hsl(var(--primary));
	}

	.palette-badge {
		font-size: 0.75rem;
		color: hsl(var(--muted-foreground));
	}

	.palette-forget-key {
		font-size: 0.75rem;
		color: hsl(var(--muted-foreground));
		background: transparent;
		border: 0;
		padding: 0;
		margin-top: 0.25rem;
		text-align: left;
		cursor: pointer;
		transition: color 0.15s;
	}

	.palette-forget-key:hover {
		color: hsl(var(--destructive));
	}

	/* Key flow */
	.palette-key-flow {
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.palette-field {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.palette-label {
		font-size: 0.875rem;
		font-weight: 500;
	}

	.palette-hint {
		font-size: 0.75rem;
		color: hsl(var(--muted-foreground));
	}

	.palette-error {
		font-size: 0.875rem;
		color: hsl(var(--destructive));
	}

	.palette-actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}

	.palette-webllm-context {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 0;
	}

	.palette-webllm-context-label {
		font-size: 0.75rem;
		color: hsl(var(--muted-foreground));
		margin-right: 0.25rem;
	}

	.palette-webllm-context-btn {
		font-size: 0.75rem;
		padding: 0.2rem 0.5rem;
		border: 1px solid hsl(var(--border));
		border-radius: 0.25rem;
		background: transparent;
		color: hsl(var(--foreground));
		cursor: pointer;
		transition: all 0.15s;
	}

	.palette-webllm-context-btn:hover:not(:disabled) {
		background: hsl(var(--muted) / 0.5);
	}

	.palette-webllm-context-btn.active {
		background: hsl(var(--primary));
		color: hsl(var(--primary-foreground));
		border-color: hsl(var(--primary));
	}

	.palette-webllm-context-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.palette-webllm-context-hint {
		font-size: 0.65rem;
		color: hsl(var(--muted-foreground));
		margin-left: 0.25rem;
	}

	.palette-webllm-cache-actions {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-top: 0.75rem;
		padding-top: 0.5rem;
		border-top: 1px solid hsl(var(--border));
	}

	.palette-webllm-loading {
		padding: 0.5rem 0;
	}

	.palette-webllm-progress-bar {
		height: 4px;
		background: hsl(var(--muted));
		border-radius: 2px;
		overflow: hidden;
		margin-bottom: 0.25rem;
	}

	.palette-webllm-progress-fill {
		height: 100%;
		background: hsl(var(--primary));
		transition: width 0.2s ease;
	}

	.palette-webllm-search {
		padding: 0.5rem 0;
	}

	.palette-vram {
		font-size: 0.7rem;
		color: hsl(var(--muted-foreground));
	}

	@media (max-width: 900px) {
		.palette-providers-grid {
			grid-template-columns: 1fr;
		}

		.palette-model-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
