import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/external', async () => {
	const { createExternalMock } = await import('@/tests/mocks');
	return createExternalMock({
		providers: {
			webllm: {
				getWebLLMModels: vi.fn(() => [{ id: 'web-model', label: 'web-model', vramMB: 1024 }])
			},
			vault: {
				storedProviders: vi.fn(() => ['claude'])
			}
		}
	});
});

import * as state from '@/state';
import * as external from '@/external';
import {
	connectOllama,
	fetchOllamaContextLength,
	init,
	loadWebLLMModel_ as loadWebLLMModel
} from './providers';

describe('app/providers', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		state.providers.providerState.activeModel = null;
		state.providers.providerState.contextLength = null;
		state.providers.providerState.ollamaUrl = 'http://localhost:11434';
		state.providers.providerState.ollamaStatus = 'disconnected';
		state.providers.providerState.ollamaModels = [];
		state.providers.providerState.apiKeys = {};
		state.providers.providerState.vaultProviders = [];
		state.providers.providerState.operationError = null;
		state.providers.providerState.webllmStatus = 'idle';
		state.providers.providerState.webllmProgress = 0;
		state.providers.providerState.webllmProgressText = '';
		state.providers.providerState.webllmModels = [];
		state.providers.providerState.webllmError = null;
		state.providers.providerState.webllmContextSize = 4_096;
	});

	it('init hydrates vault providers and webllm models', async () => {
		await init();

		expect(external.providers.vault.migrateVault).toHaveBeenCalledOnce();
		expect(external.providers.vault.storedProviders).toHaveBeenCalledOnce();
		expect(state.providers.providerState.vaultProviders).toEqual(['claude']);
		expect(state.providers.providerState.webllmModels).toEqual([
			{ id: 'web-model', label: 'web-model', vramMB: 1024 }
		]);
	});

	it('connectOllama keeps active model when it still exists', async () => {
		vi.mocked(external.providers.ollama.fetchAvailableModels).mockResolvedValue([
			'llama3',
			'mistral'
		]);
		state.providers.providerState.activeModel = { provider: 'ollama', modelId: 'mistral' };

		await connectOllama('http://ollama.local');

		expect(state.providers.providerState.activeModel).toEqual({
			provider: 'ollama',
			modelId: 'mistral'
		});
		expect(state.providers.providerState.ollamaModels).toEqual(['llama3', 'mistral']);
		expect(state.providers.providerState.ollamaStatus).toBe('connected');
	});

	it('connectOllama replaces a stale active model with the first returned model', async () => {
		vi.mocked(external.providers.ollama.fetchAvailableModels).mockResolvedValue([
			'llama3',
			'mistral'
		]);
		state.providers.providerState.activeModel = { provider: 'ollama', modelId: 'stale-model' };

		await connectOllama('http://ollama.local');

		expect(state.providers.providerState.activeModel).toEqual({
			provider: 'ollama',
			modelId: 'llama3'
		});
	});

	it('connectOllama clears the active model when the server returns no models', async () => {
		vi.mocked(external.providers.ollama.fetchAvailableModels).mockResolvedValue([]);
		state.providers.providerState.activeModel = { provider: 'ollama', modelId: 'stale-model' };

		await connectOllama('http://ollama.local');

		expect(state.providers.providerState.activeModel).toBeNull();
		expect(state.providers.providerState.ollamaModels).toEqual([]);
	});

	it('fetchOllamaContextLength updates context only if the active model is unchanged', async () => {
		vi.mocked(external.providers.ollama.fetchModelContextLength).mockResolvedValue(65_536);
		state.providers.providerState.activeModel = { provider: 'ollama', modelId: 'llama3' };
		state.providers.providerState.ollamaUrl = 'http://ollama.local';

		await fetchOllamaContextLength();

		expect(external.providers.ollama.fetchModelContextLength).toHaveBeenCalledWith(
			'llama3',
			'http://ollama.local'
		);
		expect(state.providers.providerState.contextLength).toBe(65_536);
	});

	it('loadWebLLMModel_ forwards the selected context size and marks the model active', async () => {
		state.providers.providerState.webllmContextSize = 8_192;

		await loadWebLLMModel('Llama-3');

		expect(external.providers.webllm.loadWebLLMModel).toHaveBeenCalledWith(
			'Llama-3',
			8_192,
			expect.any(Function)
		);
		expect(state.providers.providerState.activeModel).toEqual({
			provider: 'webllm',
			modelId: 'Llama-3'
		});
		expect(state.providers.providerState.contextLength).toBe(8_192);
		expect(state.providers.providerState.webllmStatus).toBe('ready');
	});
});
