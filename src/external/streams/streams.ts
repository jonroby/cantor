import { createActor, type Actor, type SnapshotFrom } from 'xstate';
import { streamMachine, type StreamMachineInput } from './stream.machine';
import * as domain from '@/domain';
import type * as providers from '@/external/providers';

type StreamActor = Actor<typeof streamMachine>;

const CONTENT_THRESHOLD = 200;

function summarizeToolInput(input: Record<string, unknown>): Record<string, unknown> {
	const summarized: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(input)) {
		if (typeof value === 'string' && value.length > CONTENT_THRESHOLD) {
			summarized[key] = `[${value.length} chars]`;
		} else {
			summarized[key] = value;
		}
	}
	return summarized;
}

function truncateToolResult(content: string): string {
	if (content.length <= CONTENT_THRESHOLD) return content;
	return content.slice(0, CONTENT_THRESHOLD) + `… [truncated, ${content.length} chars total]`;
}

function compressOlderToolTurns(messages: unknown[]): void {
	for (const msg of messages) {
		const m = msg as { role: string; content: unknown };
		if (m.role === 'assistant' && Array.isArray(m.content)) {
			for (let i = 0; i < m.content.length; i++) {
				const block = m.content[i] as { type: string; input?: Record<string, unknown> };
				if (block.type === 'tool_use' && block.input) {
					block.input = summarizeToolInput(block.input);
				}
			}
		}
		if (m.role === 'user' && Array.isArray(m.content)) {
			for (let i = 0; i < m.content.length; i++) {
				const block = m.content[i] as { type: string; content?: string };
				if (block.type === 'tool_result' && typeof block.content === 'string') {
					block.content = truncateToolResult(block.content);
				}
			}
		}
	}
}

export interface StreamStore {
	streamingIds: Set<string>;
	actors: Map<string, StreamActor>;
	actorChatIds: Map<string, string>;
}

export interface ToolExecutor {
	execute: (toolCalls: providers.stream.ToolUseBlock[]) => {
		results: Array<{ tool_use_id: string; content: string }>;
		summary: string[];
	};
}

export interface StreamCallbacks {
	onDelta?: (exchangeId: string, fullText: string) => void;
	onToolNote?: (exchangeId: string, text: string) => void;
	onComplete?: (exchangeId: string, responseText: string) => void;
	onError?: (exchangeId: string, message: string) => void;
}

export interface StreamDeps {
	getTreeByChatId: (chatId: string) => domain.tree.ChatTree | undefined;
	replaceTreeByChatId: (chatId: string, tree: domain.tree.ChatTree) => void;
	getProviderStream: (
		model: domain.models.ActiveModel,
		history: domain.tree.Message[],
		signal: AbortSignal,
		tools?: providers.stream.ToolDefinition[],
		system?: string
	) => AsyncGenerator<providers.stream.StreamChunk>;
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
		history: domain.tree.Message[];
		tools?: providers.stream.ToolDefinition[];
		system?: string;
		toolExecutor?: ToolExecutor;
		callbacks?: StreamCallbacks;
	}
): void {
	const { exchangeId, chatId, model, history, tools, system, toolExecutor, callbacks } = params;

	const input: StreamMachineInput = {
		exchangeId,
		model,
		history,
		getStream: deps.getProviderStream,
		tools,
		system
	};

	const actor = createActor(streamMachine, { input });

	store.actors.set(exchangeId, actor);
	store.actorChatIds.set(exchangeId, chatId);
	store.streamingIds.add(exchangeId);

	let lastResponse = '';
	// Track raw messages for multi-turn tool use
	const rawMessages: unknown[] = history.map((m) => ({ role: m.role, content: m.content }));

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
			callbacks?.onDelta?.(exchangeId, context.response);
		}

		// Handle tool use — execute tools and send results back
		if (snapshot.value === 'awaiting_tools' && toolExecutor && context.toolCalls.length > 0) {
			if (lastResponse.trim()) {
				callbacks?.onToolNote?.(exchangeId, lastResponse.trim());
			}
			const { results } = toolExecutor.execute(context.toolCalls);

			// Compress older tool turns before appending the new one
			compressOlderToolTurns(rawMessages);

			// Build structured assistant message
			const assistantContent: unknown[] = [];
			if (lastResponse) {
				assistantContent.push({ type: 'text', text: lastResponse });
			}
			for (const tc of context.toolCalls) {
				assistantContent.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input });
			}
			rawMessages.push({ role: 'assistant', content: assistantContent });
			rawMessages.push({
				role: 'user',
				content: results.map((r) => ({ type: 'tool_result', ...r }))
			});

			// Reset for next turn — previous commentary is already captured via onToolNote
			lastResponse = '';

			// Send tool results back to continue streaming
			actor.send({ type: 'TOOL_RESULT', messages: rawMessages });
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
				callbacks?.onError?.(exchangeId, context.error);
			} else {
				callbacks?.onComplete?.(exchangeId, context.response);
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
