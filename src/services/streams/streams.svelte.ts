import { SvelteMap } from 'svelte/reactivity';
import { createActor, type Actor, type SnapshotFrom } from 'xstate';
import { streamMachine, type StreamMachineInput } from './stream.machine';
import type { ActiveModel } from '@/lib/models';
import type { ChatTree } from '@/domain/tree';
import { getHistory, updateExchangeResponse, updateExchangeTokens } from '@/domain/tree';
import { getTreeByChatId, replaceTreeByChatId } from '@/state/chats.svelte';
import { getProviderStream } from '@/state/providers.svelte';

type StreamActor = Actor<typeof streamMachine>;

let streamingIds: string[] = $state([]);
const actors = new SvelteMap<string, StreamActor>();
const actorChatIds = new SvelteMap<string, string>();

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
	actorChatIds.delete(exchangeId);
}

export function startStream(params: {
	exchangeId: string;
	chatId: string;
	model: ActiveModel;
	tree: ChatTree;
}): void {
	const { exchangeId, chatId, model, tree } = params;
	const history = getHistory(tree, exchangeId);

	const input: StreamMachineInput = {
		exchangeId,
		model,
		history,
		getStream: getProviderStream
	};

	const actor = createActor(streamMachine, { input });

	actors.set(exchangeId, actor);
	actorChatIds.set(exchangeId, chatId);
	addStreamingId(exchangeId);

	let lastResponse = '';

	actor.subscribe((snapshot: SnapshotFrom<typeof streamMachine>) => {
		const { context } = snapshot;
		const targetChatId = actorChatIds.get(exchangeId);
		if (!targetChatId) return;

		const currentTree = getTreeByChatId(targetChatId);
		if (!currentTree) {
			cleanup(exchangeId);
			return;
		}

		if (snapshot.status === 'active' && context.response !== lastResponse) {
			lastResponse = context.response;
			replaceTreeByChatId(
				targetChatId,
				{
					rootId: currentTree.rootId,
					exchanges: updateExchangeResponse(currentTree.exchanges, exchangeId, context.response)
				}
			);
		}

		if (snapshot.status === 'done') {
			if (context.error === null && (context.promptTokens > 0 || context.responseTokens > 0)) {
				const latestTree = getTreeByChatId(targetChatId);
				if (latestTree) {
					replaceTreeByChatId(
						targetChatId,
						{
							rootId: latestTree.rootId,
							exchanges: updateExchangeTokens(
								latestTree.exchanges,
								exchangeId,
								context.promptTokens,
								context.responseTokens
							)
						}
					);
				}
			}

			if (context.error !== null) {
				const latestTree = getTreeByChatId(targetChatId);
				if (latestTree) {
					replaceTreeByChatId(
						targetChatId,
						{
							rootId: latestTree.rootId,
							exchanges: updateExchangeResponse(
								latestTree.exchanges,
								exchangeId,
								context.response
							)
						}
					);
				}
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

export function cancelStreamsForExchanges(exchangeIds: string[]): void {
	for (const exchangeId of exchangeIds) {
		cancelStream(exchangeId);
	}
}

export function cancelStreamsForChat(chatId: string): void {
	for (const [exchangeId, cid] of actorChatIds) {
		if (cid === chatId) {
			cancelStream(exchangeId);
		}
	}
}
