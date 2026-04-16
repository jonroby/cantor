/// <reference lib="webworker" />
import { pipeline, env, type FeatureExtractionPipeline } from '@xenova/transformers';

// Let transformers.js fetch model weights from the Hugging Face CDN.
// We never ship weights locally, so disable the local-model lookup to
// avoid 404 probes on the app origin.
env.allowLocalModels = false;

type InitMessage = { type: 'init'; id: number; model: string };
type EmbedMessage = { type: 'embed'; id: number; texts: string[] };
type IncomingMessage = InitMessage | EmbedMessage;

let extractor: FeatureExtractionPipeline | null = null;
let currentModel: string | null = null;

async function ensurePipeline(model: string): Promise<FeatureExtractionPipeline> {
	if (extractor && currentModel === model) return extractor;
	extractor = (await pipeline('feature-extraction', model)) as FeatureExtractionPipeline;
	currentModel = model;
	return extractor;
}

self.onmessage = async (event: MessageEvent<IncomingMessage>) => {
	const msg = event.data;
	try {
		if (msg.type === 'init') {
			await ensurePipeline(msg.model);
			(self as DedicatedWorkerGlobalScope).postMessage({ type: 'init-result', id: msg.id });
			return;
		}

		if (msg.type === 'embed') {
			const ex = await ensurePipeline(currentModel ?? 'Xenova/all-MiniLM-L6-v2');
			const output = await ex(msg.texts, { pooling: 'mean', normalize: true });
			const [rows, dim] = output.dims as [number, number];
			const flat = output.data as Float32Array;
			const vectors: Float32Array[] = [];
			for (let i = 0; i < rows; i++) {
				// Copy into its own Float32Array so it can be transferred.
				const slice = new Float32Array(dim);
				slice.set(flat.subarray(i * dim, (i + 1) * dim));
				vectors.push(slice);
			}
			(self as DedicatedWorkerGlobalScope).postMessage(
				{ type: 'embed-result', id: msg.id, vectors },
				vectors.map((v) => v.buffer)
			);
			return;
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		(self as DedicatedWorkerGlobalScope).postMessage({ type: 'error', id: msg.id, message });
	}
};
