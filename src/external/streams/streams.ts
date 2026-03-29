import { createActor, type Actor, type SnapshotFrom } from 'xstate';
import { streamMachine, type StreamMachineInput } from './stream.machine';
import * as domain from '@/domain';
import type { StreamChunk } from '@/external/providers/stream';

type StreamActor = Actor<typeof streamMachine>;

export interface StreamStore {
	streamingIds: Set<string>;
	actors: Map<string, StreamActor>;
	actorChatIds: Map<string, string>;
}

export interface StreamDeps {
	getTreeByChatId: (chatId: string) => domain.tree.ChatTree | undefined;
	replaceTreeByChatId: (chatId: string, tree: domain.tree.ChatTree) => void;
	getProviderStream: (
		model: domain.models.ActiveModel,
		history: domain.tree.Message[],
		signal: AbortSignal
	) => AsyncGenerator<StreamChunk>;
}

export function isStreaming(store: StreamStore, exchangeId: string): boolean {
	return store.streamingIds.has(exchangeId);
}

export function isAnyStreaming(store: StreamStore): boolean {
	return store.streamingIds.size > 0;
}

function cleanup(store: StreamStore, exchangeId: string) {
	store.streamingIds.delete(exchangeId);
	store.actors.delete(exchangeId);
	store.actorChatIds.delete(exchangeId);
}

export function startStream(
	store: StreamStore,
	deps: StreamDeps,
	params: {
		exchangeId: string;
		chatId: string;
		model: domain.models.ActiveModel;
		tree: domain.tree.ChatTree;
		liveDocContent?: string;
	}
): void {
	const { exchangeId, chatId, model, tree, liveDocContent } = params;
	const history = domain.tree.getHistory(tree, exchangeId);

	if (liveDocContent !== undefined) {
		const docMessage: domain.tree.Message = {
			role: 'user',
			content: `The user is working on this document in tandem with this chat. Remember this for context:\n\n${liveDocContent}`
		};
		const docResponse: domain.tree.Message = {
			role: 'assistant',
			content: 'Understood, I have the document.'
		};
		history.splice(history.length - 1, 0, docMessage, docResponse);
	}

	const input: StreamMachineInput = {
		exchangeId,
		model,
		history,
		getStream: deps.getProviderStream
	};

	const actor = createActor(streamMachine, { input });

	store.actors.set(exchangeId, actor);
	store.actorChatIds.set(exchangeId, chatId);
	store.streamingIds.add(exchangeId);

	let lastResponse = '';

	actor.subscribe((snapshot: SnapshotFrom<typeof streamMachine>) => {
		const { context } = snapshot;
		const targetChatId = store.actorChatIds.get(exchangeId);
		if (!targetChatId) return;

		const currentTree = deps.getTreeByChatId(targetChatId);
		if (!currentTree) {
			cleanup(store, exchangeId);
			return;
		}

		if (snapshot.status === 'active' && context.response !== lastResponse) {
			lastResponse = context.response;
			deps.replaceTreeByChatId(targetChatId, {
				rootId: currentTree.rootId,
				exchanges: domain.tree.updateExchangeResponse(
					currentTree.exchanges,
					exchangeId,
					context.response
				)
			});
		}

		if (snapshot.status === 'done') {
			if (context.error === null && (context.promptTokens > 0 || context.responseTokens > 0)) {
				const latestTree = deps.getTreeByChatId(targetChatId);
				if (latestTree) {
					deps.replaceTreeByChatId(targetChatId, {
						rootId: latestTree.rootId,
						exchanges: domain.tree.updateExchangeTokens(
							latestTree.exchanges,
							exchangeId,
							context.promptTokens,
							context.responseTokens
						)
					});
				}
			}

			if (context.error !== null) {
				const latestTree = deps.getTreeByChatId(targetChatId);
				if (latestTree) {
					deps.replaceTreeByChatId(targetChatId, {
						rootId: latestTree.rootId,
						exchanges: domain.tree.updateExchangeResponse(
							latestTree.exchanges,
							exchangeId,
							context.response
						)
					});
				}
			}

			cleanup(store, exchangeId);
		}
	});

	actor.start();
}

export function cancelStream(store: StreamStore, exchangeId: string): void {
	const actor = store.actors.get(exchangeId);
	if (!actor) return;
	actor.send({ type: 'CANCEL' });
}

export function cancelAllStreams(store: StreamStore): void {
	for (const [exchangeId] of store.actors) {
		cancelStream(store, exchangeId);
	}
}

export function cancelStreamsForExchanges(store: StreamStore, exchangeIds: string[]): void {
	for (const exchangeId of exchangeIds) {
		cancelStream(store, exchangeId);
	}
}

export function cancelStreamsForChat(store: StreamStore, chatId: string): void {
	for (const [exchangeId, cid] of store.actorChatIds) {
		if (cid === chatId) {
			cancelStream(store, exchangeId);
		}
	}
}
