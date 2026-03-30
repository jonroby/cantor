import { describe, expect, it, vi, beforeEach } from 'vitest';
import { streamOpenAICompatChat } from '../openai-compat';

describe('openai-compatible provider transport', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('parses SSE deltas and usage into stream chunks', async () => {
		const sse = [
			'data: {"choices":[{"delta":{"content":"Hel"}}]}\n',
			'data: {"choices":[{"delta":{"content":"lo"}}],"usage":{"prompt_tokens":7,"completion_tokens":11}}\n',
			'data: [DONE]\n'
		].join('');

		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response(
					new ReadableStream({
						start(controller) {
							controller.enqueue(new TextEncoder().encode(sse));
							controller.close();
						}
					})
				)
			)
		);

		const results = [];
		for await (const chunk of streamOpenAICompatChat(
			'https://api.example.com/chat/completions',
			'gpt-4o',
			[{ role: 'user', content: 'Hello' }],
			'test-key',
			new AbortController().signal
		)) {
			results.push(chunk);
		}

		expect(results).toEqual([
			{ type: 'delta', delta: 'Hel' },
			{ type: 'delta', delta: 'lo' },
			{ type: 'done', promptTokens: 7, responseTokens: 11 }
		]);
	});
});
