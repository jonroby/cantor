import type * as domain from '@/domain';

export interface ProviderConfig {
	name: string;
	baseUrl: string;
	keyPlaceholder: string;
}

interface KeyBasedProviderDefinition {
	config: ProviderConfig;
	models: domain.models.ProviderModelEntry[];
}

const KEY_BASED_PROVIDER_DEFINITIONS: Record<
	domain.models.KeyBasedProvider,
	KeyBasedProviderDefinition
> = {
	claude: {
		config: {
			name: 'Claude',
			baseUrl: 'https://api.anthropic.com/v1/messages',
			keyPlaceholder: 'sk-ant-...'
		},
		models: [
			{ id: 'claude-opus-4-6', label: 'Claude Opus 4.6', contextLength: 1_000_000 },
			{ id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', contextLength: 1_000_000 },
			{ id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', contextLength: 200_000 }
		]
	},
	openai: {
		config: {
			name: 'OpenAI',
			baseUrl: 'https://api.openai.com/v1/chat/completions',
			keyPlaceholder: 'sk-...'
		},
		models: [
			{ id: 'gpt-5.4', label: 'GPT-5.4', contextLength: 1_000_000 },
			{ id: 'gpt-5.4-mini', label: 'GPT-5.4 mini', contextLength: 400_000 },
			{ id: 'gpt-5.4-nano', label: 'GPT-5.4 nano', contextLength: 400_000 },
			{ id: 'o3', label: 'o3', contextLength: 200_000 },
			{ id: 'o4-mini', label: 'o4 mini', contextLength: 200_000 },
			{ id: 'gpt-4o', label: 'GPT-4o', contextLength: 128_000 }
		]
	},
	gemini: {
		config: {
			name: 'Gemini',
			baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
			keyPlaceholder: 'AIza...'
		},
		models: [
			{ id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', contextLength: 1_000_000 },
			{ id: 'gemini-3-pro-preview', label: 'Gemini 3 Pro', contextLength: 1_000_000 },
			{ id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', contextLength: 1_000_000 },
			{
				id: 'gemini-3.1-flash-lite-preview',
				label: 'Gemini 3.1 Flash-Lite',
				contextLength: 1_000_000
			},
			{ id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', contextLength: 1_000_000 },
			{ id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', contextLength: 1_000_000 }
		]
	},
	moonshot: {
		config: {
			name: 'Moonshot (Kimi)',
			baseUrl: 'https://api.moonshot.cn/v1/chat/completions',
			keyPlaceholder: 'sk-...'
		},
		models: [
			{ id: 'kimi-k2', label: 'Kimi K2', contextLength: 131_072 },
			{ id: 'kimi-k2-thinking', label: 'Kimi K2 Thinking', contextLength: 131_072 },
			{ id: 'moonshot-v1-8k', label: 'Moonshot v1 8k', contextLength: 8_192 },
			{ id: 'moonshot-v1-32k', label: 'Moonshot v1 32k', contextLength: 32_768 }
		]
	},
	qwen: {
		config: {
			name: 'Qwen',
			baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
			keyPlaceholder: 'sk-...'
		},
		models: [
			{ id: 'qwen-max', label: 'Qwen Max', contextLength: 32_768 },
			{ id: 'qwen-plus', label: 'Qwen Plus', contextLength: 131_072 },
			{ id: 'qwen-turbo', label: 'Qwen Turbo', contextLength: 1_000_000 },
			{ id: 'qwen2.5-72b-instruct', label: 'Qwen2.5 72B Instruct', contextLength: 131_072 }
		]
	},
	deepseek: {
		config: {
			name: 'DeepSeek',
			baseUrl: 'https://api.deepseek.com/chat/completions',
			keyPlaceholder: 'sk-...'
		},
		models: [
			{ id: 'deepseek-chat', label: 'DeepSeek Chat (V3.2)', contextLength: 128_000 },
			{ id: 'deepseek-reasoner', label: 'DeepSeek Reasoner (V3.2)', contextLength: 128_000 }
		]
	},
	mistral: {
		config: {
			name: 'Mistral',
			baseUrl: 'https://api.mistral.ai/v1/chat/completions',
			keyPlaceholder: 'sk-...'
		},
		models: [
			{ id: 'mistral-large-latest', label: 'Mistral Large', contextLength: 128_000 },
			{ id: 'mistral-small-latest', label: 'Mistral Small', contextLength: 128_000 },
			{ id: 'codestral-latest', label: 'Codestral', contextLength: 256_000 },
			{ id: 'mistral-nemo', label: 'Mistral Nemo', contextLength: 128_000 }
		]
	},
	groq: {
		config: {
			name: 'Llama (Groq)',
			baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
			keyPlaceholder: 'gsk_...'
		},
		models: [
			{ id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', contextLength: 128_000 },
			{ id: 'llama-3.1-70b-versatile', label: 'Llama 3.1 70B', contextLength: 131_072 },
			{ id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B', contextLength: 131_072 },
			{ id: 'llama-3-70b-8192', label: 'Llama 3 70B', contextLength: 8_192 }
		]
	}
};

const KEY_BASED_PROVIDERS: domain.models.KeyBasedProvider[] = [
	'claude',
	'openai',
	'gemini',
	'moonshot',
	'qwen',
	'deepseek',
	'mistral',
	'groq'
];

const providerEntries = <T>(
	project: (definition: KeyBasedProviderDefinition) => T
): Record<domain.models.KeyBasedProvider, T> =>
	Object.fromEntries(
		KEY_BASED_PROVIDERS.map((provider) => [
			provider,
			project(KEY_BASED_PROVIDER_DEFINITIONS[provider])
		])
	) as Record<domain.models.KeyBasedProvider, T>;

export const PROVIDER_CONFIG = providerEntries((definition) => definition.config);
export const PROVIDER_MODELS = providerEntries((definition) => definition.models);

const MODEL_PROVIDER_BY_ID = Object.fromEntries(
	KEY_BASED_PROVIDERS.flatMap((provider) =>
		PROVIDER_MODELS[provider].map((model) => [model.id, provider] as const)
	)
) as Record<string, domain.models.KeyBasedProvider>;

const MODEL_CONTEXT_LENGTH_BY_PROVIDER = providerEntries((definition) =>
	Object.fromEntries(definition.models.map((model) => [model.id, model.contextLength]))
) as Record<domain.models.KeyBasedProvider, Record<string, number>>;

export const CLAUDE_MODELS = PROVIDER_MODELS.claude;

export function getModelContextLength(
	provider: domain.models.Provider,
	modelId: string
): number | null {
	if (!KEY_BASED_PROVIDERS.includes(provider as domain.models.KeyBasedProvider)) {
		return null;
	}

	return (
		MODEL_CONTEXT_LENGTH_BY_PROVIDER[provider as domain.models.KeyBasedProvider][modelId] ?? null
	);
}

export function getProviderForModelId(modelId: string): domain.models.KeyBasedProvider | null {
	return MODEL_PROVIDER_BY_ID[modelId] ?? null;
}
