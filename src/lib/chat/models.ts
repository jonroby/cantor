export type Provider = 'ollama' | 'claude';

export interface ActiveModel {
	provider: Provider;
	modelId: string;
}

export type OllamaStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ClaudeModel {
	id: string;
	label: string;
	contextLength: number;
}

export const CLAUDE_MODELS: ClaudeModel[] = [
	{ id: 'claude-opus-4-6', label: 'Claude Opus 4.6', contextLength: 1_000_000 },
	{ id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', contextLength: 1_000_000 },
	{ id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', contextLength: 200_000 }
];
