import * as domain from '@/domain';
import * as lib from '@/lib';

export type WebLLMStatus = import('@/lib').providerTypes.WebLLMStatus;
export type WebLLMModelEntry = import('@/lib').providerTypes.WebLLMModelEntry;
export type WebLLMContextSize = import('@/lib').providerDefaults.WebLLMContextSize;
export type ActiveModel = domain.models.ActiveModel;
export type OllamaStatus = domain.models.OllamaStatus;

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
