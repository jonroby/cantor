import { describe, expect, it, beforeEach, vi } from 'vitest';

// Mock web-llm to prevent CJS/ESM issues in test environment
vi.mock('@mlc-ai/web-llm', () => ({
	CreateWebWorkerMLCEngine: vi.fn(),
	prebuiltAppConfig: { model_list: [] },
	deleteModelAllInfoInCache: vi.fn(),
	hasModelInCache: vi.fn()
}));

import { providerState, selectModel, updateContextLength } from './providers';

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

	describe('updateContextLength', () => {
		it('sets the documented context length for a known Claude model', () => {
			selectModel({ provider: 'claude' as const, modelId: 'claude-sonnet-4-6' });
			updateContextLength();
			expect(providerState.contextLength).toBe(1_000_000);
		});

		it('recomputes when switching between different key-based providers', () => {
			selectModel({ provider: 'claude' as const, modelId: 'claude-haiku-4-5' });
			updateContextLength();
			expect(providerState.contextLength).toBe(200_000);

			selectModel({ provider: 'openai' as const, modelId: 'gpt-4o' });
			updateContextLength();
			expect(providerState.contextLength).toBe(128_000);
		});

		it('clears contextLength when activeModel is null', () => {
			providerState.contextLength = 999;
			updateContextLength();
			expect(providerState.contextLength).toBe(null);
		});

		it('clears stale contextLength for non-key-based provider (ollama)', () => {
			selectModel({ provider: 'ollama' as const, modelId: 'llama3' });
			providerState.contextLength = 999;
			updateContextLength();
			expect(providerState.contextLength).toBe(null);
		});

		it('clears stale contextLength for non-key-based provider (webllm)', () => {
			selectModel({ provider: 'webllm' as const, modelId: 'some-model' });
			providerState.contextLength = 999;
			updateContextLength();
			expect(providerState.contextLength).toBe(null);
		});

		it('sets null for unknown model on key-based provider', () => {
			selectModel({ provider: 'claude' as const, modelId: 'nonexistent-model' });
			updateContextLength();
			expect(providerState.contextLength).toBe(null);
		});
	});
});
