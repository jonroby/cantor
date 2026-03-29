import { setup, assign, fromCallback } from 'xstate';
import type { StreamChunk } from '@/external/providers/stream';
import type { ActiveModel } from '@/domain';
import type { Message } from '@/domain';

type StreamFactory = (
	model: ActiveModel,
	history: Message[],
	signal: AbortSignal
) => AsyncGenerator<StreamChunk>;

export interface StreamMachineInput {
	exchangeId: string;
	model: ActiveModel;
	history: Message[];
	getStream: StreamFactory;
}

export type StreamMachineEvent =
	| { type: 'DELTA'; delta: string }
	| { type: 'DONE'; promptTokens: number; responseTokens: number }
	| { type: 'ERROR'; message: string }
	| { type: 'CANCEL' };

interface CallbackInput {
	model: ActiveModel;
	history: Message[];
	getStream: StreamFactory;
}

const streamCallback = fromCallback<StreamMachineEvent, CallbackInput>(({ sendBack, input }) => {
	const abortController = new AbortController();

	(async () => {
		try {
			const stream = input.getStream(input.model, input.history, abortController.signal);
			for await (const chunk of stream) {
				if (chunk.type === 'delta') {
					sendBack({ type: 'DELTA', delta: chunk.delta });
				} else {
					sendBack({
						type: 'DONE',
						promptTokens: chunk.promptTokens,
						responseTokens: chunk.responseTokens
					});
				}
			}
		} catch (e) {
			if (e instanceof DOMException && e.name === 'AbortError') return;
			sendBack({
				type: 'ERROR',
				message: e instanceof Error ? e.message : 'Unknown error.'
			});
		}
	})();

	return () => {
		abortController.abort();
	};
});

export const streamMachine = setup({
	types: {
		context: {} as {
			exchangeId: string;
			response: string;
			promptTokens: number;
			responseTokens: number;
			error: string | null;
			model: ActiveModel;
			history: Message[];
			getStream: StreamFactory;
		},
		events: {} as StreamMachineEvent,
		input: {} as StreamMachineInput
	},
	actors: {
		streamCallback
	}
}).createMachine({
	id: 'stream',
	initial: 'streaming',
	context: ({ input }) => ({
		exchangeId: input.exchangeId,
		response: '',
		promptTokens: 0,
		responseTokens: 0,
		error: null,
		model: input.model,
		history: input.history,
		getStream: input.getStream
	}),
	states: {
		streaming: {
			invoke: {
				src: 'streamCallback',
				input: ({ context }) => ({
					model: context.model,
					history: context.history,
					getStream: context.getStream
				})
			},
			on: {
				DELTA: {
					actions: assign({
						response: ({ context, event }) => context.response + event.delta
					})
				},
				DONE: {
					target: 'done',
					actions: assign({
						promptTokens: ({ event }) => event.promptTokens,
						responseTokens: ({ event }) => event.responseTokens
					})
				},
				ERROR: {
					target: 'error',
					actions: assign({
						error: ({ event }) => event.message,
						response: ({ event }) => `Request failed.\n\n${event.message}`
					})
				},
				CANCEL: {
					target: 'done'
				}
			}
		},
		done: {
			type: 'final'
		},
		error: {
			type: 'final'
		}
	}
});
