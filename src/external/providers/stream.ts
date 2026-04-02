import * as domain from '@/domain';
import * as catalog from './catalog';
import { streamOllamaChat } from './ollama';
import { streamWebLLMChat } from './webllm';
import { streamClaudeChat } from './claude';
import { streamGeminiChat } from './gemini';
import { streamOpenAICompatChat } from './openai-compat';

export interface ProviderStreamRuntime {
	apiKey?: string;
	ollamaUrl?: string;
}

export interface ToolDefinition {
	name: string;
	description: string;
	input_schema: Record<string, unknown>;
}

export interface ToolUseBlock {
	id: string;
	name: string;
	input: Record<string, unknown>;
}

export type StreamChunk =
	| { type: 'delta'; delta: string }
	| { type: 'tool_use'; toolUse: ToolUseBlock }
	| { type: 'done'; promptTokens: number; responseTokens: number; stopReason?: string };

export function getProviderStream(
	model: domain.models.ActiveModel,
	history: domain.tree.Message[],
	signal: AbortSignal,
	runtime: ProviderStreamRuntime = {},
	tools?: ToolDefinition[]
) {
	if (model.provider === 'webllm') return streamWebLLMChat(history, signal);
	if (model.provider === 'ollama')
		return streamOllamaChat(model.modelId, history, signal, runtime.ollamaUrl ?? '');
	if (model.provider === 'claude')
		return streamClaudeChat(model.modelId, history, runtime.apiKey ?? '', signal, tools);
	if (model.provider === 'gemini')
		return streamGeminiChat(model.modelId, history, runtime.apiKey ?? '', signal);
	const config =
		catalog.PROVIDER_CONFIG[model.provider as Exclude<domain.models.Provider, 'ollama' | 'webllm'>];
	return streamOpenAICompatChat(
		config.baseUrl,
		model.modelId,
		history,
		runtime.apiKey ?? '',
		signal
	);
}
