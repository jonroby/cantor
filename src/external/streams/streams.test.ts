import { describe, expect, it, vi, beforeEach } from 'vitest';

import {
	isStreaming,
	isAnyStreaming,
	startStream,
	cancelStream,
	cancelAllStreams,
	cancelStreamsForExchanges,
	cancelStreamsForChat,
	type StreamStore,
	type StreamDeps
} from './streams';
import * as domain from '@/domain';

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

function buildTreeWithExchange(): { tree: domain.tree.ChatTree; exchangeId: string } {
	const empty = domain.tree.buildEmptyTree();
	const result = domain.tree.addExchangeResult(empty, 'ignored', 'Hello', MODEL, PROVIDER);
	const exchanges = domain.tree.updateExchangeResponse(result.exchanges, result.id, 'Hi there');
	return { tree: { rootId: result.rootId, exchanges }, exchangeId: result.id };
}

function makeDeps(tree: domain.tree.ChatTree): StreamDeps {
	let currentTree = tree;
	return {
		getTreeByChatId: vi.fn().mockImplementation(() => currentTree),
		replaceTreeByChatId: vi
			.fn()
			.mockImplementation((_chatId: string, nextTree: domain.tree.ChatTree) => {
				currentTree = nextTree;
			}),
		getProviderStream: vi.fn().mockImplementation(async function* () {
			await new Promise((r) => setTimeout(r, 50));
			yield { type: 'delta', delta: 'Hello ' };
			yield { type: 'delta', delta: 'world' };
			yield { type: 'done', promptTokens: 10, responseTokens: 20 };
		})
	};
}

function makeSlowDeps(tree: domain.tree.ChatTree): StreamDeps {
	let currentTree = tree;
	return {
		getTreeByChatId: vi.fn().mockImplementation(() => currentTree),
		replaceTreeByChatId: vi
			.fn()
			.mockImplementation((_chatId: string, nextTree: domain.tree.ChatTree) => {
				currentTree = nextTree;
			}),
		getProviderStream: vi.fn().mockImplementation(async function* (
			_model: unknown,
			_history: unknown,
			signal: AbortSignal
		) {
			yield { type: 'delta', delta: 'chunk' };
			await new Promise<void>((resolve) => {
				if (signal.aborted) return resolve();
				signal.addEventListener('abort', () => resolve());
				setTimeout(resolve, 5000);
			});
			yield { type: 'done', promptTokens: 0, responseTokens: 0 };
		})
	};
}

function waitForStreamComplete(
	store: StreamStore,
	exchangeId: string,
	timeout = 2000
): Promise<void> {
	return new Promise((resolve, reject) => {
		const start = Date.now();
		const check = () => {
			if (!isStreaming(store, exchangeId)) {
				resolve();
			} else if (Date.now() - start > timeout) {
				reject(new Error('Timed out waiting for stream to complete'));
			} else {
				setTimeout(check, 10);
			}
		};
		setTimeout(check, 10);
	});
}

