import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./ollama', () => ({
	streamOllamaChat: vi.fn(() => 'ollama-stream')
}));

vi.mock('./webllm', () => ({
	streamWebLLMChat: vi.fn(() => 'webllm-stream')
}));

vi.mock('./claude', () => ({
	streamClaudeChat: vi.fn(() => 'claude-stream')
}));

vi.mock('./gemini', () => ({
	streamGeminiChat: vi.fn(() => 'gemini-stream')
}));

vi.mock('./openai-compat', () => ({
	streamOpenAICompatChat: vi.fn(() => 'openai-stream')
}));

vi.mock('@/state', async () => {
	const { createStateMock } = await import('@/tests/mocks/state');
	return createStateMock({
		providers: {
			providerState: {
				apiKeys: {
					claude: 'claude-key',
					gemini: 'gemini-key',
					openai: 'openai-key'
				},
				ollamaUrl: 'http://localhost:11434'
			}
		}
	});
});

import type * as domain from '@/domain';
import { getProviderStream } from './stream';
import { streamOllamaChat } from './ollama';
import { streamWebLLMChat } from './webllm';
import { streamClaudeChat } from './claude';
import { streamGeminiChat } from './gemini';
import { streamOpenAICompatChat } from './openai-compat';

const HISTORY: domain.tree.Message[] = [{ role: 'user', content: 'Hello' }];

describe('provider stream dispatch', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('dispatches ollama models to the ollama transport', () => {
		const signal = new AbortController().signal;
		expect(getProviderStream({ provider: 'ollama', modelId: 'llama3' }, HISTORY, signal)).toBe(
			'ollama-stream'
		);
		expect(streamOllamaChat).toHaveBeenCalledWith(
			'llama3',
			HISTORY,
			signal,
			'http://localhost:11434'
		);
	});

	it('dispatches webllm models to the webllm transport', () => {
		const signal = new AbortController().signal;
		expect(getProviderStream({ provider: 'webllm', modelId: 'Llama-3' }, HISTORY, signal)).toBe(
			'webllm-stream'
		);
		expect(streamWebLLMChat).toHaveBeenCalledWith(HISTORY, signal);
	});

	it('dispatches claude models with the decrypted api key', () => {
		const signal = new AbortController().signal;
		getProviderStream({ provider: 'claude', modelId: 'claude-sonnet-4-6' }, HISTORY, signal);
		expect(streamClaudeChat).toHaveBeenCalledWith(
			'claude-sonnet-4-6',
			HISTORY,
			'claude-key',
			signal
		);
	});

	it('dispatches gemini models with the decrypted api key', () => {
		const signal = new AbortController().signal;
		getProviderStream({ provider: 'gemini', modelId: 'gemini-2.0-flash' }, HISTORY, signal);
		expect(streamGeminiChat).toHaveBeenCalledWith(
			'gemini-2.0-flash',
			HISTORY,
			'gemini-key',
			signal
		);
	});

	it('dispatches openai-compatible providers with the configured base url', () => {
		const signal = new AbortController().signal;
		expect(getProviderStream({ provider: 'openai', modelId: 'gpt-4o' }, HISTORY, signal)).toBe(
			'openai-stream'
		);
		expect(streamOpenAICompatChat).toHaveBeenCalledWith(
			'https://api.openai.com/v1/chat/completions',
			'gpt-4o',
			HISTORY,
			'openai-key',
			signal
		);
	});
});
