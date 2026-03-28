import { describe, expect, it, vi } from 'vitest';

vi.mock('@/state/chats.svelte', () => ({
	replaceActiveTree: vi.fn(),
	setActiveExchangeId: vi.fn(),
	copyToNewChat: vi.fn(),
	getTreeByChatId: vi.fn(),
	replaceTreeByChatId: vi.fn()
}));

vi.mock('@/state/services/streams', () => ({
	isStreaming: vi.fn(() => false),
	cancelStreamsForExchanges: vi.fn(),
	startStream: vi.fn(),
	cancelStream: vi.fn(),
	cancelAllStreams: vi.fn(),
	cancelStreamsForChat: vi.fn(),
	isAnyStreaming: vi.fn(() => false)
}));

import {
	getExchangeNodeData,
	performDelete,
	performPromote,
	performCopy,
	getDeleteMode,
	performQuickAsk,
	performSubmitPrompt,
	type ChatActionDeps
} from './chat-actions';

import {
	addExchangeResult,
	buildEmptyTree,
	updateExchangeResponse,
	type ChatTree
} from '@/domain/tree';

/** Convenience: update response on a ChatTree, returning a new ChatTree */
function setResponse(tree: ChatTree, exchangeId: string, text: string): ChatTree {
	return { ...tree, exchanges: updateExchangeResponse(tree.exchanges, exchangeId, text) };
}
import type { Provider } from '@/domain/models';

// ── Constants & helpers ──────────────────────────────────────────────────────

const PROVIDER: Provider = 'claude';
const MODEL = 'claude-sonnet-4-6';

function mockDeps(overrides?: Partial<ChatActionDeps>): ChatActionDeps {
	return {
		replaceActiveTree: vi.fn(),
		setActiveExchangeId: vi.fn(),
		copyToNewChat: vi.fn(),
		isStreaming: vi.fn(() => false),
		cancelStreamsForExchanges: vi.fn(),
		...overrides
	};
}

function mockCallbacks() {
	return {
		onMeasure: vi.fn(),
		onSelect: vi.fn(),
		onCopy: vi.fn(),
		onToggleSideChildren: vi.fn(),
		onPromote: vi.fn(),
		onDelete: vi.fn(),
		onQuickAsk: vi.fn()
	};
}

/** root → child → leaf (linear chain) */
function buildLinearTree(): { tree: ChatTree; rootId: string; childId: string; leafId: string } {
	let tree = buildEmptyTree();
	const root = addExchangeResult(tree, 'ignored', 'root prompt', MODEL, PROVIDER);
	tree = root;
	tree = setResponse(tree, root.id, 'root response');
	const child = addExchangeResult(tree, root.id, 'child prompt', MODEL, PROVIDER);
	tree = child;
	tree = setResponse(tree, child.id, 'child response');
	const leaf = addExchangeResult(tree, child.id, 'leaf prompt', MODEL, PROVIDER);
	return { tree: leaf, rootId: root.id, childId: child.id, leafId: leaf.id };
}

/** root → main + side (side branch off root) */
function buildTreeWithSideChat(): {
	tree: ChatTree;
	rootId: string;
	mainId: string;
	sideId: string;
} {
	let tree = buildEmptyTree();
	const root = addExchangeResult(tree, 'ignored', 'root prompt', MODEL, PROVIDER);
	tree = root;
	tree = setResponse(tree, root.id, 'root response');
	const main = addExchangeResult(tree, root.id, 'main prompt', MODEL, PROVIDER);
	tree = main;
	const side = addExchangeResult(tree, root.id, 'side prompt', MODEL, PROVIDER);
	return { tree: side, rootId: root.id, mainId: main.id, sideId: side.id };
}

