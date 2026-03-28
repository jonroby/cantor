import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/state/services/providers/ollama', () => ({
	DEFAULT_OLLAMA_URL: 'http://localhost:11434',
	fetchAvailableModels: vi.fn(),
	fetchModelContextLength: vi.fn()
}));

vi.mock('@/state/services/providers/webllm', () => ({
	getWebLLMModels: vi.fn(() => [{ id: 'web-model', label: 'web-model', vramMB: 1024 }]),
	loadWebLLMModel: vi.fn(),
	deleteModelCache: vi.fn(),
	deleteAllModelCaches: vi.fn()
}));

vi.mock('@/state/services/providers/vault', () => ({
	clearProviderKey: vi.fn(),
	loadAllApiKeys: vi.fn(),
	migrateVault: vi.fn(),
	saveApiKey: vi.fn(),
	storedProviders: vi.fn(() => ['claude'])
}));

import { providerState } from '@/state/providers.svelte';
import {
	connectOllama,
	fetchOllamaContextLength,
	init,
	loadWebLLMModel_ as loadWebLLMModel
} from './providers';
import { fetchAvailableModels, fetchModelContextLength } from '@/state/services/providers/ollama';
import { loadWebLLMModel as loadWebLLMModelService } from '@/state/services/providers/webllm';
import { migrateVault, storedProviders } from '@/state/services/providers/vault';

describe('app/providers', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		providerState.activeModel = null;
		providerState.contextLength = null;
		providerState.ollamaUrl = 'http://localhost:11434';
		providerState.ollamaStatus = 'disconnected';
		providerState.ollamaModels = [];
		providerState.apiKeys = {};
		providerState.vaultProviders = [];
		providerState.operationError = null;
		providerState.webllmStatus = 'idle';
		providerState.webllmProgress = 0;
		providerState.webllmProgressText = '';
		providerState.webllmModels = [];
		providerState.webllmError = null;
		providerState.webllmContextSize = 4_096;
	});

	it('init hydrates vault providers and webllm models', () => {
		init();

		expect(migrateVault).toHaveBeenCalledOnce();
		expect(storedProviders).toHaveBeenCalledOnce();
		expect(providerState.vaultProviders).toEqual(['claude']);
		expect(providerState.webllmModels).toEqual([
			{ id: 'web-model', label: 'web-model', vramMB: 1024 }
		]);
	});

	it('connectOllama keeps active model when it still exists', async () => {
		vi.mocked(fetchAvailableModels).mockResolvedValue(['llama3', 'mistral']);
		providerState.activeModel = { provider: 'ollama', modelId: 'mistral' };

		await connectOllama('http://ollama.local');

		expect(providerState.activeModel).toEqual({ provider: 'ollama', modelId: 'mistral' });
		expect(providerState.ollamaModels).toEqual(['llama3', 'mistral']);
		expect(providerState.ollamaStatus).toBe('connected');
	});

	it('connectOllama replaces a stale active model with the first returned model', async () => {
		vi.mocked(fetchAvailableModels).mockResolvedValue(['llama3', 'mistral']);
		providerState.activeModel = { provider: 'ollama', modelId: 'stale-model' };

		await connectOllama('http://ollama.local');

		expect(providerState.activeModel).toEqual({ provider: 'ollama', modelId: 'llama3' });
	});

	it('connectOllama clears the active model when the server returns no models', async () => {
		vi.mocked(fetchAvailableModels).mockResolvedValue([]);
		providerState.activeModel = { provider: 'ollama', modelId: 'stale-model' };

		await connectOllama('http://ollama.local');

		expect(providerState.activeModel).toBeNull();
		expect(providerState.ollamaModels).toEqual([]);
	});

	it('fetchOllamaContextLength updates context only if the active model is unchanged', async () => {
		vi.mocked(fetchModelContextLength).mockResolvedValue(65_536);
		providerState.activeModel = { provider: 'ollama', modelId: 'llama3' };
		providerState.ollamaUrl = 'http://ollama.local';

		await fetchOllamaContextLength();

		expect(fetchModelContextLength).toHaveBeenCalledWith('llama3', 'http://ollama.local');
		expect(providerState.contextLength).toBe(65_536);
	});

	it('loadWebLLMModel_ forwards the selected context size and marks the model active', async () => {
		providerState.webllmContextSize = 8_192;

		await loadWebLLMModel('Llama-3');

		expect(loadWebLLMModelService).toHaveBeenCalledWith('Llama-3', 8_192, expect.any(Function));
		expect(providerState.activeModel).toEqual({ provider: 'webllm', modelId: 'Llama-3' });
		expect(providerState.contextLength).toBe(8_192);
		expect(providerState.webllmStatus).toBe('ready');
	});
});
