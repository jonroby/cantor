import * as domain from '@/domain';
import * as lib from '@/lib';

export const WEBLLM_CONTEXT_OPTIONS = lib.providerDefaults.WEBLLM_CONTEXT_OPTIONS;
export type WebLLMStatus = lib.providerTypes.WebLLMStatus;
export type WebLLMModelEntry = lib.providerTypes.WebLLMModelEntry;
export type WebLLMContextSize = lib.providerDefaults.WebLLMContextSize;
export type ActiveModel = domain.models.ActiveModel;
export type OllamaStatus = domain.models.OllamaStatus;

const KEY_BASED_PROVIDER_CONTEXT_LENGTHS: Record<
	domain.models.KeyBasedProvider,
	Record<string, number>
> = {
	claude: {
		'claude-opus-4-6': 1_000_000,
		'claude-sonnet-4-6': 1_000_000,
		'claude-haiku-4-5': 200_000
	},
	openai: {
		'gpt-4o': 128_000,
		'gpt-4o-mini': 128_000,
		'gpt-4-turbo': 128_000,
		o1: 200_000,
		'o1-mini': 128_000,
		'o3-mini': 200_000
	},
	gemini: {
		'gemini-2.0-flash': 1_000_000,
		'gemini-2.0-flash-lite': 1_000_000,
		'gemini-1.5-pro': 2_000_000,
		'gemini-1.5-flash': 1_000_000
	},
	moonshot: {
		'kimi-k2': 131_072,
		'kimi-k2-thinking': 131_072,
		'moonshot-v1-8k': 8_192,
		'moonshot-v1-32k': 32_768
	},
	qwen: {
		'qwen-max': 32_768,
		'qwen-plus': 131_072,
		'qwen-turbo': 1_000_000,
		'qwen2.5-72b-instruct': 131_072
	},
	deepseek: {
		'deepseek-chat': 64_000,
		'deepseek-reasoner': 64_000,
		'deepseek-v3': 64_000
	},
	mistral: {
		'mistral-large-latest': 128_000,
		'mistral-small-latest': 128_000,
		'codestral-latest': 256_000,
		'mistral-nemo': 128_000
	},
	groq: {
		'llama-3.3-70b-versatile': 128_000,
		'llama-3.1-70b-versatile': 131_072,
		'llama-3.1-8b-instant': 131_072,
		'llama-3-70b-8192': 8_192
	}
};

export const providerState = $state({
	activeModel: null as ActiveModel | null,
	contextLength: null as number | null,
	ollamaUrl: lib.providerDefaults.DEFAULT_OLLAMA_URL,
	ollamaStatus: 'disconnected' as OllamaStatus,
	ollamaModels: [] as string[],
	apiKeys: {} as Record<string, string>,
	vaultProviders: [] as string[],
	operationError: null as string | null,
	webllmStatus: 'idle' as WebLLMStatus,
	webllmProgress: 0,
	webllmProgressText: '',
	webllmModels: [] as WebLLMModelEntry[],
	webllmError: null as string | null,
	webllmContextSize: 4_096 as WebLLMContextSize
});

export function selectModel(model: ActiveModel) {
	providerState.activeModel = model;
}

export function updateContextLength() {
	const model = providerState.activeModel;
	if (!model || !domain.models.isKeyBasedProvider(model.provider)) {
		providerState.contextLength = null;
		return;
	}

	providerState.contextLength =
		KEY_BASED_PROVIDER_CONTEXT_LENGTHS[model.provider][model.modelId] ?? null;
}