/** root → main + side → side-child */
function buildTreeWithSideDescendant(): {
	tree: ChatTree;
	rootId: string;
	sideId: string;
	sideChildId: string;
} {
	let tree = buildEmptyTree();
	const root = addExchangeResult(tree, 'ignored', 'root prompt', MODEL, PROVIDER);
	tree = root;
	tree = setResponse(tree, root.id, 'root response');
	const main = addExchangeResult(tree, root.id, 'main prompt', MODEL, PROVIDER);
	tree = main;
	const side = addExchangeResult(tree, root.id, 'side prompt', MODEL, PROVIDER);
	tree = side;
	const sideChild = addExchangeResult(tree, side.id, 'side child prompt', MODEL, PROVIDER);
	return { tree: sideChild, rootId: root.id, sideId: side.id, sideChildId: sideChild.id };
}

// ── getExchangeNodeData ──────────────────────────────────────────────────────

describe('getExchangeNodeData', () => {
	it('returns data for root exchange (parentId === null)', () => {
		const { tree, rootId } = buildLinearTree();
		const result = getExchangeNodeData(rootId, tree.exchanges, null, mockCallbacks(), mockDeps());
		expect(result).not.toBeNull();
		expect(result!.prompt).toBe('root prompt');
		expect(result!.response).toBe('root response');
	});

	it('returns null for nonexistent exchange', () => {
		const { tree } = buildLinearTree();
		const result = getExchangeNodeData(
			'nonexistent',
			tree.exchanges,
			null,
			mockCallbacks(),
			mockDeps()
		);
		expect(result).toBeNull();
	});

	it('correctly computes hasSideChildren and sideChildrenCount', () => {
		const { tree, mainId } = buildTreeWithSideChat();
		// mainId has 0 children
		const result = getExchangeNodeData(mainId, tree.exchanges, null, mockCallbacks(), mockDeps());
		expect(result).not.toBeNull();
		expect(result!.hasSideChildren).toBe(false);
		expect(result!.sideChildrenCount).toBe(0);
	});

	it('root exchange shows hasSideChildren when it has side children', () => {
		const { tree, rootId } = buildTreeWithSideChat();
		const result = getExchangeNodeData(rootId, tree.exchanges, null, mockCallbacks(), mockDeps());
		expect(result).not.toBeNull();
		expect(result!.hasSideChildren).toBe(true);
		expect(result!.sideChildrenCount).toBe(1);
	});

	it('hasSideChildren is true when a node has side children', () => {
		// Build: root → child, child has a response, then child → grandchild1 + grandchild2
		let tree = buildEmptyTree();
		const root = addExchangeResult(tree, 'ignored', 'root prompt', MODEL, PROVIDER);
		tree = root;
		tree = setResponse(tree, root.id, 'root resp');
		const child = addExchangeResult(tree, root.id, 'child prompt', MODEL, PROVIDER);
		tree = child;
		tree = setResponse(tree, child.id, 'child resp');
		const gc1 = addExchangeResult(tree, child.id, 'gc1 prompt', MODEL, PROVIDER);
		tree = gc1;
		const gc2 = addExchangeResult(tree, child.id, 'gc2 prompt', MODEL, PROVIDER);
		tree = gc2;

		const result = getExchangeNodeData(child.id, tree.exchanges, null, mockCallbacks(), mockDeps());
		expect(result).not.toBeNull();
		expect(result!.hasSideChildren).toBe(true);
		expect(result!.sideChildrenCount).toBe(1);
	});

	it('correctly identifies isSideRoot', () => {
		const { tree, sideId } = buildTreeWithSideChat();
		const result = getExchangeNodeData(sideId, tree.exchanges, null, mockCallbacks(), mockDeps());
		expect(result).not.toBeNull();
		expect(result!.isSideRoot).toBe(true);
	});

	it('root exchange is not isSideRoot', () => {
		const { tree, rootId } = buildLinearTree();
		const result = getExchangeNodeData(rootId, tree.exchanges, null, mockCallbacks(), mockDeps());
		expect(result).not.toBeNull();
		expect(result!.isSideRoot).toBe(false);
	});

	it('main child is not isSideRoot', () => {
		const { tree, mainId } = buildTreeWithSideChat();
		const result = getExchangeNodeData(mainId, tree.exchanges, null, mockCallbacks(), mockDeps());
		expect(result).not.toBeNull();
		expect(result!.isSideRoot).toBe(false);
	});

	it('canPromote reflects domain logic', () => {
		const { tree, sideId, mainId } = buildTreeWithSideChat();
		const sideResult = getExchangeNodeData(
			sideId,
			tree.exchanges,
			null,
			mockCallbacks(),
			mockDeps()
		);
		expect(sideResult!.canPromote).toBe(true);

		const mainResult = getExchangeNodeData(
			mainId,
			tree.exchanges,
			null,
			mockCallbacks(),
			mockDeps()
		);
		expect(mainResult!.canPromote).toBe(false);
	});

	it('canQuickAsk is false for side exchanges that already have a child', () => {
		const { tree, sideId } = buildTreeWithSideDescendant();
		const result = getExchangeNodeData(sideId, tree.exchanges, null, mockCallbacks(), mockDeps());
		expect(result!.canQuickAsk).toBe(false);
	});

	it('canQuickAsk is true for a side-branch leaf', () => {
		const { tree, sideChildId } = buildTreeWithSideDescendant();
		const result = getExchangeNodeData(
			sideChildId,
			tree.exchanges,
			null,
			mockCallbacks(),
			mockDeps()
		);
		expect(result!.canQuickAsk).toBe(true);
	});

	it('isStreaming reflects service state', () => {
		const { tree, childId } = buildLinearTree();
		const deps = mockDeps({ isStreaming: vi.fn(() => true) });
		const result = getExchangeNodeData(childId, tree.exchanges, null, mockCallbacks(), deps);
		expect(result!.isStreaming).toBe(true);
		expect(deps.isStreaming).toHaveBeenCalledWith(childId);
	});

	it('isActive is true when exchangeId matches activeExchangeId', () => {
		const { tree, childId } = buildLinearTree();
		const result = getExchangeNodeData(
			childId,
			tree.exchanges,
			childId,
			mockCallbacks(),
			mockDeps()
		);
		expect(result!.isActive).toBe(true);
	});

	it('isActive is false when exchangeId does not match activeExchangeId', () => {
		const { tree, childId } = buildLinearTree();
		const result = getExchangeNodeData(
			childId,
			tree.exchanges,
			'other-id',
			mockCallbacks(),
			mockDeps()
		);
		expect(result!.isActive).toBe(false);
	});

	it('callbacks are wired correctly', () => {
		const { tree, childId } = buildLinearTree();
		const cbs = mockCallbacks();
		const result = getExchangeNodeData(childId, tree.exchanges, null, cbs, mockDeps());
		expect(result).not.toBeNull();

		result!.onSelect();
		expect(cbs.onSelect).toHaveBeenCalledWith(childId);

		result!.onCopy();
		expect(cbs.onCopy).toHaveBeenCalledWith(childId);

		result!.onToggleSideChildren();
		expect(cbs.onToggleSideChildren).toHaveBeenCalledWith(childId);

		result!.onPromote();
		expect(cbs.onPromote).toHaveBeenCalledWith(childId);

		result!.onDelete();
		expect(cbs.onDelete).toHaveBeenCalledWith(childId);

		result!.onMeasure(100);
		expect(cbs.onMeasure).toHaveBeenCalledWith(childId, 100);
	});

	it('returns prompt and response text', () => {
		const { tree, childId } = buildLinearTree();
		const result = getExchangeNodeData(childId, tree.exchanges, null, mockCallbacks(), mockDeps());
		expect(result!.prompt).toBe('child prompt');
		expect(result!.response).toBe('child response');
	});

	it('returns empty string when response is null', () => {
		const { tree, leafId } = buildLinearTree();
		// leaf has no response set
		const result = getExchangeNodeData(leafId, tree.exchanges, null, mockCallbacks(), mockDeps());
		expect(result!.response).toBe('');
	});

	it('canCreateSideChat is false for a leaf exchange with no children', () => {
		const { tree, leafId } = buildLinearTree();
		const result = getExchangeNodeData(leafId, tree.exchanges, null, mockCallbacks(), mockDeps());
		expect(result!.canCreateSideChat).toBe(false);
	});

	it('canCreateSideChat is true for an exchange with at least one child', () => {
		const { tree, childId } = buildLinearTree();
		const result = getExchangeNodeData(childId, tree.exchanges, null, mockCallbacks(), mockDeps());
		expect(result!.canCreateSideChat).toBe(true);
	});

	it('canCreateSideChat is false for a side root (even with children)', () => {
		let t = buildEmptyTree();
		const root = addExchangeResult(t, 'ignored', 'root', MODEL, PROVIDER);
		t = setResponse(root, root.id, 'resp');
		const main = addExchangeResult(t, root.id, 'main', MODEL, PROVIDER);
		t = main;
		const side = addExchangeResult(t, root.id, 'side', MODEL, PROVIDER);
		t = side;
		t = setResponse(t, side.id, 'side resp');
		const sideChild = addExchangeResult(t, side.id, 'side child', MODEL, PROVIDER);
		t = sideChild;

		const result = getExchangeNodeData(side.id, t.exchanges, null, mockCallbacks(), mockDeps());
		expect(result!.canCreateSideChat).toBe(false);
	});
});

