import { describe, expect, it } from 'vitest';
import { createActor, type SnapshotFrom } from 'xstate';
import { streamMachine, type StreamMachineInput } from './stream.machine';
import type { StreamChunk } from '@/state/services/providers/stream';
import type { Message } from '@/domain/tree';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeInput(chunks: StreamChunk[] = [], opts?: { throwError?: string }): StreamMachineInput {
	return {
		exchangeId: 'test-exchange',
		model: { provider: 'claude', modelId: 'claude-sonnet-4-6' },
		history: [{ role: 'user', content: 'hello' }] as Message[],
		getStream: async function* (_model, _history, _signal) {
			for (const chunk of chunks) {
				yield chunk;
			}
			if (opts?.throwError) {
				throw new Error(opts.throwError);
			}
		}
	};
}

function collectSnapshots(input: StreamMachineInput): Promise<SnapshotFrom<typeof streamMachine>> {
	return new Promise((resolve) => {
		const actor = createActor(streamMachine, { input });
		actor.subscribe((snapshot) => {
			if (snapshot.status !== 'active') {
				resolve(snapshot);
			}
		});
		actor.start();
	});
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('streamMachine', () => {
	it('starts in streaming state', () => {
		const input = makeInput();
		const actor = createActor(streamMachine, { input });
		actor.start();
		expect(actor.getSnapshot().value).toBe('streaming');
		actor.stop();
	});

	it('accumulates response from DELTA events', async () => {
		const input = makeInput([
			{ type: 'delta', delta: 'Hello ' },
			{ type: 'delta', delta: 'world' },
			{ type: 'done', promptTokens: 10, responseTokens: 20 }
		]);

		const final = await collectSnapshots(input);
		expect(final.context.response).toBe('Hello world');
	});

	it('records token counts from DONE event', async () => {
		const input = makeInput([
			{ type: 'delta', delta: 'ok' },
			{ type: 'done', promptTokens: 42, responseTokens: 100 }
		]);

		const final = await collectSnapshots(input);
		expect(final.context.promptTokens).toBe(42);
		expect(final.context.responseTokens).toBe(100);
	});

	it('transitions to done state on completion', async () => {
		const input = makeInput([{ type: 'done', promptTokens: 0, responseTokens: 0 }]);

		const final = await collectSnapshots(input);
		expect(final.value).toBe('done');
		expect(final.status).toBe('done');
	});

	it('transitions to error state on stream error', async () => {
		const input = makeInput([], { throwError: 'Network failure' });

		const final = await collectSnapshots(input);
		expect(final.value).toBe('error');
		expect(final.context.error).toBe('Network failure');
		expect(final.context.response).toContain('Network failure');
	});

	it('transitions to done state on CANCEL', async () => {
		const input: StreamMachineInput = {
			exchangeId: 'test',
			model: { provider: 'claude', modelId: 'claude-sonnet-4-6' },
			history: [{ role: 'user', content: 'hello' }] as Message[],
			getStream: async function* (_model, _history, signal) {
				yield { type: 'delta' as const, delta: 'partial' };
				// Wait indefinitely so we can cancel
				await new Promise((_resolve, reject) => {
					signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
				});
			}
		};

		const result = await new Promise<SnapshotFrom<typeof streamMachine>>((resolve) => {
			const actor = createActor(streamMachine, { input });
			let sentCancel = false;
			actor.subscribe((snapshot) => {
				if (snapshot.context.response === 'partial' && !sentCancel) {
					sentCancel = true;
					actor.send({ type: 'CANCEL' });
				}
				if (snapshot.status !== 'active') {
					resolve(snapshot);
				}
			});
			actor.start();
		});

		expect(result.value).toBe('done');
		expect(result.context.response).toBe('partial');
		expect(result.context.error).toBeNull();
	});

	it('swallows AbortError raised by the stream callback during cancellation', async () => {
		const input: StreamMachineInput = {
			exchangeId: 'test',
			model: { provider: 'claude', modelId: 'claude-sonnet-4-6' },
			history: [{ role: 'user', content: 'hello' }] as Message[],
			// eslint-disable-next-line require-yield
			getStream: async function* (_model, _history, signal) {
				await new Promise((_resolve, reject) => {
					signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
				});
			}
		};

		const result = await new Promise<SnapshotFrom<typeof streamMachine>>((resolve) => {
			const actor = createActor(streamMachine, { input });
			actor.subscribe((snapshot) => {
				if (snapshot.value === 'streaming') {
					actor.send({ type: 'CANCEL' });
				}
				if (snapshot.status !== 'active') {
					resolve(snapshot);
				}
			});
			actor.start();
		});

		expect(result.value).toBe('done');
		expect(result.context.error).toBeNull();
	});

	it('reports a fallback message when a non-Error value is thrown', async () => {
		const input: StreamMachineInput = {
			exchangeId: 'test-exchange',
			model: { provider: 'claude', modelId: 'claude-sonnet-4-6' },
			history: [{ role: 'user', content: 'hello' }] as Message[],
			// eslint-disable-next-line require-yield
			getStream: async function* () {
				throw 'boom';
			}
		};

		const final = await collectSnapshots(input);
		expect(final.value).toBe('error');
		expect(final.context.error).toBe('Unknown error.');
	});

	it('initializes context from input', () => {
		const input = makeInput();
		const actor = createActor(streamMachine, { input });
		actor.start();
		const ctx = actor.getSnapshot().context;
		expect(ctx.exchangeId).toBe('test-exchange');
		expect(ctx.response).toBe('');
		expect(ctx.promptTokens).toBe(0);
		expect(ctx.responseTokens).toBe(0);
		expect(ctx.error).toBeNull();
		actor.stop();
	});
});
