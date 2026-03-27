import { describe, expect, it, beforeEach, vi } from 'vitest';

// Mock web-llm to prevent CJS/ESM issues in test environment
vi.mock('@mlc-ai/web-llm', () => ({
	CreateWebWorkerMLCEngine: vi.fn(),
	prebuiltAppConfig: { model_list: [] },
	deleteModelAllInfoInCache: vi.fn(),
	hasModelInCache: vi.fn()
}));

import { providerState, selectModel, updateContextLength } from './providers.svelte';
import { getModelContextLength } from '@/domain/models';

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

	describe('providerState', () => {
		it('has correct defaults', () => {
			expect(providerState.activeModel).toBe(null);
			expect(providerState.contextLength).toBe(null);
			expect(providerState.ollamaUrl).toBe('http://localhost:11434');
			expect(providerState.ollamaStatus).toBe('disconnected');
			expect(providerState.ollamaModels).toEqual([]);
			expect(providerState.apiKeys).toEqual({});
			expect(providerState.vaultProviders).toEqual([]);
			expect(providerState.operationError).toBe(null);
			expect(providerState.webllmStatus).toBe('idle');
			expect(providerState.webllmProgress).toBe(0);
			expect(providerState.webllmProgressText).toBe('');
			expect(providerState.webllmModels).toEqual([]);
			expect(providerState.webllmError).toBe(null);
			expect(providerState.webllmContextSize).toBe(4_096);
		});
	});

	describe('selectModel', () => {
		it('sets activeModel on providerState', () => {
			const model = { provider: 'claude' as const, modelId: 'claude-sonnet-4-6' };
			selectModel(model);
			expect(providerState.activeModel).toEqual(model);
		});

		it('replaces existing model', () => {
			selectModel({ provider: 'claude' as const, modelId: 'claude-sonnet-4-6' });
			selectModel({ provider: 'ollama' as const, modelId: 'llama3' });
			expect(providerState.activeModel).toEqual({ provider: 'ollama', modelId: 'llama3' });
		});
	});

	describe('updateContextLength', () => {
		it('sets contextLength for key-based provider', () => {
			selectModel({ provider: 'claude' as const, modelId: 'claude-sonnet-4-6' });
			updateContextLength();
			const expected = getModelContextLength('claude', 'claude-sonnet-4-6');
			expect(providerState.contextLength).toBe(expected);
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