// ── performDelete ────────────────────────────────────────────────────────────

describe('performDelete', () => {
	it('deletes exchange, cancels streams, replaces tree, returns no error', () => {
		const { tree, leafId, childId } = buildLinearTree();
		const deps = mockDeps();
		const result = performDelete(tree.exchanges, leafId, 'exchange', childId, undefined, deps);
		expect(result.error).toBeNull();
		expect(deps.cancelStreamsForExchanges).toHaveBeenCalledWith([leafId]);
		expect(deps.replaceActiveTree).toHaveBeenCalled();
	});

	it('redirects activeExchangeId to main chat tail when deleting active exchange', () => {
		const { tree, leafId } = buildLinearTree();
		const deps = mockDeps();
		performDelete(tree.exchanges, leafId, 'exchange', leafId, undefined, deps);
		expect(deps.setActiveExchangeId).toHaveBeenCalled();
	});

	it('does not redirect activeExchangeId when deleting non-active exchange', () => {
		const { tree, leafId, childId } = buildLinearTree();
		const deps = mockDeps();
		performDelete(tree.exchanges, leafId, 'exchange', childId, undefined, deps);
		// childId still exists in the tree after deleting leafId, so no redirect
		expect(deps.setActiveExchangeId).not.toHaveBeenCalled();
	});

	it('calls onResetMeasuredHeights when provided', () => {
		const { tree, leafId } = buildLinearTree();
		const onReset = vi.fn();
		performDelete(tree.exchanges, leafId, 'exchange', null, onReset, mockDeps());
		expect(onReset).toHaveBeenCalled();
	});

	it('returns error when domain throws', () => {
		const { tree } = buildLinearTree();
		const result = performDelete(
			tree.exchanges,
			'nonexistent',
			'exchange',
			null,
			undefined,
			mockDeps()
		);
		expect(result.error).toBeTypeOf('string');
	});
});

