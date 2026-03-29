import { describe, expect, it, beforeEach, vi } from 'vitest';

// Mock web-llm to prevent CJS/ESM issues in test environment
vi.mock('@mlc-ai/web-llm', () => ({
	CreateWebWorkerMLCEngine: vi.fn(),
	prebuiltAppConfig: { model_list: [] },
	deleteModelAllInfoInCache: vi.fn(),
	hasModelInCache: vi.fn()
}));

import { providerState, selectModel } from './providers.svelte';

describe('providers state', () => {
	beforeEach(() => {
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

	describe('selectModel', () => {
		it('updates only the selected model until context is recomputed', () => {
			const model = { provider: 'claude' as const, modelId: 'claude-sonnet-4-6' };
			providerState.contextLength = 999;
			selectModel(model);

			expect(providerState.activeModel).toEqual(model);
			expect(providerState.contextLength).toBe(999);
		});

		it('replaces an existing model selection', () => {
			selectModel({ provider: 'claude' as const, modelId: 'claude-sonnet-4-6' });
			selectModel({ provider: 'ollama' as const, modelId: 'llama3' });
			expect(providerState.activeModel).toEqual({ provider: 'ollama', modelId: 'llama3' });
		});
	});
});
