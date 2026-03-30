export type WebLLMStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface WebLLMModelEntry {
	id: string;
	label: string;
	vramMB: number | null;
}
