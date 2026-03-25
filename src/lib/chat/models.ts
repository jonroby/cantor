export type Provider = 'ollama' | 'claude' | 'openai' | 'gemini' | 'moonshot' | 'qwen' | 'deepseek' | 'mistral' | 'groq';

export interface ActiveModel {
	provider: Provider;
	modelId: string;
}

export type OllamaStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ProviderModelEntry {
	id: string;
	label: string;
	contextLength: number;
}

export interface ProviderConfig {
	name: string;
	baseUrl: string;
	keyPlaceholder: string;
}

/** Config for all key-based (non-Ollama) providers. */
export const PROVIDER_CONFIG: Record<Exclude<Provider, 'ollama'>, ProviderConfig> = {
	claude: {
		name: 'Claude',
		baseUrl: 'https://api.anthropic.com/v1/messages',
		keyPlaceholder: 'sk-ant-...'
	},
	openai: {
		name: 'OpenAI',
		baseUrl: 'https://api.openai.com/v1/chat/completions',
		keyPlaceholder: 'sk-...'
	},
	gemini: {
		name: 'Gemini',
		baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
		keyPlaceholder: 'AIza...'
	},
	moonshot: {
		name: 'Moonshot (Kimi)',
		baseUrl: 'https://api.moonshot.cn/v1/chat/completions',
		keyPlaceholder: 'sk-...'
	},
	qwen: {
		name: 'Qwen',
		baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
		keyPlaceholder: 'sk-...'
	},
	deepseek: {
		name: 'DeepSeek',
		baseUrl: 'https://api.deepseek.com/chat/completions',
		keyPlaceholder: 'sk-...'
	},
	mistral: {
		name: 'Mistral',
		baseUrl: 'https://api.mistral.ai/v1/chat/completions',
		keyPlaceholder: 'sk-...'
	},
	groq: {
		name: 'Llama (Groq)',
		baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
		keyPlaceholder: 'gsk_...'
	}
};

/** Model lists per provider. */
export const PROVIDER_MODELS: Record<Exclude<Provider, 'ollama'>, ProviderModelEntry[]> = {
	claude: [
		{ id: 'claude-opus-4-6', label: 'Claude Opus 4.6', contextLength: 1_000_000 },
		{ id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', contextLength: 1_000_000 },
		{ id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', contextLength: 200_000 }
	],
	openai: [
		{ id: 'gpt-4o', label: 'GPT-4o', contextLength: 128_000 },
		{ id: 'gpt-4o-mini', label: 'GPT-4o mini', contextLength: 128_000 },
		{ id: 'gpt-4-turbo', label: 'GPT-4 Turbo', contextLength: 128_000 },
		{ id: 'o1', label: 'o1', contextLength: 200_000 },
		{ id: 'o1-mini', label: 'o1 mini', contextLength: 128_000 },
		{ id: 'o3-mini', label: 'o3 mini', contextLength: 200_000 }
	],
	gemini: [
		{ id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', contextLength: 1_000_000 },
		{ id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite', contextLength: 1_000_000 },
		{ id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', contextLength: 2_000_000 },
		{ id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', contextLength: 1_000_000 }
	],
	moonshot: [
		{ id: 'kimi-k2', label: 'Kimi K2', contextLength: 131_072 },
		{ id: 'kimi-k2-thinking', label: 'Kimi K2 Thinking', contextLength: 131_072 },
		{ id: 'moonshot-v1-8k', label: 'Moonshot v1 8k', contextLength: 8_192 },
		{ id: 'moonshot-v1-32k', label: 'Moonshot v1 32k', contextLength: 32_768 }
	],
	qwen: [
		{ id: 'qwen-max', label: 'Qwen Max', contextLength: 32_768 },
		{ id: 'qwen-plus', label: 'Qwen Plus', contextLength: 131_072 },
		{ id: 'qwen-turbo', label: 'Qwen Turbo', contextLength: 1_000_000 },
		{ id: 'qwen2.5-72b-instruct', label: 'Qwen2.5 72B Instruct', contextLength: 131_072 }
	],
	deepseek: [
		{ id: 'deepseek-chat', label: 'DeepSeek Chat', contextLength: 64_000 },
		{ id: 'deepseek-reasoner', label: 'DeepSeek Reasoner', contextLength: 64_000 },
		{ id: 'deepseek-v3', label: 'DeepSeek V3', contextLength: 64_000 }
	],
	mistral: [
		{ id: 'mistral-large-latest', label: 'Mistral Large', contextLength: 128_000 },
		{ id: 'mistral-small-latest', label: 'Mistral Small', contextLength: 128_000 },
		{ id: 'codestral-latest', label: 'Codestral', contextLength: 256_000 },
		{ id: 'mistral-nemo', label: 'Mistral Nemo', contextLength: 128_000 }
	],
	groq: [
		{ id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', contextLength: 128_000 },
		{ id: 'llama-3.1-70b-versatile', label: 'Llama 3.1 70B', contextLength: 131_072 },
		{ id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B', contextLength: 131_072 },
		{ id: 'llama-3-70b-8192', label: 'Llama 3 70B', contextLength: 8_192 }
	]
};

/** Backward-compat alias */
export const CLAUDE_MODELS = PROVIDER_MODELS.claude;

export type ClaudeModel = ProviderModelEntry;

/** All key-based provider names in display order. */
export const KEY_BASED_PROVIDERS: Exclude<Provider, 'ollama'>[] = [
	'claude', 'openai', 'gemini', 'moonshot', 'qwen', 'deepseek', 'mistral', 'groq'
];

export function isKeyBasedProvider(provider: Provider): provider is Exclude<Provider, 'ollama'> {
	return provider !== 'ollama';
}

/** Look up context length for a key-based provider model. */
export function getModelContextLength(provider: Provider, modelId: string): number | null {
	if (!isKeyBasedProvider(provider)) return null;
	return PROVIDER_MODELS[provider].find((m) => m.id === modelId)?.contextLength ?? null;
}

/** Reverse-lookup: find which provider owns a given modelId. Returns null for unknown models. */
export function getProviderForModelId(modelId: string): Provider | null {
	for (const provider of KEY_BASED_PROVIDERS) {
		if (PROVIDER_MODELS[provider].some((m) => m.id === modelId)) {
			return provider;
		}
	}
	return null;
}
