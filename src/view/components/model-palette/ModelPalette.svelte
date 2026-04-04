<script lang="ts">
	import './palette.css';
	import * as app from '@/app';
	import { toast } from 'svelte-sonner';
	import CredentialFlow from './CredentialFlow.svelte';
	import FrontierTab from './FrontierTab.svelte';
	import OllamaTab from './OllamaTab.svelte';
	import WebLLMTab from './WebLLMTab.svelte';

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

	type CredentialFlowState = {
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

	let credentialFlow: CredentialFlowState | null = $state(null);
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
		if (providerState.vaultState === 'locked' && provider.credentialState !== 'not-required') {
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
			<CredentialFlow
				mode={credentialFlow.mode}
				providerName={credentialFlow.provider.name}
				vaultState={providerState.vaultState}
				bind:credentialInput
				bind:passwordInput
				bind:confirmPasswordInput
				{credentialError}
				{isSubmitting}
				onSubmit={submitCredentialFlow}
				onBack={() => (credentialFlow = null)}
				onForgetKey={() => {
					if (credentialFlow) {
						onRemoveCredential(credentialFlow.provider.id);
						credentialFlow = null;
					}
				}}
			/>
		{:else}
			<div class="palette-body">
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
						class="palette-tab"
						class:active={activeTab === 'webllm'}
						onclick={() => (activeTab = 'webllm')}
					>
						WebLLM
					</button>
				</div>

				<div class="palette-content">
					{#if activeTab === 'frontier'}
						<FrontierTab
							vaultState={providerState.vaultState}
							{activeModel}
							enabledProviders={enabledRemoteProviders}
							{comingSoonProviders}
							onLockVault={async () => {
								await onLockVault();
								toast.success('Vault locked');
							}}
							onUnlockVault={() => {
								const dummyProvider = enabledRemoteProviders[0];
								if (dummyProvider) beginAuth(dummyProvider);
							}}
							onBeginAuth={beginAuth}
							onRemoveCredential={(id) => {
								const provider = enabledRemoteProviders.find((p) => p.id === id);
								onRemoveCredential(id);
								if (provider) toast.success(`Removed ${provider.name} key`);
							}}
							onSelectModel={beginModelSelection}
						/>
					{:else if activeTab === 'ollama'}
						{#if ollamaProvider}
							<OllamaTab
								provider={ollamaProvider}
								{activeModel}
								{onConnect}
								onSelectModel={beginModelSelection}
							/>
						{/if}
					{:else if webllmProvider}
						<WebLLMTab provider={webllmProvider} />
					{/if}
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.palette-panel {
		display: flex;
		flex-direction: column;
		max-height: 85vh;
		width: min(900px, calc(100vw - 2rem));
		overflow: hidden;
		padding: 0;
	}

	.palette-body {
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.palette-tabs {
		display: flex;
		gap: 0;
		border-bottom: 1px solid hsl(var(--border));
		padding: 0 1.5rem;
	}

	.palette-content {
		flex: 1;
		overflow-y: auto;
		padding: 1rem 1.5rem 1.5rem;
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
</style>
