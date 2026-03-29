<script lang="ts">
	import './palette.css';
	import { PROVIDER_MODELS } from '@/domain/models';
	import type { ActiveModel, Provider } from '@/domain/models';
	import type {
		WebLLMStatus,
		WebLLMModelEntry,
		WebLLMContextSize
	} from '@/external/providers/webllm';
	import { PROVIDER_LOGOS } from '@/domain/models/logos';
	import OllamaTab from './OllamaTab.svelte';
	import FrontierTab from './FrontierTab.svelte';
	import WebLLMTab from './WebLLMTab.svelte';
	import ApiKeyFlow from './ApiKeyFlow.svelte';
	import type { OllamaStatus } from '@/domain/models';

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

	let keyFlow: KeyFlow | null = $state(null);
	let pendingModel: ActiveModel | null = $state(null);

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
		keyFlow = null;
		pendingModel = null;
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
		} else {
			pendingModel = { provider: provider as Provider, modelId };
			keyFlow = { provider, mode: 'setup' };
		}
	}

	function getActiveTabLabel(): string {
		if (!activeModel) return 'None';
		if (activeModel.provider === 'ollama') return 'Ollama';
		if (activeModel.provider === 'webllm') return 'WebLLM';
		return 'Frontier';
	}

	function getActiveModelLabel(): string {
		if (!activeModel) return 'No model selected';
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
			<ApiKeyFlow
				flow={keyFlow}
				{onUnlockKeys}
				{onSaveKey}
				onSelectModel={handleSelectModel}
				{pendingModel}
				onBack={() => {
					keyFlow = null;
				}}
				onDone={handleClose}
			/>
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
						<OllamaTab
							{activeModel}
							{ollamaUrl}
							{ollamaStatus}
							{ollamaModels}
							{onConnectOllama}
							onSelectModel={handleSelectModel}
						/>
					{:else if activeTab === 'frontier'}
						<FrontierTab
							{activeModel}
							{apiKeys}
							{vaultProviders}
							onSelectProvider={handleSelectProvider}
							{onForgetKey}
						/>
					{:else if activeTab === 'webllm'}
						<WebLLMTab
							{activeModel}
							{webllmStatus}
							{webllmProgress}
							{webllmProgressText}
							{webllmModels}
							{webllmError}
							{webllmContextSize}
							{webllmContextOptions}
							{onWebLLMContextSizeChange}
							{onLoadWebLLMModel}
							{onDeleteWebLLMCache}
							{onDeleteAllWebLLMCaches}
						/>
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
