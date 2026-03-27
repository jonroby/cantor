import {
	getModelContextLength,
	isKeyBasedProvider,
	type ActiveModel,
	type OllamaStatus
} from '@/domain/models';
import { DEFAULT_OLLAMA_URL } from '@/state/services/providers/ollama';
import {
	WEBLLM_CONTEXT_OPTIONS,
	type WebLLMStatus,
	type WebLLMModelEntry,
	type WebLLMContextSize
} from '@/state/services/providers/webllm';

export { WEBLLM_CONTEXT_OPTIONS };
export type { WebLLMStatus, WebLLMModelEntry, WebLLMContextSize, ActiveModel, OllamaStatus };

export const providerState = $state({
	activeModel: null as ActiveModel | null,
	contextLength: null as number | null,
	ollamaUrl: DEFAULT_OLLAMA_URL,
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
	if (providerState.activeModel && isKeyBasedProvider(providerState.activeModel.provider)) {
		providerState.contextLength = getModelContextLength(
			providerState.activeModel.provider,
			providerState.activeModel.modelId
		);
	}
}
