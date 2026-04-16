/**
 * On-demand embedding provider backed by `@xenova/transformers` running in a
 * dedicated Web Worker. The library import is split into its own chunk
 * (see vite.config.ts) and is dynamically imported at app boot via
 * `primeEmbeddingLib` so the model is warm by the time the user selects the
 * embedding context strategy.
 */

const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';
const BATCH_SIZE = 32;

type WorkerReply =
	| { type: 'init-result'; id: number }
	| { type: 'embed-result'; id: number; vectors: Float32Array[] }
	| { type: 'error'; id: number; message: string };

interface PendingCall {
	resolve: (vectors: Float32Array[]) => void;
	reject: (err: Error) => void;
}

let worker: Worker | null = null;
let initPromise: Promise<void> | null = null;
let libPrimePromise: Promise<unknown> | null = null;
let nextCallId = 1;
const pending = new Map<number, PendingCall>();

export function getEmbeddingModelName(): string {
	return EMBEDDING_MODEL;
}

export function isEmbeddingReady(): boolean {
	return worker !== null && initPromise !== null;
}

/**
 * Kick off the dynamic import of `@xenova/transformers` so the chunk is
 * fetched and cached. Safe to call repeatedly. Does not instantiate the
 * pipeline yet — that happens on the first `embed()` call.
 */
export function primeEmbeddingLib(): Promise<unknown> {
	if (!libPrimePromise) {
		libPrimePromise = import('@xenova/transformers').catch((err) => {
			libPrimePromise = null;
			throw err;
		});
	}
	return libPrimePromise;
}

function ensureWorker(): Worker {
	if (worker) return worker;
	const w = new Worker(new URL('./embedding-worker.ts', import.meta.url), { type: 'module' });
	w.onmessage = (event: MessageEvent<WorkerReply>) => {
		const msg = event.data;
		const call = pending.get(msg.id);
		if (!call) return;
		pending.delete(msg.id);
		if (msg.type === 'error') {
			call.reject(new Error(msg.message));
		} else if (msg.type === 'embed-result') {
			call.resolve(msg.vectors);
		} else {
			call.resolve([]);
		}
	};
	worker = w;
	return w;
}

function callWorker(
	payload: { type: 'init'; model: string } | { type: 'embed'; texts: string[] }
): Promise<Float32Array[]> {
	const w = ensureWorker();
	const id = nextCallId++;
	return new Promise<Float32Array[]>((resolve, reject) => {
		pending.set(id, { resolve, reject });
		w.postMessage({ ...payload, id });
	});
}

async function ensureInit(): Promise<void> {
	if (initPromise) return initPromise;
	initPromise = callWorker({ type: 'init', model: EMBEDDING_MODEL })
		.then(() => undefined)
		.catch((err) => {
			initPromise = null;
			throw err;
		});
	return initPromise;
}

/**
 * Embed a list of texts, returning one Float32Array per input in order.
 * Batches internally to keep worker messages bounded.
 */
export async function embed(texts: string[]): Promise<Float32Array[]> {
	if (texts.length === 0) return [];
	await primeEmbeddingLib();
	await ensureInit();
	const out: Float32Array[] = [];
	for (let i = 0; i < texts.length; i += BATCH_SIZE) {
		const batch = texts.slice(i, i + BATCH_SIZE);
		const vectors = await callWorker({ type: 'embed', texts: batch });
		out.push(...vectors);
	}
	return out;
}
