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

export type StreamChunk =
	| { type: 'delta'; delta: string }
	| { type: 'done'; promptTokens: number; responseTokens: number };

export function getProviderStream(
	model: domain.models.ActiveModel,
	history: domain.tree.Message[],
	signal: AbortSignal,
	runtime: ProviderStreamRuntime = {}
) {
	if (model.provider === 'webllm') return streamWebLLMChat(history, signal);
	if (model.provider === 'ollama')
		return streamOllamaChat(model.modelId, history, signal, runtime.ollamaUrl ?? '');
	if (model.provider === 'claude')
		return streamClaudeChat(model.modelId, history, runtime.apiKey ?? '', signal);
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