describe('streams', () => {
	let store: StreamStore;

	beforeEach(() => {
		store = makeStore();
	});

	describe('isStreaming', () => {
		it('returns false for unknown exchangeId', () => {
			expect(isStreaming(store, 'nonexistent')).toBe(false);
		});

		it('returns true after startStream is called', () => {
			const { tree, exchangeId } = buildTreeWithExchange();
			const deps = makeDeps(tree);

			startStream(store, deps, {
				exchangeId,
				chatId: 'chat-1',
				model: { provider: PROVIDER, modelId: MODEL },
				tree
			});

			expect(isStreaming(store, exchangeId)).toBe(true);
		});
	});

	describe('isAnyStreaming', () => {
		it('returns false when no streams are active', () => {
			expect(isAnyStreaming(store)).toBe(false);
		});

		it('returns true when a stream is active', () => {
			const { tree, exchangeId } = buildTreeWithExchange();
			const deps = makeDeps(tree);

			startStream(store, deps, {
				exchangeId,
				chatId: 'chat-1',
				model: { provider: PROVIDER, modelId: MODEL },
				tree
			});

			expect(isAnyStreaming(store)).toBe(true);
		});
	});

	describe('startStream', () => {
		it('marks the exchange as streaming', () => {
			const { tree, exchangeId } = buildTreeWithExchange();
			const deps = makeDeps(tree);

			startStream(store, deps, {
				exchangeId,
				chatId: 'chat-1',
				model: { provider: PROVIDER, modelId: MODEL },
				tree
			});

			expect(isStreaming(store, exchangeId)).toBe(true);
		});

		it('updates tree with response deltas as they arrive', async () => {
			const { tree, exchangeId } = buildTreeWithExchange();
			const deps = makeDeps(tree);

			startStream(store, deps, {
				exchangeId,
				chatId: 'chat-1',
				model: { provider: PROVIDER, modelId: MODEL },
				tree
			});

			await waitForStreamComplete(store, exchangeId);

			// The deps.getTreeByChatId tracks the current tree via closure
			const finalTree = vi.mocked(deps.getTreeByChatId).mock.results.at(-1)?.value;
			expect(finalTree?.exchanges[exchangeId]?.response?.text).toBe('Hello world');
		});

		it('cleans up after stream completes', async () => {
			const { tree, exchangeId } = buildTreeWithExchange();
			const deps = makeDeps(tree);

			startStream(store, deps, {
				exchangeId,
				chatId: 'chat-1',
				model: { provider: PROVIDER, modelId: MODEL },
				tree
			});

			await waitForStreamComplete(store, exchangeId);

			expect(isStreaming(store, exchangeId)).toBe(false);
		});

		it('updates token counts when stream completes with tokens', async () => {
			const { tree, exchangeId } = buildTreeWithExchange();
			const deps = makeDeps(tree);

			startStream(store, deps, {
				exchangeId,
				chatId: 'chat-1',
				model: { provider: PROVIDER, modelId: MODEL },
				tree
			});

			await waitForStreamComplete(store, exchangeId);

			// The last replaceTreeByChatId call should contain the token update
			const calls = vi.mocked(deps.replaceTreeByChatId).mock.calls;
			const lastTree = calls.at(-1)?.[1] as domain.tree.ChatTree;
			expect(lastTree.exchanges[exchangeId]?.prompt.tokenCount).toBe(10);
			expect(lastTree.exchanges[exchangeId]?.response?.tokenCount).toBe(20);
		});

		it('cleans up when tree no longer exists (chat deleted during stream)', async () => {
			const { tree, exchangeId } = buildTreeWithExchange();
			let callCount = 0;
			const deps: StreamDeps = {
				getTreeByChatId: vi.fn().mockImplementation(() => {
					callCount++;
					return callCount <= 1 ? tree : undefined;
				}),
				replaceTreeByChatId: vi.fn(),
				getProviderStream: vi.fn().mockImplementation(async function* () {
					yield { type: 'delta', delta: 'Hello' };
					yield { type: 'done', promptTokens: 5, responseTokens: 10 };
				})
			};

			startStream(store, deps, {
				exchangeId,
				chatId: 'chat-1',
				model: { provider: PROVIDER, modelId: MODEL },
				tree
			});

			await waitForStreamComplete(store, exchangeId);

			expect(isStreaming(store, exchangeId)).toBe(false);
		});

		it('handles error in stream (writes error to response)', async () => {
			const { tree, exchangeId } = buildTreeWithExchange();
			let currentTree = tree;
			const deps: StreamDeps = {
				getTreeByChatId: vi.fn().mockImplementation(() => currentTree),
				replaceTreeByChatId: vi
					.fn()
					.mockImplementation((_chatId: string, nextTree: domain.tree.ChatTree) => {
						currentTree = nextTree;
					}),
				getProviderStream: vi.fn().mockImplementation(
					// eslint-disable-next-line require-yield
					async function* () {
						throw new Error('API error');
					}
				)
			};

			startStream(store, deps, {
				exchangeId,
				chatId: 'chat-1',
				model: { provider: PROVIDER, modelId: MODEL },
				tree
			});

			await waitForStreamComplete(store, exchangeId);

			expect(isStreaming(store, exchangeId)).toBe(false);
			expect(currentTree.exchanges[exchangeId]?.response?.text).toContain('API error');
		});

		it('cleans up without crashing when the tree disappears before token persistence', async () => {
			const { tree, exchangeId } = buildTreeWithExchange();
			let currentTree: domain.tree.ChatTree | undefined = tree;
			let readCount = 0;
			const deps: StreamDeps = {
				getTreeByChatId: vi.fn().mockImplementation(() => {
					readCount++;
					if (readCount >= 3) {
						currentTree = undefined;
					}
					return currentTree;
				}),
				replaceTreeByChatId: vi
					.fn()
					.mockImplementation((_chatId: string, nextTree: domain.tree.ChatTree) => {
						currentTree = nextTree;
					}),
				getProviderStream: vi.fn().mockImplementation(async function* () {
					yield { type: 'delta', delta: 'Hello' };
					yield { type: 'done', promptTokens: 5, responseTokens: 10 };
				})
			};

			startStream(store, deps, {
				exchangeId,
				chatId: 'chat-1',
				model: { provider: PROVIDER, modelId: MODEL },
				tree
			});

			await waitForStreamComplete(store, exchangeId);

			expect(isStreaming(store, exchangeId)).toBe(false);
		});

		it('cleans up without crashing when the tree disappears before error persistence', async () => {
			const { tree, exchangeId } = buildTreeWithExchange();
			let currentTree: domain.tree.ChatTree | undefined = tree;
			let readCount = 0;
			const deps: StreamDeps = {
				getTreeByChatId: vi.fn().mockImplementation(() => {
					readCount++;
					if (readCount >= 2) {
						currentTree = undefined;
					}
					return currentTree;
				}),
				replaceTreeByChatId: vi
					.fn()
					.mockImplementation((_chatId: string, nextTree: domain.tree.ChatTree) => {
						currentTree = nextTree;
					}),
				// eslint-disable-next-line require-yield
				getProviderStream: vi.fn().mockImplementation(async function* () {
					throw new Error('API error');
				})
			};

			startStream(store, deps, {
				exchangeId,
				chatId: 'chat-1',
				model: { provider: PROVIDER, modelId: MODEL },
				tree
			});

			await waitForStreamComplete(store, exchangeId);

			expect(isStreaming(store, exchangeId)).toBe(false);
		});
	});

	describe('cancelStream', () => {
		it('sends CANCEL to the actor and cleans up', async () => {
			const { tree, exchangeId } = buildTreeWithExchange();
			const deps = makeSlowDeps(tree);

			startStream(store, deps, {
				exchangeId,
				chatId: 'chat-1',
				model: { provider: PROVIDER, modelId: MODEL },
				tree
			});

			expect(isStreaming(store, exchangeId)).toBe(true);

			cancelStream(store, exchangeId);

			await waitForStreamComplete(store, exchangeId);

			expect(isStreaming(store, exchangeId)).toBe(false);
		});

		it('no-ops for unknown exchangeId', () => {
			expect(() => cancelStream(store, 'nonexistent')).not.toThrow();
		});
	});

	describe('cancelAllStreams', () => {
		it('cancels all active streams', async () => {
			const { tree, exchangeId } = buildTreeWithExchange();
			const deps = makeSlowDeps(tree);

			startStream(store, deps, {
				exchangeId,
				chatId: 'chat-1',
				model: { provider: PROVIDER, modelId: MODEL },
				tree
			});

			expect(isAnyStreaming(store)).toBe(true);

			cancelAllStreams(store);

			await waitForStreamComplete(store, exchangeId);

			expect(isAnyStreaming(store)).toBe(false);
		});
	});

	describe('cancelStreamsForExchanges', () => {
		it('cancels streams for specified exchange IDs', async () => {
			const { tree, exchangeId } = buildTreeWithExchange();
			const deps = makeSlowDeps(tree);

			startStream(store, deps, {
				exchangeId,
				chatId: 'chat-1',
				model: { provider: PROVIDER, modelId: MODEL },
				tree
			});

			expect(isStreaming(store, exchangeId)).toBe(true);

			cancelStreamsForExchanges(store, [exchangeId]);

			await waitForStreamComplete(store, exchangeId);

			expect(isStreaming(store, exchangeId)).toBe(false);
		});

		it('ignores exchange IDs that are not streaming', () => {
			expect(() =>
				cancelStreamsForExchanges(store, ['nonexistent-1', 'nonexistent-2'])
			).not.toThrow();
		});
	});

	describe('cancelStreamsForChat', () => {
		it('cancels all streams associated with a chat ID', async () => {
			const { tree, exchangeId } = buildTreeWithExchange();
			const deps = makeSlowDeps(tree);

			startStream(store, deps, {
				exchangeId,
				chatId: 'chat-1',
				model: { provider: PROVIDER, modelId: MODEL },
				tree
			});

			expect(isStreaming(store, exchangeId)).toBe(true);

			cancelStreamsForChat(store, 'chat-1');

			await waitForStreamComplete(store, exchangeId);

			expect(isStreaming(store, exchangeId)).toBe(false);
		});

		it('does not cancel streams for other chat IDs', async () => {
			const { tree, exchangeId } = buildTreeWithExchange();
			const deps = makeSlowDeps(tree);

			startStream(store, deps, {
				exchangeId,
				chatId: 'chat-1',
				model: { provider: PROVIDER, modelId: MODEL },
				tree
			});

			cancelStreamsForChat(store, 'chat-2');

			expect(isStreaming(store, exchangeId)).toBe(true);

			// Clean up
			cancelStream(store, exchangeId);
			await waitForStreamComplete(store, exchangeId);
		});

		it('no-ops for unknown chat ID', () => {
			expect(() => cancelStreamsForChat(store, 'nonexistent')).not.toThrow();
		});
	});
});
