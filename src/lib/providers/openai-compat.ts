import type { Message } from '@/domain/tree';
import type { StreamChunk } from './stream';

/**
 * Streaming chat function for OpenAI-compatible APIs.
 * Works with: OpenAI, DeepSeek, Mistral, Groq, Moonshot, Qwen.
 */
export async function* streamOpenAICompatChat(
	baseUrl: string,
	model: string,
	messages: Message[],
	apiKey: string,
	signal: AbortSignal
): AsyncGenerator<StreamChunk> {
	const response = await fetch(baseUrl, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model,
			messages: messages.map((m) => ({ role: m.role, content: m.content })),
			stream: true,
			stream_options: { include_usage: true }
		}),
		signal
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Request failed: ${response.status} ${errorText}`);
	}

	const reader = response.body?.getReader();
	if (!reader) throw new Error('No response body');

	const decoder = new TextDecoder();
	let buffer = '';
	let promptTokens = 0;
	let responseTokens = 0;

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split('\n');
			buffer = lines.pop() ?? '';

			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed || !trimmed.startsWith('data: ')) continue;

				const data = trimmed.slice(6);
				if (data === '[DONE]') continue;

				let parsed: {
					choices?: { delta?: { content?: string } }[];
					usage?: { prompt_tokens?: number; completion_tokens?: number };
				};
				try {
					parsed = JSON.parse(data);
				} catch {
					continue;
				}

				const content = parsed.choices?.[0]?.delta?.content;
				if (content) {
					yield { type: 'delta', delta: content };
				}

				if (parsed.usage) {
					promptTokens = parsed.usage.prompt_tokens ?? promptTokens;
					responseTokens = parsed.usage.completion_tokens ?? responseTokens;
				}
			}
		}
	} finally {
		reader.releaseLock();
	}

	yield { type: 'done', promptTokens, responseTokens };
}
