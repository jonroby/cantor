import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fetchAvailableModels, fetchModelContextLength, streamOllamaChat } from '../ollama';

function makeResponse(body: string, init: ResponseInit = {}) {
	return new Response(body, { status: 200, ...init });
}

describe('ollama provider transport', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('filters non-chat model tags from the model list', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				makeResponse(
					JSON.stringify({
						models: [{ name: 'llama3' }, { name: 'nomic-embed-text' }, { name: 'vision-model' }]
					})
				)
			)
		);

		await expect(fetchAvailableModels('http://ollama.local')).resolves.toEqual(['llama3']);
	});

	it('reads the reported context length from model_info', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				makeResponse(
					JSON.stringify({
						model_info: {
							'general.architecture': 'llama',
							'llama.context_length': 32_768
						}
					})
				)
			)
		);

		await expect(fetchModelContextLength('llama3', 'http://ollama.local')).resolves.toBe(32_768);
	});

	it('parses streamed JSON lines into deltas and a done event', async () => {
		const chunks = [
			JSON.stringify({ done: false, message: { content: 'Hel' } }) + '\n',
			JSON.stringify({
				done: false,
				message: { content: 'lo' }
			}) +
				'\n' +
				JSON.stringify({
					done: true,
					prompt_eval_count: 12,
					eval_count: 34
				}) +
				'\n'
		];

		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response(
					new ReadableStream({
						start(controller) {
							for (const chunk of chunks) {
								controller.enqueue(new TextEncoder().encode(chunk));
							}
							controller.close();
						}
					})
				)
			)
		);

		const results = [];
		for await (const chunk of streamOllamaChat(
			'llama3',
			[{ role: 'user', content: 'Hello' }],
			new AbortController().signal,
			'http://ollama.local'
		)) {
			results.push(chunk);
		}

		expect(results).toEqual([
			{ type: 'delta', delta: 'Hel' },
			{ type: 'delta', delta: 'lo' },
			{ type: 'done', promptTokens: 12, responseTokens: 34 }
		]);
	});
});