// ── performPromote ───────────────────────────────────────────────────────────

describe('performPromote', () => {
	it('promotes side chat, updates state, returns no error', () => {
		const { tree, sideId } = buildTreeWithSideChat();
		const deps = mockDeps();
		const result = performPromote(tree.exchanges, sideId, undefined, deps);
		expect(result.error).toBeNull();
		expect(deps.setActiveExchangeId).toHaveBeenCalledWith(sideId);
		expect(deps.replaceActiveTree).toHaveBeenCalled();
	});

	it('calls onResetMeasuredHeights when provided', () => {
		const { tree, sideId } = buildTreeWithSideChat();
		const onReset = vi.fn();
		performPromote(tree.exchanges, sideId, onReset, mockDeps());
		expect(onReset).toHaveBeenCalled();
	});

	it('returns error and does not mutate state when domain throws (non-side-root)', () => {
		const { tree, mainId } = buildTreeWithSideChat();
		const deps = mockDeps();
		const result = performPromote(tree.exchanges, mainId, undefined, deps);
		expect(result.error).toBeTypeOf('string');
		expect(result.error!.length).toBeGreaterThan(0);
		expect(deps.setActiveExchangeId).not.toHaveBeenCalled();
		expect(deps.replaceActiveTree).not.toHaveBeenCalled();
	});

	it('returns error and does not mutate state for nonexistent exchange', () => {
		const { tree } = buildTreeWithSideChat();
		const deps = mockDeps();
		const result = performPromote(tree.exchanges, 'nonexistent', undefined, deps);
		expect(result.error).toBeTypeOf('string');
		expect(deps.setActiveExchangeId).not.toHaveBeenCalled();
		expect(deps.replaceActiveTree).not.toHaveBeenCalled();
	});
});

