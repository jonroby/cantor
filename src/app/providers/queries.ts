import * as external from '@/external';
import * as state from '@/state';

export function initProviders() {
	external.providers.migrateVault();
	state.providers.providerState.vaultProviders = external.providers.storedProviders();
	return hydrateWebLLMModels();
}

async function hydrateWebLLMModels() {
	state.providers.providerState.webllmModels = await external.providers.getWebLLMModels();
}
