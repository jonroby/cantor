import { PROVIDER_CONFIG, type ActiveModel, type Provider } from '@/domain';
import type { Message } from '@/domain';
import { streamOllamaChat } from './ollama';
import { streamWebLLMChat } from './webllm';
import { streamClaudeChat } from './claude';
import { streamGeminiChat } from './gemini';
import { streamOpenAICompatChat } from './openai-compat';
import { providerState } from '@/state';

export type StreamChunk =
	| { type: 'delta'; delta: string }
	| { type: 'done'; promptTokens: number; responseTokens: number };

export function getProviderStream(model: ActiveModel, history: Message[], signal: AbortSignal) {
	const key = providerState.apiKeys[model.provider] ?? '';
	if (model.provider === 'webllm') return streamWebLLMChat(history, signal);
	if (model.provider === 'ollama')
		return streamOllamaChat(model.modelId, history, signal, providerState.ollamaUrl);
	if (model.provider === 'claude') return streamClaudeChat(model.modelId, history, key, signal);
	if (model.provider === 'gemini') return streamGeminiChat(model.modelId, history, key, signal);
	const config = PROVIDER_CONFIG[model.provider as Exclude<Provider, 'ollama' | 'webllm'>];
	return streamOpenAICompatChat(config.baseUrl, model.modelId, history, key, signal);
}
