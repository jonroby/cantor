import * as chat from './index';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/state', async () => {
	const { createStateMock } = await import('@/tests/mocks/state');
	return createStateMock({
		chats: {
			addChat: vi.fn(),
			getActiveChat: vi.fn(),
			replaceActiveTree: vi.fn(),
			setActiveExchangeId: vi.fn(),
			getTreeByChatId: vi.fn(),
			replaceTreeByChatId: vi.fn()
		}
	});
});

vi.mock('@/external', async () => {
	const { createExternalMock } = await import('@/tests/mocks/external');
	return createExternalMock({
		streams: {
			isStreaming: vi.fn(() => false),
			cancelStreamsForExchanges: vi.fn(),
			startStream: vi.fn(),
			cancelStream: vi.fn(),
			cancelAllStreams: vi.fn(),
			cancelStreamsForChat: vi.fn(),
			isAnyStreaming: vi.fn(() => false)
		}
	});
});

import {
	deleteExchange,
	promoteExchange,
	copyChat,
	quickAsk,
	submitPrompt,
	addDocumentToChat,
	type ChatActionDeps
} from './index';

import * as domain from '@/domain';

/** Convenience: update response on a ChatTree, returning a new ChatTree */
function setResponse(
	tree: domain.tree.ChatTree,
	exchangeId: string,
	text: string
): domain.tree.ChatTree {
	return {
		...tree,
		exchanges: domain.tree.updateExchangeResponse(tree.exchanges, exchangeId, text)
	};
}

// ── Constants & helpers ──────────────────────────────────────────────────────

const PROVIDER: domain.models.Provider = 'claude';
const MODEL = 'claude-sonnet-4-6';

function mockDeps(overrides?: Partial<ChatActionDeps>): ChatActionDeps {
	return {
		addChat: vi.fn(() => 0),
		getActiveChat: vi.fn(() => ({
			id: 'chat-1',
			name: 'Chat 1',
			rootId: null,
			exchanges: {},
			activeExchangeId: null
		})),
		replaceActiveTree: vi.fn(),
		setActiveExchangeId: vi.fn(),
		isStreaming: vi.fn(() => false),
		cancelStreamsForExchanges: vi.fn(),
		...overrides
	};
}

/** root → child → leaf (linear chain) */
function buildLinearTree(): {
	tree: domain.tree.ChatTree;
	rootId: string;
	childId: string;
	leafId: string;
} {
	let tree = domain.tree.buildEmptyTree();
	const root = domain.tree.addExchange(tree, 'ignored', 'root prompt', MODEL, PROVIDER);
	tree = root.tree;
	tree = setResponse(tree, root.id, 'root response');
	const child = domain.tree.addExchange(tree, root.id, 'child prompt', MODEL, PROVIDER);
	tree = child.tree;
	tree = setResponse(tree, child.id, 'child response');
	const leaf = domain.tree.addExchange(tree, child.id, 'leaf prompt', MODEL, PROVIDER);
	return { tree: leaf.tree, rootId: root.id, childId: child.id, leafId: leaf.id };
}

/** root → main + side chat */
function buildTreeWithSideChat(): {
	tree: domain.tree.ChatTree;
	rootId: string;
	mainId: string;
	sideId: string;
} {
	let tree = domain.tree.buildEmptyTree();
	const root = domain.tree.addExchange(tree, 'ignored', 'root prompt', MODEL, PROVIDER);
	tree = root.tree;
	tree = setResponse(tree, root.id, 'root response');
	const main = domain.tree.addExchange(tree, root.id, 'main prompt', MODEL, PROVIDER);
	tree = main.tree;
	const side = domain.tree.addExchange(tree, root.id, 'side prompt', MODEL, PROVIDER);
	return { tree: side.tree, rootId: root.id, mainId: main.id, sideId: side.id };
}

describe('addDocumentToChat', () => {
	it('adds a labeled document exchange and activates it', () => {
		const { tree, leafId } = buildLinearTree();
		const deps = mockDeps();

		const addedId = addDocumentToChat(tree, leafId, '# Notes', 'notes.md', deps);
		const nextTree = vi.mocked(deps.replaceActiveTree).mock.calls[0]?.[0];

		expect(addedId).toBeTruthy();
		expect(deps.replaceActiveTree).toHaveBeenCalledOnce();
		expect(deps.setActiveExchangeId).toHaveBeenCalledWith(addedId);
		expect(nextTree?.exchanges[addedId]?.prompt.text).toBe('# Notes');
		expect(nextTree?.exchanges[addedId]?.label).toBe('notes.md was added to chat');
	});
});

describe('public API', () => {
	it('exposes the expected public API', () => {
		expect(Object.keys(chat).sort()).toEqual([
			'addDocumentToChat',
			'canSubmitPrompt',
			'copyChat',
			'createChat',
			'deleteExchange',
			'exportChat',
			'exportState',
			'getActiveChatIndex',
			'getActiveExchangeId',
			'getChat',
			'getChats',
			'getMainChat',
			'getSideChats',
			'getUsedTokens',
			'importChat',
			'isStreaming',
			'promoteExchange',
			'quickAsk',
			'removeChat',
			'renameChat',
			'selectChat',
			'selectExchange',
			'stopChatStreams',
			'stopStream',
			'submitPrompt'
		]);
	});
});

// ── deleteExchange ───────────────────────────────────────────────────────────

