import { getWebLLMModels } from '@/external/providers/webllm';
import { migrateVault, storedProviders as getStoredProviders } from '@/external/providers/vault';
import { providerState } from '@/state';

export function initProviders() {
	migrateVault();
	providerState.vaultProviders = getStoredProviders();
	providerState.webllmModels = getWebLLMModels();
}
