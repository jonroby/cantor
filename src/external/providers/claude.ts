import type * as domain from '@/domain';
import type { StreamChunk, ToolDefinition } from './stream';

export async function* streamClaudeChat(
	model: string,
	messages: domain.tree.Message[],
	apiKey: string,
	signal: AbortSignal,
	tools?: ToolDefinition[]
): AsyncGenerator<StreamChunk> {
	const body: Record<string, unknown> = {
		model,
		max_tokens: 8192,
		stream: true,
		messages: messages.map((message) => {
			// If content is already structured (array), pass through as-is (tool use messages)
			const raw = message as unknown as { role: string; content: unknown };
			if (Array.isArray(raw.content)) {
				return { role: raw.role, content: raw.content };
			}
			return {
				role: message.role,
				content: message.images?.length
					? [
							...message.images.map((img) => ({
								type: 'image' as const,
								source: { type: 'base64' as const, media_type: img.mimeType, data: img.base64 }
							})),
							{ type: 'text' as const, text: message.content }
						]
					: message.content
			};
		})
	};
	if (tools?.length) {
		body.tools = tools;
	}

	const response = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-api-key': apiKey,
			'anthropic-version': '2023-06-01',
			'anthropic-dangerous-direct-browser-access': 'true'
		},
		body: JSON.stringify(body),
		signal
	});

	if (!response.ok) {
		const errorText = await response.text();
		let message = `Request failed (${response.status})`;
		try {
			const parsed = JSON.parse(errorText);
			if (parsed?.error?.message) message = parsed.error.message;
		} catch {
			/* use default */
		}
		throw new Error(message);
	}

	const reader = response.body?.getReader();
	if (!reader) throw new Error('No response body');

	const decoder = new TextDecoder();
	let buffer = '';
	let promptTokens = 0;
	let responseTokens = 0;
	let stopReason: string | undefined;

	// Tool use accumulation
	let currentToolId: string | null = null;
	let currentToolName: string | null = null;
	let toolInputJson = '';

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

				let parsed: Record<string, unknown>;
				try {
					parsed = JSON.parse(data);
				} catch {
					continue;
				}

				if (parsed.type === 'message_start') {
					const message = parsed.message as { usage?: { input_tokens?: number } } | undefined;
					if (message?.usage) {
						promptTokens = message.usage.input_tokens ?? promptTokens;
					}
				}

				if (parsed.type === 'content_block_start') {
					const block = parsed.content_block as { type?: string; id?: string; name?: string } | undefined;
					if (block?.type === 'tool_use') {
						currentToolId = block.id ?? null;
						currentToolName = block.name ?? null;
						toolInputJson = '';
					}
				}

				if (parsed.type === 'content_block_delta') {
					const delta = parsed.delta as { type?: string; text?: string; partial_json?: string } | undefined;
					if (delta?.type === 'text_delta' && delta.text) {
						yield { type: 'delta', delta: delta.text };
					}
					if (delta?.type === 'input_json_delta' && delta.partial_json !== undefined) {
						toolInputJson += delta.partial_json;
					}
				}

				if (parsed.type === 'content_block_stop') {
					if (currentToolId && currentToolName) {
						let input: Record<string, unknown> = {};
						try {
							input = JSON.parse(toolInputJson);
						} catch { /* empty input */ }
						yield { type: 'tool_use', toolUse: { id: currentToolId, name: currentToolName, input } };
						currentToolId = null;
						currentToolName = null;
						toolInputJson = '';
					}
				}

				if (parsed.type === 'message_delta') {
					const delta = parsed.delta as { stop_reason?: string } | undefined;
					const usage = parsed.usage as { output_tokens?: number } | undefined;
					if (usage) {
						responseTokens = usage.output_tokens ?? responseTokens;
					}
					if (delta?.stop_reason) {
						stopReason = delta.stop_reason;
					}
				}
			}
		}
	} finally {
		reader.releaseLock();
	}

	yield { type: 'done', promptTokens, responseTokens, stopReason };
}
