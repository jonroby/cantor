import { getWebLLMModels } from '@/external';
import { migrateVault, storedProviders as getStoredProviders } from '@/external';
import { providerState } from '@/state';

export function initProviders() {
	migrateVault();
	providerState.vaultProviders = getStoredProviders();
	providerState.webllmModels = getWebLLMModels();
}
