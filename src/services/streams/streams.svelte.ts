import { SvelteMap } from 'svelte/reactivity';
import { createActor, type Actor, type SnapshotFrom } from 'xstate';
import { streamMachine, type StreamMachineInput } from './stream.machine';
import type { ActiveModel } from '@/lib/models';
import type { ExchangeMap } from '@/domain/tree';
import { getHistory, updateExchangeResponse, updateExchangeTokens } from '@/domain/tree';
import { getActiveExchanges, replaceActiveExchanges } from '@/state/chats.svelte';
import { getProviderStream } from '@/state/providers.svelte';

type StreamActor = Actor<typeof streamMachine>;

let streamingIds: string[] = $state([]);
const actors = new SvelteMap<string, StreamActor>();

export function isStreaming(exchangeId: string): boolean {
	return streamingIds.includes(exchangeId);
}

export function isAnyStreaming(): boolean {
	return streamingIds.length > 0;
}

function addStreamingId(id: string) {
	streamingIds = [...streamingIds, id];
}

function removeStreamingId(id: string) {
	streamingIds = streamingIds.filter((sid) => sid !== id);
}

function cleanup(exchangeId: string) {
	removeStreamingId(exchangeId);
	actors.delete(exchangeId);
}

export function startStream(params: {
	exchangeId: string;
	model: ActiveModel;
	exchanges: ExchangeMap;
}): void {
	const { exchangeId, model, exchanges } = params;
	const history = getHistory(exchanges, exchangeId);

	const input: StreamMachineInput = {
		exchangeId,
		model,
		history,
		getStream: getProviderStream
	};

	const actor = createActor(streamMachine, { input });

	actors.set(exchangeId, actor);
	addStreamingId(exchangeId);

	let lastResponse = '';

	actor.subscribe((snapshot: SnapshotFrom<typeof streamMachine>) => {
		const { context } = snapshot;

		if (snapshot.status === 'active' && context.response !== lastResponse) {
			lastResponse = context.response;
			replaceActiveExchanges(
				updateExchangeResponse(getActiveExchanges(), exchangeId, context.response)
			);
		}

		if (snapshot.status === 'done') {
			if (context.error === null && (context.promptTokens > 0 || context.responseTokens > 0)) {
				replaceActiveExchanges(
					updateExchangeTokens(
						getActiveExchanges(),
						exchangeId,
						context.promptTokens,
						context.responseTokens
					)
				);
			}

			if (context.error !== null) {
				replaceActiveExchanges(
					updateExchangeResponse(getActiveExchanges(), exchangeId, context.response)
				);
			}

			cleanup(exchangeId);
		}
	});

	actor.start();
}

export function cancelStream(exchangeId: string): void {
	const actor = actors.get(exchangeId);
	if (!actor) return;
	actor.send({ type: 'CANCEL' });
}

export function cancelAllStreams(): void {
	for (const [exchangeId] of actors) {
		cancelStream(exchangeId);
	}
}
