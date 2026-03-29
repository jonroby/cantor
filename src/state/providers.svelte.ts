import * as domain from '@/domain';
import * as lib from '@/lib';

export const WEBLLM_CONTEXT_OPTIONS = lib.WEBLLM_CONTEXT_OPTIONS;
export type WebLLMStatus = lib.WebLLMStatus;
export type WebLLMModelEntry = lib.WebLLMModelEntry;
export type WebLLMContextSize = lib.WebLLMContextSize;
export type ActiveModel = domain.ActiveModel;
export type OllamaStatus = domain.OllamaStatus;

export const providerState = $state({
	activeModel: null as ActiveModel | null,
	contextLength: null as number | null,
	ollamaUrl: lib.DEFAULT_OLLAMA_URL,
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
	if (providerState.activeModel && domain.isKeyBasedProvider(providerState.activeModel.provider)) {
		providerState.contextLength = domain.getModelContextLength(
			providerState.activeModel.provider,
			providerState.activeModel.modelId
		);
	} else {
		providerState.contextLength = null;
	}
}
