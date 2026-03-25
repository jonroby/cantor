<script lang="ts">
	import { PROVIDER_MODELS, PROVIDER_CONFIG, KEY_BASED_PROVIDERS } from '$lib/chat/models';
	import type { ActiveModel, OllamaStatus, Provider } from '$lib/chat/models';
	import Button from '$lib/components/ui/button.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import claudeLogo from '../../assets/claude.svg';
	import deepseekLogo from '../../assets/deepseek.svg';
	import geminiLogo from '../../assets/gemini-color.svg';
	import gptOssLogo from '../../assets/gpt-oss.svg';
	import metaLogo from '../../assets/meta.svg';
	import mistralLogo from '../../assets/mistral-color.svg';
	import moonshotLogo from '../../assets/moonshot.svg';
	import ollamaLogo from '../../assets/ollama.svg';
	import qwenLogo from '../../assets/qwen.svg';

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
	}

	type KeyFlow = { provider: string; mode: 'unlock' | 'setup' };

	const PROVIDER_LOGOS: Record<string, string> = {
		claude: claudeLogo,
		openai: gptOssLogo,
		gemini: geminiLogo,
		moonshot: moonshotLogo,
		qwen: qwenLogo,
		deepseek: deepseekLogo,
		mistral: mistralLogo,
		groq: metaLogo
	};

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
		onForgetKey
	}: Props = $props();

	let urlInput = $state(ollamaUrl);
	let keyFlow: KeyFlow | null = $state(null);
	let pendingModel: ActiveModel | null = $state(null);
	let apiKeyInput = $state('');
	let passwordInput = $state('');
	let confirmPasswordInput = $state('');
	let keyError: string | null = $state(null);
	let isSubmitting = $state(false);

	$effect(() => {
		urlInput = ollamaUrl;
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
			// There's a vault — need to unlock
			pendingModel = { provider: provider as Provider, modelId };
			keyFlow = { provider, mode: 'unlock' };
			passwordInput = '';
			keyError = null;
		} else {
			// No vault — need to set up key
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
		return PROVIDER_CONFIG[provider as Exclude<Provider, 'ollama'>]?.name ?? provider;
	}

	function keyPlaceholder(provider: string): string {
		return PROVIDER_CONFIG[provider as Exclude<Provider, 'ollama'>]?.keyPlaceholder ?? 'sk-...';
	}

	function getBadge(provider: string): string | undefined {
		if (apiKeys[provider]) return undefined;
		if (vaultProviders.length > 0) return 'locked';
		return 'add key';
	}
</script>

{#if open}
	<button
		class="modal-scrim"
		type="button"
		aria-label="Close model palette"
		onclick={handleClose}
	></button>
	<div class="modal-panel palette-panel">
		{#if keyFlow}
			<div class="palette-key-flow">
				<div>
					<h2 class="palette-heading">
						{keyFlow.mode === 'unlock' ? 'Unlock API Keys' : `Add ${providerDisplayName(keyFlow.provider)} API Key`}
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
							Your key is encrypted with your password and stored locally. It never leaves your device.
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
						onkeydown={(e) => { if (e.key === 'Enter' && keyFlow?.mode === 'unlock') handleUnlock(); }}
					/>
				</div>

				{#if keyFlow.mode === 'setup'}
					<div class="palette-field">
						<label class="palette-label">Confirm Password</label>
						<Input
							type="password"
							placeholder="Confirm your password"
							bind:value={confirmPasswordInput}
							onkeydown={(e) => { if (e.key === 'Enter') handleSaveKey(); }}
						/>
					</div>
				{/if}

				{#if keyError}
					<p class="palette-error">{keyError}</p>
				{/if}

				<div class="palette-actions">
					<Button variant="ghost" onclick={() => { keyFlow = null; keyError = null; }} disabled={isSubmitting}>
						Back
					</Button>
					<Button
						onclick={keyFlow.mode === 'unlock' ? handleUnlock : handleSaveKey}
						disabled={isSubmitting || !passwordInput || (keyFlow.mode === 'setup' && (!apiKeyInput || !confirmPasswordInput))}
					>
						{isSubmitting ? '...' : keyFlow.mode === 'unlock' ? 'Unlock' : 'Save & Use'}
					</Button>
				</div>
			</div>
		{:else}
			<div class="palette-content">
				<div class="palette-header">
					<h2 class="palette-heading">Select a model</h2>
					<p class="palette-subheading">Choose from Claude, local models, or other providers</p>
				</div>

				<div class="palette-scroll">
					<!-- Ollama — full-width special row -->
					<div class="palette-ollama-section">
						<div class="palette-provider-title">
							<img src={ollamaLogo} alt="Ollama" class="palette-provider-logo" />
							<span class="palette-provider-name">Local (Ollama)</span>
						</div>
						<div class="palette-ollama-connect">
							<Input
								bind:value={urlInput}
								class="palette-connect-input"
								placeholder="localhost:11434"
								onkeydown={(e) => { if (e.key === 'Enter') onConnectOllama(urlInput); }}
							/>
							<Button
								size="sm"
								variant={isOllamaConnected ? 'secondary' : 'default'}
								class="palette-connect-btn"
								onclick={() => onConnectOllama(urlInput)}
								disabled={ollamaStatus === 'connecting'}
							>
								{ollamaStatus === 'connecting' ? 'Connecting...' : isOllamaConnected ? 'Reconnect' : 'Connect'}
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

					<div class="palette-providers-grid">
						{#each KEY_BASED_PROVIDERS as provider (provider)}
							{@const models = PROVIDER_MODELS[provider]}
							{@const logo = PROVIDER_LOGOS[provider]}
							{@const name = providerDisplayName(provider)}
							{@const badge = getBadge(provider)}
							<div class="palette-provider-group">
								<div class="palette-provider-title">
									{#if logo}
										<img src={logo} alt={name} class="palette-provider-logo" />
									{/if}
									<span class="palette-provider-name">{name}</span>
								</div>
								<div class="palette-provider-models">
									{#each models as model (model.id)}
										<button
											class="palette-model-row"
											class:active={activeModel?.provider === provider && activeModel.modelId === model.id}
											onclick={() => handleSelectProvider(provider, model.id)}
										>
											<span>{model.label}</span>
											<div class="palette-model-meta">
												{#if activeModel?.provider === provider && activeModel.modelId === model.id}
													<span class="palette-active-dot"></span>
												{/if}
												{#if badge}
													<span class="palette-badge">{badge}</span>
												{/if}
											</div>
										</button>
									{/each}
									{#if apiKeys[provider]}
										<button
											class="palette-forget-key"
											onclick={() => onForgetKey(provider)}
										>
											Forget saved key
										</button>
									{/if}
								</div>
							</div>
						{/each}
					</div>
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

	.palette-header {
		padding: 1.5rem 1.5rem 1rem;
		border-bottom: 1px solid hsl(var(--border));
	}

	.palette-heading {
		font-size: 1.125rem;
		font-weight: 600;
		margin-bottom: 0.25rem;
	}

	.palette-subheading {
		font-size: 0.875rem;
		color: hsl(var(--muted-foreground));
	}

	.palette-scroll {
		overflow-y: auto;
		flex: 1;
		padding: 1.5rem;
	}

	/* Ollama section */
	.palette-ollama-section {
		margin-bottom: 2rem;
		padding-bottom: 2rem;
		border-bottom: 1px solid hsl(var(--border));
	}

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

	@media (max-width: 900px) {
		.palette-providers-grid {
			grid-template-columns: 1fr;
		}

		.palette-model-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
