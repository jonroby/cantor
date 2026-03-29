import { beforeEach, describe, expect, it, vi } from 'vitest';

const { terminate, createEngine } = vi.hoisted(() => ({
	terminate: vi.fn(),
	createEngine: vi.fn()
}));

vi.mock('@mlc-ai/web-llm', () => ({
	CreateWebWorkerMLCEngine: createEngine,
	prebuiltAppConfig: {
		model_list: [{ model_id: 'Llama-3', vram_required_MB: 1024, overrides: {} }]
	},
	deleteModelAllInfoInCache: vi.fn(),
	hasModelInCache: vi.fn()
}));

import { loadWebLLMModel, unloadWebLLM } from '../webllm';

describe('webllm provider transport', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		terminate.mockReset();
		createEngine.mockResolvedValue({
			chat: { completions: { create: vi.fn() } },
			interruptGenerate: vi.fn()
		});
		class MockWorker {
			terminate = terminate;
		}
		vi.stubGlobal('Worker', MockWorker);
		unloadWebLLM();
		terminate.mockClear();
	});

	it('reuses the engine only when model and context size are unchanged', async () => {
		await loadWebLLMModel('Llama-3', 4_096);
		await loadWebLLMModel('Llama-3', 4_096);

		expect(createEngine).toHaveBeenCalledTimes(1);
		expect(terminate).not.toHaveBeenCalled();
	});

	it('reloads the same model when the requested context size changes', async () => {
		await loadWebLLMModel('Llama-3', 4_096);
		await loadWebLLMModel('Llama-3', 8_192);

		expect(createEngine).toHaveBeenCalledTimes(2);
		expect(terminate).toHaveBeenCalledTimes(1);
	});
});
