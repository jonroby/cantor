export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

export const WEBLLM_CONTEXT_OPTIONS = [
	{ label: '4K', value: 4_096 },
	{ label: '8K', value: 8_192 },
	{ label: '16K', value: 16_384 }
] as const;

export type WebLLMContextSize = (typeof WEBLLM_CONTEXT_OPTIONS)[number]['value'];