describe('deleteExchange', () => {
	it('deletes exchange, cancels streams, replaces tree, returns no error', () => {
		const { tree, leafId, childId } = buildLinearTree();
		const deps = mockDeps();
		const result = deleteExchange(tree, leafId, 'exchange', childId, undefined, deps);
		expect(result.error).toBeNull();
		expect(deps.cancelStreamsForExchanges).toHaveBeenCalledWith([leafId]);
		expect(deps.replaceActiveTree).toHaveBeenCalled();
	});

	it('redirects activeExchangeId to main chat tail when deleting active exchange', () => {
		const { tree, leafId } = buildLinearTree();
		const deps = mockDeps();
		deleteExchange(tree, leafId, 'exchange', leafId, undefined, deps);
		expect(deps.setActiveExchangeId).toHaveBeenCalled();
	});

	it('does not redirect activeExchangeId when deleting non-active exchange', () => {
		const { tree, leafId, childId } = buildLinearTree();
		const deps = mockDeps();
		deleteExchange(tree, leafId, 'exchange', childId, undefined, deps);
		// childId still exists in the tree after deleting leafId, so no redirect
		expect(deps.setActiveExchangeId).not.toHaveBeenCalled();
	});

	it('calls onResetMeasuredHeights when provided', () => {
		const { tree, leafId } = buildLinearTree();
		const onReset = vi.fn();
		deleteExchange(tree, leafId, 'exchange', null, onReset, mockDeps());
		expect(onReset).toHaveBeenCalled();
	});

	it('returns error when domain throws', () => {
		const { tree } = buildLinearTree();
		const result = deleteExchange(tree, 'nonexistent', 'exchange', null, undefined, mockDeps());
		expect(result.error).toBeTypeOf('string');
	});
});

// ── promoteExchange ──────────────────────────────────────────────────────────

describe('promoteExchange', () => {
	it('promotes side chat, updates state, returns no error', () => {
		const { tree, sideId } = buildTreeWithSideChat();
		const deps = mockDeps();
		const result = promoteExchange(tree, sideId, undefined, deps);
		expect(result.error).toBeNull();
		expect(deps.setActiveExchangeId).toHaveBeenCalledWith(sideId);
		expect(deps.replaceActiveTree).toHaveBeenCalled();
	});

	it('calls onResetMeasuredHeights when provided', () => {
		const { tree, sideId } = buildTreeWithSideChat();
		const onReset = vi.fn();
		promoteExchange(tree, sideId, onReset, mockDeps());
		expect(onReset).toHaveBeenCalled();
	});

	it('returns error and does not mutate state when domain throws (non-side-root)', () => {
		const { tree, mainId } = buildTreeWithSideChat();
		const deps = mockDeps();
		const result = promoteExchange(tree, mainId, undefined, deps);
		expect(result.error).toBeTypeOf('string');
		expect(result.error!.length).toBeGreaterThan(0);
		expect(deps.setActiveExchangeId).not.toHaveBeenCalled();
		expect(deps.replaceActiveTree).not.toHaveBeenCalled();
	});

	it('returns error and does not mutate state for nonexistent exchange', () => {
		const { tree } = buildTreeWithSideChat();
		const deps = mockDeps();
		const result = promoteExchange(tree, 'nonexistent', undefined, deps);
		expect(result.error).toBeTypeOf('string');
		expect(deps.setActiveExchangeId).not.toHaveBeenCalled();
		expect(deps.replaceActiveTree).not.toHaveBeenCalled();
	});
});

// ── copyChat ────────────────────────────────────────────────────────────────

describe('copyChat', () => {
	it('creates a copied chat from the selected path', () => {
		const { tree, leafId } = buildLinearTree();
		const deps = mockDeps();
		vi.mocked(deps.getActiveChat).mockReturnValue({
			id: 'chat-1',
			name: 'Source',
			rootId: tree.rootId,
			exchanges: tree.exchanges,
			activeExchangeId: leafId
		});

		copyChat(leafId, deps);

		expect(deps.addChat).toHaveBeenCalledOnce();
		const added = vi.mocked(deps.addChat).mock.calls[0]![0];
		expect(added.name).toBe('Copy Path (1)');
		expect(() =>
			domain.tree.validateChatTree({ rootId: added.rootId, exchanges: added.exchanges })
		).not.toThrow();
	});
});

// ── submitPrompt ─────────────────────────────────────────────────────────────

describe('submitPrompt', () => {
	const activeModel = { modelId: MODEL, provider: PROVIDER, label: MODEL };

	it('returns parentId so caller can expand the correct side chat parent', () => {
		const { tree, childId } = buildLinearTree();
		const deps = mockDeps();
		const result = submitPrompt(
			'chat-1',
			tree,
			childId,
			'new prompt',
			activeModel,
			undefined,
			deps
		);
		expect(result.parentId).toBe(childId);
	});

	it('returns parentId as main chat tail when activeExchangeId is null', () => {
		const { tree, leafId } = buildLinearTree();
		const deps = mockDeps();
		const result = submitPrompt('chat-1', tree, null, 'new prompt', activeModel, undefined, deps);
		expect(result.parentId).toBe(leafId);
	});
});

describe('quickAsk', () => {
	const activeModel = { modelId: MODEL, provider: PROVIDER, label: MODEL };

	it('wraps the source text in the quick ask prompt template', () => {
		const { tree, childId } = buildLinearTree();
		const deps = mockDeps();

		quickAsk('chat-1', tree, childId, 'Selected paragraph', activeModel, deps);

		expect(deps.replaceActiveTree).toHaveBeenCalledOnce();
		const createdTree = vi.mocked(deps.replaceActiveTree).mock.calls[0]![0];
		const createdExchangeId = vi.mocked(deps.setActiveExchangeId).mock.calls[0]![0] as string;
		expect(createdTree.exchanges[createdExchangeId]?.prompt.text).toBe(
			'Can you explain more:\n\nSelected paragraph'
		);
	});
});