// ── performCopy ──────────────────────────────────────────────────────────────

describe('performCopy', () => {
	it('delegates to deps.copyToNewChat', () => {
		const deps = mockDeps();
		performCopy('exchange-123', deps);
		expect(deps.copyToNewChat).toHaveBeenCalledWith('exchange-123');
	});
});

// ── performSubmitPrompt ──────────────────────────────────────────────────────

describe('performSubmitPrompt', () => {
	const activeModel = { modelId: MODEL, provider: PROVIDER, label: MODEL };

	it('returns parentId so caller can expand the correct side chat parent', () => {
		const { tree, childId } = buildLinearTree();
		const deps = mockDeps();
		const result = performSubmitPrompt(
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
		const result = performSubmitPrompt(
			'chat-1',
			tree,
			null,
			'new prompt',
			activeModel,
			undefined,
			deps
		);
		expect(result.parentId).toBe(leafId);
	});
});

describe('performQuickAsk', () => {
	const activeModel = { modelId: MODEL, provider: PROVIDER, label: MODEL };

	it('wraps the source text in the quick ask prompt template', () => {
		const { tree, childId } = buildLinearTree();
		const deps = mockDeps();

		performQuickAsk('chat-1', tree, childId, 'Selected paragraph', activeModel, deps);

		expect(deps.replaceActiveTree).toHaveBeenCalledOnce();
		const createdTree = vi.mocked(deps.replaceActiveTree).mock.calls[0]![0];
		const createdExchangeId = vi.mocked(deps.setActiveExchangeId).mock.calls[0]![0] as string;
		expect(createdTree.exchanges[createdExchangeId]?.prompt.text).toBe(
			'Can you explain more:\n\nSelected paragraph'
		);
	});
});

// ── getDeleteMode ────────────────────────────────────────────────────────────

describe('getDeleteMode', () => {
	it('returns exchangeAndSideChats when node has multiple children', () => {
		const { tree, rootId } = buildTreeWithSideChat();
		const mode = getDeleteMode(tree.exchanges, rootId);
		expect(mode).toBe('exchangeAndSideChats');
	});

	it('returns exchange when node has 0 children', () => {
		const { tree, mainId } = buildTreeWithSideChat();
		const mode = getDeleteMode(tree.exchanges, mainId);
		expect(mode).toBe('exchange');
	});

	it('returns exchange when node has 1 child', () => {
		const { tree, childId } = buildLinearTree();
		const mode = getDeleteMode(tree.exchanges, childId);
		expect(mode).toBe('exchange');
	});
});
