import { describe, expect, it, vi, beforeEach } from 'vitest';

import {
	isStreaming,
	isAnyStreaming,
	startStream,
	cancelStream,
	cancelStreamsForChat,
	type StreamStore,
	type StreamDeps
} from './streams';
import * as domain from '@/domain';
import type { StreamChunk } from '@/external/providers/stream';

// ── Helpers ──────────────────────────────────────────────────────────────────

const MODEL = 'claude-sonnet-4-6';
const PROVIDER = 'claude' as const;

function makeStore(): StreamStore {
	return {
		streamingIds: new Set(),
		actors: new Map(),
		actorChatIds: new Map()
	};
}

/** Simulates a mini chat state: multiple chats keyed by ID, with read/write access. */
function makeChatState(initial: Record<string, domain.tree.ChatTree>) {
	const chats = new Map<string, domain.tree.ChatTree>(Object.entries(initial));
	return {
		chats,
		get: (chatId: string) => chats.get(chatId),
		set: (chatId: string, tree: domain.tree.ChatTree) => chats.set(chatId, tree),
		delete: (chatId: string) => chats.delete(chatId)
	};
}

function makeDeps(
	chatState: ReturnType<typeof makeChatState>,
	streamFn: StreamDeps['getProviderStream']
): StreamDeps {
	return {
		getTreeByChatId: vi.fn().mockImplementation((id: string) => chatState.get(id)),
		replaceTreeByChatId: vi
			.fn()
			.mockImplementation((id: string, tree: domain.tree.ChatTree) => chatState.set(id, tree)),
		getProviderStream: streamFn
	};
}

function buildConversation(prompts: string[]): {
	tree: domain.tree.ChatTree;
	exchangeIds: string[];
} {
	let tree = domain.tree.buildEmptyTree();
	let parentId = 'unused';
	const exchangeIds: string[] = [];
	for (const prompt of prompts) {
		const result = domain.tree.addExchange(tree, parentId, prompt, MODEL, PROVIDER);
		tree = {
			rootId: result.tree.rootId,
			exchanges: domain.tree.updateExchangeResponse(
				result.tree.exchanges,
				result.id,
				`reply to ${prompt}`
			)
		};
		parentId = result.id;
		exchangeIds.push(result.id);
	}
	return { tree, exchangeIds };
}

/** Add one more exchange (no response yet — ready to stream into). */
function appendPendingExchange(
	tree: domain.tree.ChatTree,
	parentId: string,
	prompt: string
): { tree: domain.tree.ChatTree; exchangeId: string } {
	const result = domain.tree.addExchange(tree, parentId, prompt, MODEL, PROVIDER);
	return {
		tree: result.tree,
		exchangeId: result.id
	};
}

function buildHistory(tree: domain.tree.ChatTree, exchangeId: string): domain.tree.Message[] {
	return domain.tree.getPath(tree, exchangeId).flatMap((exchange) => {
		const messages: domain.tree.Message[] = [{ role: 'user', content: exchange.prompt.text }];
		if (exchange.response) {
			messages.push({ role: 'assistant', content: exchange.response.text });
		}
		return messages;
	});
}

function immediateStream(chunks: StreamChunk[]): StreamDeps['getProviderStream'] {
	return async function* () {
		for (const c of chunks) yield c;
	};
}

function slowStream(
	preChunks: StreamChunk[],
	resolveSignal?: { resolve: () => void }
): StreamDeps['getProviderStream'] {
	return async function* (_m, _h, signal) {
		for (const c of preChunks) yield c;
		await new Promise<void>((resolve) => {
			if (resolveSignal) resolveSignal.resolve = resolve;
			if (signal.aborted) return resolve();
			signal.addEventListener('abort', () => resolve());
		});
		yield { type: 'done', promptTokens: 0, responseTokens: 0 };
	};
}

function waitForIdle(store: StreamStore, timeout = 3000): Promise<void> {
	return new Promise((resolve, reject) => {
		const start = Date.now();
		const check = () => {
			if (!isAnyStreaming(store)) return resolve();
			if (Date.now() - start > timeout) return reject(new Error('Timed out'));
			setTimeout(check, 10);
		};
		setTimeout(check, 10);
	});
}

function waitForStreamDone(store: StreamStore, exchangeId: string, timeout = 3000): Promise<void> {
	return new Promise((resolve, reject) => {
		const start = Date.now();
		const check = () => {
			if (!isStreaming(store, exchangeId)) return resolve();
			if (Date.now() - start > timeout) return reject(new Error('Timed out'));
			setTimeout(check, 10);
		};
		setTimeout(check, 10);
	});
}

