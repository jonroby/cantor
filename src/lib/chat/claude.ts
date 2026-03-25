import type { Message } from './tree';
import type { StreamChunk } from './stream';

interface ClaudeTextBlock {
	type: 'text';
	text: string;
}

interface ClaudeResponse {
	content?: ClaudeTextBlock[];
	usage?: {
		input_tokens?: number;
		output_tokens?: number;
	};
}

// CLEANUP: This function is non-streaming despite its name. It should send `stream: true` and
// parse SSE events (content_block_delta), same pattern as streamGeminiChat/streamOpenAICompatChat.
export async function* streamClaudeChat(
	model: string,
	messages: Message[],
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

	const data = (await response.json()) as ClaudeResponse;
	const text = (data.content ?? [])
		.filter((block): block is ClaudeTextBlock => block.type === 'text')
		.map((block) => block.text)
		.join('');

	if (text) {
		yield { type: 'delta', delta: text };
	}

	yield {
		type: 'done',
		promptTokens: data.usage?.input_tokens ?? 0,
		responseTokens: data.usage?.output_tokens ?? 0
	};
}
