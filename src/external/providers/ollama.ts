import type { Message } from '@/domain';
import { DEFAULT_OLLAMA_URL } from '@/lib';
import type { StreamChunk } from './stream';

export { DEFAULT_OLLAMA_URL };

export async function fetchAvailableModels(baseUrl: string): Promise<string[]> {
	const response = await fetch(`${baseUrl}/api/tags`);
	if (!response.ok) throw new Error(`Failed to fetch models: ${response.statusText}`);
	const data = (await response.json()) as { models?: { name: string }[] };
	return (data.models ?? [])
		.map((m) => m.name)
		.filter((name) => !/embed|rerank|vision|clip|whisper|minilm/i.test(name));
}

export async function fetchModelContextLength(model: string, baseUrl: string): Promise<number> {
	const response = await fetch(`${baseUrl}/api/show`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name: model })
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch model info: ${response.statusText}`);
	}

	const data = (await response.json()) as { model_info?: Record<string, unknown> };
	const modelInfo = data.model_info ?? {};

	for (const [key, value] of Object.entries(modelInfo)) {
		if (key.endsWith('.context_length') && typeof value === 'number') {
			return value;
		}
	}

	return 131072; // fallback: 128k
}

export async function* streamOllamaChat(
	model: string,
	messages: Message[],
	signal: AbortSignal,
	baseUrl: string
): AsyncGenerator<StreamChunk> {
	const response = await fetch(`${baseUrl}/api/chat`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			model,
			messages: messages.map((m) => ({ role: m.role, content: m.content })),
			stream: true
		}),
		signal
	});

	if (!response.ok) {
		throw new Error(`Ollama request failed: ${response.statusText}`);
	}

	const reader = response.body?.getReader();
	if (!reader) throw new Error('No response body');

	const decoder = new TextDecoder();
	let buffer = '';

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split('\n');
			buffer = lines.pop() ?? '';

			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed) continue;

				const chunk = JSON.parse(trimmed) as {
					done: boolean;
					message?: { content: string };
					prompt_eval_count?: number;
					eval_count?: number;
				};

				if (!chunk.done && chunk.message?.content) {
					yield { type: 'delta', delta: chunk.message.content };
				} else if (chunk.done) {
					yield {
						type: 'done',
						promptTokens: chunk.prompt_eval_count ?? 0,
						responseTokens: chunk.eval_count ?? 0
					};
				}
			}
		}
		const remaining = buffer.trim();
		if (remaining) {
			try {
				const chunk = JSON.parse(remaining) as {
					done: boolean;
					message?: { content: string };
					prompt_eval_count?: number;
					eval_count?: number;
				};
				if (!chunk.done && chunk.message?.content) {
					yield { type: 'delta', delta: chunk.message.content };
				} else if (chunk.done) {
					yield {
						type: 'done',
						promptTokens: chunk.prompt_eval_count ?? 0,
						responseTokens: chunk.eval_count ?? 0
					};
				}
			} catch {
				/* unparseable trailing data */
			}
		}
	} finally {
		reader.releaseLock();
	}
}