// ── Integration Tests ────────────────────────────────────────────────────────

describe('streams integration', () => {
	let store: StreamStore;

	beforeEach(() => {
		store = makeStore();
	});

	describe('full stream lifecycle: start → deltas → done → tree updated', () => {
		it('accumulates deltas into the exchange response and persists token counts', async () => {
			const { tree, exchangeIds } = buildConversation(['first question']);
			const lastId = exchangeIds.at(-1)!;
			const { tree: readyTree, exchangeId } = appendPendingExchange(tree, lastId, 'follow-up');

			const chatState = makeChatState({ 'chat-1': readyTree });
			const deps = makeDeps(
				chatState,
				immediateStream([
					{ type: 'delta', delta: 'Hello ' },
					{ type: 'delta', delta: 'there' },
					{ type: 'done', promptTokens: 15, responseTokens: 8 }
				])
			);

			startStream(store, deps, {
				exchangeId,
				chatId: 'chat-1',
				model: { provider: PROVIDER, modelId: MODEL },
				history: buildHistory(readyTree, exchangeId)
			});

			await waitForIdle(store);

			const finalTree = chatState.get('chat-1')!;
			expect(finalTree.exchanges[exchangeId]?.response?.text).toBe('Hello there');
			expect(finalTree.exchanges[exchangeId]?.prompt.tokenCount).toBe(15);
			expect(finalTree.exchanges[exchangeId]?.response?.tokenCount).toBe(8);
		});

		it('tree remains structurally valid after streaming completes', async () => {
			const { tree, exchangeIds } = buildConversation(['q1', 'q2']);
			const { tree: readyTree, exchangeId } = appendPendingExchange(
				tree,
				exchangeIds.at(-1)!,
				'q3'
			);

			const chatState = makeChatState({ 'chat-1': readyTree });
			const deps = makeDeps(
				chatState,
				immediateStream([
					{ type: 'delta', delta: 'answer' },
					{ type: 'done', promptTokens: 5, responseTokens: 3 }
				])
			);

			startStream(store, deps, {
				exchangeId,
				chatId: 'chat-1',
				model: { provider: PROVIDER, modelId: MODEL },
				history: buildHistory(readyTree, exchangeId)
			});

			await waitForIdle(store);

			expect(() => domain.tree.validateChatTree(chatState.get('chat-1')!)).not.toThrow();
		});
	});

	describe('stream error writes error message into the exchange', () => {
		it('persists the error in the response so it is visible to the user', async () => {
			const { tree } = buildConversation([]);
			const { tree: readyTree, exchangeId } = appendPendingExchange(tree, 'unused', 'hello');

			const chatState = makeChatState({ 'chat-1': readyTree });
			// eslint-disable-next-line require-yield
			const deps = makeDeps(chatState, async function* () {
				throw new Error('Rate limit exceeded');
			});

			startStream(store, deps, {
				exchangeId,
				chatId: 'chat-1',
				model: { provider: PROVIDER, modelId: MODEL },
				history: buildHistory(readyTree, exchangeId)
			});

			await waitForIdle(store);

			const finalTree = chatState.get('chat-1')!;
			expect(finalTree.exchanges[exchangeId]?.response?.text).toContain('Rate limit exceeded');
			expect(isStreaming(store, exchangeId)).toBe(false);
		});
	});

	describe('cancel mid-stream preserves partial response', () => {
		it('keeps whatever deltas arrived before cancellation', async () => {
			const { tree } = buildConversation([]);
			const { tree: readyTree, exchangeId } = appendPendingExchange(tree, 'unused', 'prompt');

			const chatState = makeChatState({ 'chat-1': readyTree });
			const sig: { resolve: () => void } = { resolve: () => {} };
			const deps = makeDeps(
				chatState,
				slowStream([{ type: 'delta', delta: 'partial answer' }], sig)
			);

			startStream(store, deps, {
				exchangeId,
				chatId: 'chat-1',
				model: { provider: PROVIDER, modelId: MODEL },
				history: buildHistory(readyTree, exchangeId)
			});

			// Wait for the delta to land
			await vi.waitFor(() => {
				const t = chatState.get('chat-1')!;
				expect(t.exchanges[exchangeId]?.response?.text).toBe('partial answer');
			});

			cancelStream(store, exchangeId);
			await waitForIdle(store);

			const finalTree = chatState.get('chat-1')!;
			expect(finalTree.exchanges[exchangeId]?.response?.text).toBe('partial answer');
			expect(isStreaming(store, exchangeId)).toBe(false);
		});
	});

	describe('chat deleted while stream is running', () => {
		it('cleans up without crashing when the tree disappears', async () => {
			const { tree } = buildConversation([]);
			const { tree: readyTree, exchangeId } = appendPendingExchange(tree, 'unused', 'prompt');

			const chatState = makeChatState({ 'chat-1': readyTree });
			const sig: { resolve: () => void } = { resolve: () => {} };
			const deps = makeDeps(chatState, slowStream([{ type: 'delta', delta: 'in progress' }], sig));

			startStream(store, deps, {
				exchangeId,
				chatId: 'chat-1',
				model: { provider: PROVIDER, modelId: MODEL },
				history: buildHistory(readyTree, exchangeId)
			});

			// Wait for at least one delta, then simulate deleting the chat
			await vi.waitFor(() => {
				expect(isStreaming(store, exchangeId)).toBe(true);
			});

			chatState.delete('chat-1');
			sig.resolve();

			await waitForIdle(store);

			expect(isStreaming(store, exchangeId)).toBe(false);
			expect(isAnyStreaming(store)).toBe(false);
		});
	});

	describe('multiple concurrent streams across different chats', () => {
		it('each stream writes to its own chat, not the other', async () => {
			const { tree: tree1 } = buildConversation([]);
			const { tree: ready1, exchangeId: exId1 } = appendPendingExchange(tree1, 'unused', 'q1');

			const { tree: tree2 } = buildConversation([]);
			const { tree: ready2, exchangeId: exId2 } = appendPendingExchange(tree2, 'unused', 'q2');

			const chatState = makeChatState({ 'chat-1': ready1, 'chat-2': ready2 });

			const deps1 = makeDeps(
				chatState,
				immediateStream([
					{ type: 'delta', delta: 'answer-1' },
					{ type: 'done', promptTokens: 10, responseTokens: 5 }
				])
			);
			const deps2 = makeDeps(
				chatState,
				immediateStream([
					{ type: 'delta', delta: 'answer-2' },
					{ type: 'done', promptTokens: 20, responseTokens: 10 }
				])
			);

			startStream(store, deps1, {
				exchangeId: exId1,
				chatId: 'chat-1',
				model: { provider: PROVIDER, modelId: MODEL },
				history: buildHistory(ready1, exId1)
			});
			startStream(store, deps2, {
				exchangeId: exId2,
				chatId: 'chat-2',
				model: { provider: PROVIDER, modelId: MODEL },
				history: buildHistory(ready2, exId2)
			});

			await waitForIdle(store);

			expect(chatState.get('chat-1')!.exchanges[exId1]?.response?.text).toBe('answer-1');
			expect(chatState.get('chat-2')!.exchanges[exId2]?.response?.text).toBe('answer-2');
			// Token counts isolated
			expect(chatState.get('chat-1')!.exchanges[exId1]?.prompt.tokenCount).toBe(10);
			expect(chatState.get('chat-2')!.exchanges[exId2]?.prompt.tokenCount).toBe(20);
		});

		it('cancelStreamsForChat only cancels the targeted chat', async () => {
			const { tree: tree1 } = buildConversation([]);
			const { tree: ready1, exchangeId: exId1 } = appendPendingExchange(tree1, 'unused', 'q1');

			const { tree: tree2 } = buildConversation([]);
			const { tree: ready2, exchangeId: exId2 } = appendPendingExchange(tree2, 'unused', 'q2');

			const chatState = makeChatState({ 'chat-1': ready1, 'chat-2': ready2 });

			const sig1: { resolve: () => void } = { resolve: () => {} };
			const deps1 = makeDeps(chatState, slowStream([{ type: 'delta', delta: 'slow-1' }], sig1));
			const deps2 = makeDeps(
				chatState,
				immediateStream([
					{ type: 'delta', delta: 'fast-2' },
					{ type: 'done', promptTokens: 1, responseTokens: 1 }
				])
			);

			startStream(store, deps1, {
				exchangeId: exId1,
				chatId: 'chat-1',
				model: { provider: PROVIDER, modelId: MODEL },
				history: buildHistory(ready1, exId1)
			});
			startStream(store, deps2, {
				exchangeId: exId2,
				chatId: 'chat-2',
				model: { provider: PROVIDER, modelId: MODEL },
				history: buildHistory(ready2, exId2)
			});

			// Wait for chat-2 to finish naturally
			await waitForStreamDone(store, exId2);

			// chat-1 is still streaming
			expect(isStreaming(store, exId1)).toBe(true);

			cancelStreamsForChat(store, 'chat-1');
			await waitForIdle(store);

			expect(isStreaming(store, exId1)).toBe(false);
			// chat-2's result is intact
			expect(chatState.get('chat-2')!.exchanges[exId2]?.response?.text).toBe('fast-2');
		});
	});

	describe('stream then follow-up stream on the same conversation', () => {
		it('second stream sees the full history including the first response', async () => {
			const { tree } = buildConversation([]);
			const { tree: tree1, exchangeId: exId1 } = appendPendingExchange(
				tree,
				'unused',
				'first question'
			);

			const chatState = makeChatState({ 'chat-1': tree1 });

			// First stream completes
			const deps1 = makeDeps(
				chatState,
				immediateStream([
					{ type: 'delta', delta: 'first answer' },
					{ type: 'done', promptTokens: 5, responseTokens: 3 }
				])
			);

			startStream(store, deps1, {
				exchangeId: exId1,
				chatId: 'chat-1',
				model: { provider: PROVIDER, modelId: MODEL },
				history: buildHistory(tree1, exId1)
			});

			await waitForIdle(store);

			// Now add a second exchange to the updated tree
			const updatedTree = chatState.get('chat-1')!;
			const { tree: tree2, exchangeId: exId2 } = appendPendingExchange(
				updatedTree,
				exId1,
				'follow-up question'
			);
			chatState.set('chat-1', tree2);

			// Capture what history the second stream receives
			let capturedHistory: unknown[] = [];
			const deps2 = makeDeps(chatState, async function* (model, history, _signal) {
				capturedHistory = history;
				yield { type: 'delta', delta: 'second answer' };
				yield { type: 'done', promptTokens: 10, responseTokens: 6 };
			});

			startStream(store, deps2, {
				exchangeId: exId2,
				chatId: 'chat-1',
				model: { provider: PROVIDER, modelId: MODEL },
				history: buildHistory(tree2, exId2)
			});

			await waitForIdle(store);

			// History should contain the full conversation
			expect(capturedHistory).toEqual([
				{ role: 'user', content: 'first question' },
				{ role: 'assistant', content: 'first answer' },
				{ role: 'user', content: 'follow-up question' }
			]);

			const finalTree = chatState.get('chat-1')!;
			expect(finalTree.exchanges[exId1]?.response?.text).toBe('first answer');
			expect(finalTree.exchanges[exId2]?.response?.text).toBe('second answer');
		});
	});

	describe('stream error followed by retry on same exchange', () => {
		it('retry overwrites the error with the successful response', async () => {
			const { tree } = buildConversation([]);
			const { tree: readyTree, exchangeId } = appendPendingExchange(tree, 'unused', 'prompt');

			const chatState = makeChatState({ 'chat-1': readyTree });

			// First attempt: error
			// eslint-disable-next-line require-yield
			const deps1 = makeDeps(chatState, async function* () {
				throw new Error('Server error');
			});

			startStream(store, deps1, {
				exchangeId,
				chatId: 'chat-1',
				model: { provider: PROVIDER, modelId: MODEL },
				history: buildHistory(readyTree, exchangeId)
			});

			await waitForIdle(store);
			expect(chatState.get('chat-1')!.exchanges[exchangeId]?.response?.text).toContain(
				'Server error'
			);

			// Retry: success
			const treeAfterError = chatState.get('chat-1')!;
			const deps2 = makeDeps(
				chatState,
				immediateStream([
					{ type: 'delta', delta: 'success' },
					{ type: 'done', promptTokens: 5, responseTokens: 3 }
				])
			);

			startStream(store, deps2, {
				exchangeId,
				chatId: 'chat-1',
				model: { provider: PROVIDER, modelId: MODEL },
				history: buildHistory(treeAfterError, exchangeId)
			});

			await waitForIdle(store);

			const finalTree = chatState.get('chat-1')!;
			expect(finalTree.exchanges[exchangeId]?.response?.text).toBe('success');
			expect(finalTree.exchanges[exchangeId]?.prompt.tokenCount).toBe(5);
		});
	});
});
