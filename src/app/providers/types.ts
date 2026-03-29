import type * as domain from '@/domain';
import type * as state from '@/state';

export type Provider = domain.models.Provider;
export type ActiveModel = domain.models.ActiveModel;
export type ContextSize = state.providers.WebLLMContextSize;

export interface ProviderModel {
	id: string;
	label: string;
	enabled: boolean;
	meta?: string;
	note?: string;
}

export interface ProviderConnection {
	status: 'disconnected' | 'connecting' | 'connected' | 'error';
	value: string;
	label: string;
}

export interface ProviderLoadState {
	status: 'idle' | 'loading' | 'ready' | 'error';
	progress: number;
	text: string;
	error: string | null;
}

export interface ProviderContext {
	value: ContextSize;
	options: ReadonlyArray<{ label: string; value: ContextSize }>;
}

export type CredentialState = 'ready' | 'locked' | 'missing' | 'not-required';

export interface ProviderEntry {
	id: Provider;
	name: string;
	kind: 'remote' | 'local' | 'embedded';
	models: ProviderModel[];
	credentialState?: CredentialState;
	connection?: ProviderConnection;
	context?: ProviderContext;
	loadState?: ProviderLoadState;
}

export interface State {
	activeModel: ActiveModel | null;
	contextLength: number | null;
	providers: ProviderEntry[];
}
