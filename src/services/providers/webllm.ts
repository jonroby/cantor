import {
	CreateWebWorkerMLCEngine,
	prebuiltAppConfig,
	deleteModelAllInfoInCache,
	hasModelInCache,
	type WebWorkerMLCEngine,
	type InitProgressReport
} from '@mlc-ai/web-llm';
import type { Message } from '@/domain/tree';
import type { StreamChunk } from './stream';

export type WebLLMStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface WebLLMModelEntry {
	id: string;
	label: string;
	vramMB: number | null;
}

export const WEBLLM_CONTEXT_OPTIONS = [
	{ label: '4K', value: 4_096 },
	{ label: '8K', value: 8_192 },
	{ label: '16K', value: 16_384 }
] as const;

export type WebLLMContextSize = (typeof WEBLLM_CONTEXT_OPTIONS)[number]['value'];

/** Return the list of available WebLLM models from the built-in registry. */
export function getWebLLMModels(): WebLLMModelEntry[] {
	return prebuiltAppConfig.model_list.map((m) => ({
		id: m.model_id,
		label: m.model_id,
		vramMB: m.vram_required_MB ?? null
	}));
}

/** Build an appConfig that overrides the context_window_size for the target model. */
function buildAppConfig(modelId: string, contextWindowSize: number) {
	return {
		...prebuiltAppConfig,
		model_list: prebuiltAppConfig.model_list.map((m) =>
			m.model_id === modelId
				? {
						...m,
						overrides: {
							...m.overrides,
							context_window_size: contextWindowSize
						}
					}
				: m
		)
	};
}

let engine: WebWorkerMLCEngine | null = null;
let engineWorker: Worker | null = null;
let currentModelId: string | null = null;

export function getWebLLMEngine(): WebWorkerMLCEngine | null {
	return engine;
}

export function isWebLLMReady(): boolean {
	return engine !== null && currentModelId !== null;
}

export function getLoadedModelId(): string | null {
	return currentModelId;
}

/**
 * Load a WebLLM model. Re-uses the engine if the same model is already loaded.
 * Calls progressCallback with progress updates during download/init.
 */
export async function loadWebLLMModel(
	modelId: string,
	contextWindowSize: WebLLMContextSize = 4_096,
	progressCallback?: (report: InitProgressReport) => void
): Promise<void> {
	if (engine && currentModelId === modelId) return;

	// Terminate previous engine if switching models
	if (engineWorker) {
		try {
			engineWorker.terminate();
		} catch {
			/* ignore */
		}
		engine = null;
		engineWorker = null;
		currentModelId = null;
	}

	const worker = new Worker(new URL('./webllm-worker.ts', import.meta.url), { type: 'module' });

	engine = await CreateWebWorkerMLCEngine(worker, modelId, {
		appConfig: buildAppConfig(modelId, contextWindowSize),
		initProgressCallback: progressCallback
	});
	engineWorker = worker;
	currentModelId = modelId;
}

/** Unload the current model and terminate the worker. */
export function unloadWebLLM(): void {
	if (engineWorker) {
		try {
			engineWorker.terminate();
		} catch {
			/* ignore */
		}
	}
	engine = null;
	engineWorker = null;
	currentModelId = null;
}

/** Check if a model is cached in the browser. */
export async function isModelCached(modelId: string): Promise<boolean> {
	return hasModelInCache(modelId);
}

/** Delete a single model's cached weights from the browser. */
export async function deleteModelCache(modelId: string): Promise<void> {
	// Unload first if this is the active model
	if (currentModelId === modelId) {
		unloadWebLLM();
	}
	await deleteModelAllInfoInCache(modelId);
}

/** Delete all cached WebLLM models from the browser. */
export async function deleteAllModelCaches(): Promise<void> {
	unloadWebLLM();
	for (const model of prebuiltAppConfig.model_list) {
		try {
			await deleteModelAllInfoInCache(model.model_id);
		} catch {
			/* ignore models not in cache */
		}
	}
}

/** Stream a chat completion from the loaded WebLLM engine. */
export async function* streamWebLLMChat(
	messages: Message[],
	signal: AbortSignal
): AsyncGenerator<StreamChunk> {
	if (!engine) throw new Error('WebLLM engine not loaded');

	const chunks = await engine.chat.completions.create({
		messages: messages.map((m) => ({ role: m.role, content: m.content })),
		stream: true,
		stream_options: { include_usage: true }
	});

	let promptTokens = 0;
	let responseTokens = 0;

	signal.addEventListener('abort', () => {
		try {
			engine!.interruptGenerate();
		} catch {
			/* engine may already be stopped */
		}
	});

	for await (const chunk of chunks) {
		if (signal.aborted) break;

		const delta = chunk.choices[0]?.delta?.content;
		if (delta) {
			yield { type: 'delta', delta };
		}

		if (chunk.usage) {
			promptTokens = chunk.usage.prompt_tokens;
			responseTokens = chunk.usage.completion_tokens;
		}
	}

	yield { type: 'done', promptTokens, responseTokens };
}
