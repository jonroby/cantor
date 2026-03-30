import { setup, assign, fromCallback } from 'xstate';
import type * as domain from '@/domain';
import type * as providers from '@/external/providers';

type StreamFactory = (
	model: domain.models.ActiveModel,
	history: domain.tree.Message[],
	signal: AbortSignal
) => AsyncGenerator<providers.stream.StreamChunk>;

export interface StreamMachineInput {
	exchangeId: string;
	model: domain.models.ActiveModel;
	history: domain.tree.Message[];
	getStream: StreamFactory;
}

export type StreamMachineEvent =
	| { type: 'DELTA'; delta: string }
	| { type: 'DONE'; promptTokens: number; responseTokens: number }
	| { type: 'ERROR'; message: string }
	| { type: 'CANCEL' };

interface CallbackInput {
	model: domain.models.ActiveModel;
	history: domain.tree.Message[];
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
			model: domain.models.ActiveModel;
			history: domain.tree.Message[];
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
