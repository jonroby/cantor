import type * as domain from '@/domain';
import type { StreamChunk } from './stream';

/**
 * Streaming chat function for Google Gemini API.
 */
export async function* streamGeminiChat(
	model: string,
	messages: domain.tree.Message[],
	apiKey: string,
	signal: AbortSignal
): AsyncGenerator<StreamChunk> {
	// CLEANUP: API key is passed as a URL query parameter per Google's API design. This means it
	// appears in browser history, DevTools network tab, and request logs. Google requires this —
	// moving it to a header won't work. Consider adding a note in docs about this tradeoff.
	const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

	const contents = messages.map((m) => ({
		role: m.role === 'assistant' ? 'model' : 'user',
		parts: [{ text: m.content }]
	}));

	const response = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ contents }),
		signal
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Gemini request failed: ${response.status} ${errorText}`);
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
					candidates?: { content?: { parts?: { text?: string }[] } }[];
					usageMetadata?: {
						promptTokenCount?: number;
						candidatesTokenCount?: number;
					};
				};
				try {
					parsed = JSON.parse(data);
				} catch {
					continue;
				}

				const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
				if (text) {
					yield { type: 'delta', delta: text };
				}

				if (parsed.usageMetadata) {
					promptTokens = parsed.usageMetadata.promptTokenCount ?? promptTokens;
					responseTokens = parsed.usageMetadata.candidatesTokenCount ?? responseTokens;
				}
			}
		}
		const remaining = buffer.trim();
		if (remaining && remaining.startsWith('data: ')) {
			try {
				const parsed = JSON.parse(remaining.slice(6)) as {
					candidates?: { content?: { parts?: { text?: string }[] } }[];
					usageMetadata?: {
						promptTokenCount?: number;
						candidatesTokenCount?: number;
					};
				};
				const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
				if (text) yield { type: 'delta', delta: text };
				if (parsed.usageMetadata) {
					promptTokens = parsed.usageMetadata.promptTokenCount ?? promptTokens;
					responseTokens = parsed.usageMetadata.candidatesTokenCount ?? responseTokens;
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
