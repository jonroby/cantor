import { setup, assign, fromCallback } from 'xstate';
import type * as domain from '@/domain';
import type * as providers from '@/external/providers';

type StreamFactory = (
	model: domain.models.ActiveModel,
	history: domain.tree.Message[],
	signal: AbortSignal,
	tools?: providers.stream.ToolDefinition[]
) => AsyncGenerator<providers.stream.StreamChunk>;

export interface StreamMachineInput {
	exchangeId: string;
	model: domain.models.ActiveModel;
	history: domain.tree.Message[];
	getStream: StreamFactory;
	tools?: providers.stream.ToolDefinition[];
}

export type StreamMachineEvent =
	| { type: 'DELTA'; delta: string }
	| { type: 'DONE'; promptTokens: number; responseTokens: number }
	| { type: 'TOOL_USE'; toolCalls: providers.stream.ToolUseBlock[]; responseText: string; stopReason?: string }
	| { type: 'TOOL_RESULT'; messages: unknown[] }
	| { type: 'ERROR'; message: string }
	| { type: 'CANCEL' };

interface CallbackInput {
	model: domain.models.ActiveModel;
	history: domain.tree.Message[];
	getStream: StreamFactory;
	tools?: providers.stream.ToolDefinition[];
}

const streamCallback = fromCallback<StreamMachineEvent, CallbackInput>(({ sendBack, input }) => {
	const abortController = new AbortController();

	(async () => {
		try {
			const stream = input.getStream(input.model, input.history, abortController.signal, input.tools);
			const toolCalls: providers.stream.ToolUseBlock[] = [];
			let responseText = '';
			let stopReason: string | undefined;

			for await (const chunk of stream) {
				if (chunk.type === 'delta') {
					responseText += chunk.delta;
					sendBack({ type: 'DELTA', delta: chunk.delta });
				} else if (chunk.type === 'tool_use') {
					toolCalls.push(chunk.toolUse);
				} else if (chunk.type === 'done') {
					stopReason = chunk.stopReason;
					if (toolCalls.length === 0) {
						sendBack({
							type: 'DONE',
							promptTokens: chunk.promptTokens,
							responseTokens: chunk.responseTokens
						});
					}
				}
			}

			if (toolCalls.length > 0) {
				sendBack({ type: 'TOOL_USE', toolCalls, responseText, stopReason });
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
			tools: providers.stream.ToolDefinition[] | undefined;
			toolCalls: providers.stream.ToolUseBlock[];
			turnCount: number;
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
		getStream: input.getStream,
		tools: input.tools,
		toolCalls: [],
		turnCount: 0
	}),
	states: {
		streaming: {
			invoke: {
				src: 'streamCallback',
				input: ({ context }) => ({
					model: context.model,
					history: context.history,
					getStream: context.getStream,
					tools: context.tools
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
				TOOL_USE: {
					target: 'awaiting_tools',
					actions: assign({
						toolCalls: ({ event }) => event.toolCalls,
						turnCount: ({ context }) => context.turnCount + 1
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
		awaiting_tools: {
			on: {
				TOOL_RESULT: {
					target: 'streaming',
					guard: ({ context }) => context.turnCount < 10,
					actions: assign({
						history: ({ event }) => event.messages as domain.tree.Message[]
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
