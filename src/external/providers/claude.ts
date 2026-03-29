import type * as domain from '@/domain';
import type { StreamChunk } from './stream';

export async function* streamClaudeChat(
	model: string,
	messages: domain.Message[],
	apiKey: string,
	signal: AbortSignal
): AsyncGenerator<StreamChunk> {
	const response = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-api-key': apiKey,
			'anthropic-version': '2023-06-01',
			'anthropic-dangerous-direct-browser-access': 'true'
		},
		body: JSON.stringify({
			model,
			max_tokens: 8192,
			stream: true,
			messages: messages.map((message) => ({
				role: message.role,
				content: message.content
			}))
		}),
		signal
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Claude request failed: ${response.status} ${errorText}`);
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

				let parsed: {
					type?: string;
					delta?: { type?: string; text?: string; usage?: { output_tokens?: number } };
					message?: { usage?: { input_tokens?: number; output_tokens?: number } };
					usage?: { output_tokens?: number };
				};
				try {
					parsed = JSON.parse(data);
				} catch {
					continue;
				}

				if (parsed.type === 'message_start' && parsed.message?.usage) {
					promptTokens = parsed.message.usage.input_tokens ?? 0;
				}

				if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
					yield { type: 'delta', delta: parsed.delta.text };
				}

				if (parsed.type === 'message_delta' && parsed.usage) {
					responseTokens = parsed.usage.output_tokens ?? 0;
				}
			}
		}

		const remaining = buffer.trim();
		if (remaining && remaining.startsWith('data: ')) {
			try {
				const parsed = JSON.parse(remaining.slice(6)) as {
					type?: string;
					delta?: { text?: string };
					usage?: { output_tokens?: number };
				};
				if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
					yield { type: 'delta', delta: parsed.delta.text };
				}
				if (parsed.type === 'message_delta' && parsed.usage) {
					responseTokens = parsed.usage.output_tokens ?? 0;
				}
			} catch {
				/* unparseable trailing data */
			}
		}
	} finally {
		reader.releaseLock();
	}

	yield { type: 'done', promptTokens, responseTokens };
}
