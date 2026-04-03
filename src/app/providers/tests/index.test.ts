import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/external', async () => {
	const { createExternalMock } = await import('@/tests/mocks/external');
	return createExternalMock({
		providers: {
			webllm: {
				getWebLLMModels: vi.fn(async () => [{ id: 'web-model', label: 'web-model', vramMB: 1024 }])
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
	clearCachedModels,
	connect,
	getState,
	initialize,
	removeCachedModel,
	saveCredential,
	setContextSize,
	streamText,
	unlockCredentials
} from '../index';

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

	it('initialize hydrates provider state for the generic picker', async () => {
		await initialize();

		expect(external.providers.vault.storedProviders).toHaveBeenCalledOnce();
		expect(state.providers.providerState.vaultProviders).toEqual(['claude']);
		expect(state.providers.providerState.webllmModels).toEqual([
			{ id: 'web-model', label: 'web-model', vramMB: 1024 }
		]);
	});

	it('connect delegates provider-specific connection behind a generic action', async () => {
		vi.mocked(external.providers.ollama.fetchAvailableModels).mockResolvedValue([
			'llama3',
			'mistral'
		]);
		state.providers.providerState.activeModel = { provider: 'ollama', modelId: 'mistral' };

		await connect('ollama', 'http://ollama.local');

		expect(state.providers.providerState.activeModel).toEqual({
			provider: 'ollama',
			modelId: 'mistral'
		});
		expect(state.providers.providerState.ollamaModels).toEqual(['llama3', 'mistral']);
		expect(state.providers.providerState.ollamaStatus).toBe('connected');
	});

	it('getState returns a frontend-shaped provider list instead of raw config exports', () => {
		state.providers.providerState.activeModel = {
			provider: 'claude',
			modelId: 'claude-sonnet-4-6'
		};
		state.providers.providerState.apiKeys = { claude: 'sk-ant-xxx' };
		state.providers.providerState.vaultProviders = ['claude'];
		state.providers.providerState.ollamaStatus = 'connected';
		state.providers.providerState.ollamaModels = ['llama3'];
		state.providers.providerState.webllmModels = [
			{ id: 'web-model', label: 'web-model', vramMB: 1024 }
		];

		expect(getState()).toEqual(
			expect.objectContaining({
				activeModel: { provider: 'claude', modelId: 'claude-sonnet-4-6' },
				providers: expect.arrayContaining([
					expect.objectContaining({
						id: 'claude',
						name: 'Claude',
						models: expect.arrayContaining([
							expect.objectContaining({ id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' })
						])
					}),
					expect.objectContaining({
						id: 'ollama',
						connection: expect.objectContaining({ status: 'connected' })
					}),
					expect.objectContaining({
						id: 'webllm',
						context: expect.objectContaining({
							value: 4_096,
							options: expect.arrayContaining([expect.objectContaining({ label: '4K' })])
						})
					})
				])
			})
		);
	});

	it('unlockCredentials loads saved keys through a generic credential action', async () => {
		await unlockCredentials('password123');

		expect(external.providers.vault.loadAllApiKeys).toHaveBeenCalledWith('password123');
		expect(state.providers.providerState.apiKeys).toEqual({});
	});

	it('saveCredential stores a provider key through a generic credential action', async () => {
		await saveCredential('claude', 'sk-ant-xxx', 'password123');

		expect(external.providers.vault.saveApiKey).toHaveBeenCalledWith(
			'claude',
			'sk-ant-xxx',
			'password123'
		);
		expect(state.providers.providerState.apiKeys).toEqual({ claude: 'sk-ant-xxx' });
	});

	it('setContextSize updates the generic context setting', () => {
		setContextSize(8_192);
		expect(state.providers.providerState.webllmContextSize).toBe(8_192);
	});

	it('removeCachedModel deletes a local cached model behind a generic action', async () => {
		state.providers.providerState.activeModel = { provider: 'webllm', modelId: 'Llama-3' };

		await removeCachedModel('webllm', 'Llama-3');

		expect(external.providers.webllm.deleteModelCache).toHaveBeenCalledWith('Llama-3');
		expect(state.providers.providerState.activeModel).toBeNull();
	});

	it('clearCachedModels clears provider caches behind a generic action', async () => {
		state.providers.providerState.activeModel = { provider: 'webllm', modelId: 'Llama-3' };

		await clearCachedModels('webllm');

		expect(external.providers.webllm.deleteAllModelCaches).toHaveBeenCalledOnce();
		expect(state.providers.providerState.activeModel).toBeNull();
	});

	it('streamText hides provider transport selection behind app.providers', () => {
		state.providers.providerState.apiKeys = { claude: 'sk-ant-xxx' };
		streamText(
			{ provider: 'claude', modelId: 'claude-sonnet-4-6' },
			[{ role: 'user', content: 'Hello' }],
			new AbortController().signal
		);

		expect(external.providers.stream.getProviderStream).toHaveBeenCalledWith(
			{ provider: 'claude', modelId: 'claude-sonnet-4-6' },
			[{ role: 'user', content: 'Hello' }],
			expect.any(AbortSignal),
			{ apiKey: 'sk-ant-xxx', ollamaUrl: 'http://localhost:11434' }
		);
	});
});
