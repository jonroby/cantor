import * as external from '@/external';
import * as state from '@/state';

export function initProviders() {
	external.providers.vault.migrateVault();
	state.providers.providerState.vaultProviders = external.providers.vault.storedProviders();
	return hydrateWebLLMModels();
}

async function hydrateWebLLMModels() {
	state.providers.providerState.webllmModels = await external.providers.webllm.getWebLLMModels();
}
