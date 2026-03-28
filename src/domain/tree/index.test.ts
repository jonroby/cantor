import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	addExchange,
	addExchangeResult,
	buildEmptyTree,
	canAcceptNewChat,
	canCreateSideChats,
	canPromoteSideChatToMainChat,
	ChatTreeOperationError,
	deleteExchangeWithMode,
	deleteExchangeWithModeResult,
	findSideChatParent,
	copyPath,
	getChildExchanges,
	getDescendantExchanges,
	getHistory,
	getMainChatTail,
	getPathTokenTotal,
	getRootExchange,
	promoteSideChatToMainChat,
	removeExchange,
	removeExchangeSubtree,
	removeMainChatChild,
	removeSideChatChildren,
	updateExchangeResponse,
	updateExchangeTokens,
	validateChatTree,
	type ChatTree,
	type Exchange
} from './index';
import type { Provider } from '@/domain/models';

// ── Test helpers ────────────────────────────────────────────────────────────

const PROVIDER: Provider = 'claude';
const MODEL = 'claude-sonnet-4-6';

function exchange(overrides: Partial<Exchange> & Pick<Exchange, 'id'>): Exchange {
	return {
		parentId: overrides.parentId ?? null,
		childIds: overrides.childIds ?? [],
		prompt: overrides.prompt ?? { text: '', tokenCount: 0 },
		response: overrides.response ?? null,
		model: overrides.model ?? MODEL,
		provider: overrides.provider ?? PROVIDER,
		createdAt: overrides.createdAt ?? 1,
		...overrides
	};
}

function childIds(tree: ChatTree, exchangeId: string): string[] {
	return getChildExchanges(tree.exchanges, exchangeId).map((child) => child.id);
}

function buildLinearTree(): { tree: ChatTree; rootId: string; childId: string; leafId: string } {
	let tree = buildEmptyTree();
	const root = addExchangeResult(tree, 'ignored', 'root prompt', MODEL, PROVIDER);
	tree = root;
	const child = addExchangeResult(tree, root.id, 'child prompt', MODEL, PROVIDER);
	tree = child;
	const leaf = addExchangeResult(tree, child.id, 'leaf prompt', MODEL, PROVIDER);
	return { tree: leaf, rootId: root.id, childId: child.id, leafId: leaf.id };
}

function buildRootWithSideChat(): {
	tree: ChatTree;
	rootId: string;
	mainId: string;
	sideId: string;
} {
	let tree = buildEmptyTree();
	const root = addExchangeResult(tree, 'ignored', 'root prompt', MODEL, PROVIDER);
	tree = root;
	const main = addExchangeResult(tree, root.id, 'main prompt', MODEL, PROVIDER);
	tree = main;
	const side = addExchangeResult(tree, root.id, 'side prompt', MODEL, PROVIDER);
	return { tree: side, rootId: root.id, mainId: main.id, sideId: side.id };
}

// ── Tree construction & validation ──────────────────────────────────────────

describe('buildEmptyTree', () => {
	it('creates an empty tree', () => {
		expect(buildEmptyTree()).toEqual({ rootId: null, exchanges: {} });
	});
});

describe('ChatTreeOperationError', () => {
	it('exposes the expected name and message', () => {
		const error = new ChatTreeOperationError('bad tree');
		expect(error.name).toBe('ChatTreeOperationError');
		expect(error.message).toBe('bad tree');
	});
});

describe('validateChatTree', () => {
	it('accepts a valid empty tree', () => {
		expect(() => validateChatTree(buildEmptyTree())).not.toThrow();
	});

	it('accepts a valid tree built through the public API', () => {
		const { tree } = buildLinearTree();
		expect(() => validateChatTree(tree)).not.toThrow();
	});

	it('rejects a tree whose rootId does not match the root exchange', () => {
		const tree: ChatTree = {
			rootId: 'wrong',
			exchanges: {
				root: exchange({ id: 'root', parentId: null })
			}
		};

		expect(() => validateChatTree(tree)).toThrow('rootId must point to root exchange');
	});

	it('rejects duplicate child ids', () => {
		const tree: ChatTree = {
			rootId: 'root',
			exchanges: {
				root: exchange({ id: 'root', parentId: null, childIds: ['a', 'a'] }),
				a: exchange({ id: 'a', parentId: 'root' })
			}
		};

		expect(() => validateChatTree(tree)).toThrow('duplicate child ids');
	});

	it('rejects a side exchange with multiple children', () => {
		const tree: ChatTree = {
			rootId: 'root',
			exchanges: {
				root: exchange({ id: 'root', parentId: null, childIds: ['main', 'side'] }),
				main: exchange({ id: 'main', parentId: 'root' }),
				side: exchange({ id: 'side', parentId: 'root', childIds: ['a', 'b'] }),
				a: exchange({ id: 'a', parentId: 'side' }),
				b: exchange({ id: 'b', parentId: 'side' })
			}
		};

		expect(() => validateChatTree(tree)).toThrow(
			'Side exchange "side" cannot have multiple children'
		);
	});
});

// ── Adding exchanges ────────────────────────────────────────────────────────

describe('addExchange and addExchangeResult', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('creates the root exchange when the tree is empty', () => {
		vi.spyOn(Date, 'now').mockReturnValue(123);

		const tree = addExchange(buildEmptyTree(), 'ignored-parent', 'root prompt', MODEL, PROVIDER);
		const root = getRootExchange(tree);

		expect(tree.rootId).not.toBeNull();
		expect(root).not.toBeNull();
		expect(root!.parentId).toBeNull();
		expect(root!.prompt).toEqual({ text: 'root prompt', tokenCount: 0 });
		expect(root!.response).toBeNull();
		expect(root!.model).toBe(MODEL);
		expect(root!.provider).toBe(PROVIDER);
		expect(root!.createdAt).toBe(123);
	});

	it('returns the new exchange id and updates parent child order', () => {
		let tree = buildEmptyTree();
		const root = addExchangeResult(tree, 'ignored', 'root prompt', MODEL, PROVIDER);
		tree = root;
		const child = addExchangeResult(tree, root.id, 'child prompt', MODEL, PROVIDER);

		expect(child.id).toBeDefined();
		expect(child.exchanges[root.id]!.childIds).toEqual([child.id]);
	});

	it('rejects a missing parent in a non-empty tree', () => {
		const tree = addExchangeResult(buildEmptyTree(), 'ignored', 'root prompt', MODEL, PROVIDER);
		expect(() => addExchange(tree, 'missing', 'child prompt', MODEL, PROVIDER)).toThrow(
			'Cannot add an exchange to missing parent'
		);
	});

	it('rejects adding a second child beneath a side exchange', () => {
		const { tree: baseTree, sideId } = buildRootWithSideChat();
		const tree = addExchange(baseTree, sideId, 'side child', MODEL, PROVIDER);

		expect(() => addExchange(tree, sideId, 'second side child', MODEL, PROVIDER)).toThrow(
			'Cannot add exchange: side chat'
		);
	});
});

// ── Removing exchanges ──────────────────────────────────────────────────────

describe('removeExchange and removeExchangeSubtree', () => {
	it('removes a leaf exchange', () => {
		const { tree, leafId, childId } = buildLinearTree();
		const next = removeExchange(tree, leafId);

		expect(next.exchanges[leafId]).toBeUndefined();
		expect(next.exchanges[childId]!.childIds).toEqual([]);
	});

	it('removes the root and promotes the first child', () => {
		const { tree: baseTree, rootId, mainId, sideId } = buildRootWithSideChat();
		const tree = addExchange(baseTree, mainId, 'main child', MODEL, PROVIDER);

		const next = removeExchange(tree, rootId);

		expect(next.rootId).toBe(mainId);
		expect(next.exchanges[mainId]!.parentId).toBeNull();
		expect(next.exchanges[mainId]!.childIds).toContain(sideId);
		expect(next.exchanges[sideId]!.parentId).toBe(mainId);
	});

	it('removes an entire subtree', () => {
		const { tree, childId, leafId } = buildLinearTree();
		const next = removeExchangeSubtree(tree, childId);

		expect(next.exchanges[childId]).toBeUndefined();
		expect(next.exchanges[leafId]).toBeUndefined();
		expect(getMainChatTail(next)).toBe(next.rootId);
	});

	it('removes the root subtree and returns an empty tree', () => {
		const { tree, rootId } = buildLinearTree();
		expect(removeExchangeSubtree(tree, rootId)).toEqual({ rootId: null, exchanges: {} });
	});
});

describe('removeMainChatChild and removeSideChatChildren', () => {
	it('removes the first child subtree', () => {
		const { tree: baseTree, rootId, mainId } = buildRootWithSideChat();
		const tree = addExchange(baseTree, mainId, 'grandchild', MODEL, PROVIDER);

		const next = removeMainChatChild(tree, rootId);
		expect(next.exchanges[mainId]).toBeUndefined();
	});

	it('removes only side chat children', () => {
		const { tree, rootId, mainId, sideId } = buildRootWithSideChat();
		const next = removeSideChatChildren(tree, rootId);

		expect(next.exchanges[mainId]).toBeDefined();
		expect(next.exchanges[sideId]).toBeUndefined();
	});
});

describe('deleteExchangeWithMode and deleteExchangeWithModeResult', () => {
	it('deletes only the exchange in exchange mode', () => {
		const { tree, childId, leafId } = buildLinearTree();
		const next = deleteExchangeWithMode(tree, childId, 'exchange');

		expect(next.exchanges[childId]).toBeUndefined();
		expect(next.exchanges[leafId]!.parentId).toBe(tree.rootId);
	});

	it('returns removed ids for exchangeAndSideChats mode', () => {
		const { tree, rootId, sideId } = buildRootWithSideChat();
		const result = deleteExchangeWithModeResult(tree, rootId, 'exchangeAndSideChats');

		expect(result.removedExchangeIds).toContain(rootId);
		expect(result.removedExchangeIds).toContain(sideId);
	});

	it('removes the exchange and its main child subtree in exchangeAndMainChat mode', () => {
		const { tree: baseTree, rootId, mainId, sideId } = buildRootWithSideChat();
		const tree = addExchange(baseTree, mainId, 'main grandchild', MODEL, PROVIDER);
		const grandchildId = getMainChatTail(tree)!;

		const next = deleteExchangeWithMode(tree, rootId, 'exchangeAndMainChat');
		expect(next.rootId).toBe(sideId);
		expect(next.exchanges[rootId]).toBeUndefined();
		expect(next.exchanges[mainId]).toBeUndefined();
		expect(next.exchanges[grandchildId]).toBeUndefined();
		expect(next.exchanges[sideId]!.parentId).toBeNull();
	});

	it('returns only the exchange id when exchangeAndMainChat has no main child', () => {
		const root = addExchangeResult(buildEmptyTree(), 'ignored', 'root prompt', MODEL, PROVIDER);
		const result = deleteExchangeWithModeResult(root, root.id, 'exchangeAndMainChat');

		expect(result.rootId).toBeNull();
		expect(result.exchanges).toEqual({});
		expect(result.removedExchangeIds).toEqual([root.id]);
	});
});

// ── Queries ─────────────────────────────────────────────────────────────────

describe('getRootExchange and getChildExchanges', () => {
	it('returns null for an empty tree', () => {
		expect(getRootExchange(buildEmptyTree())).toBeNull();
	});

	it('returns the root exchange and ordered children', () => {
		const { tree, rootId, mainId, sideId } = buildRootWithSideChat();

		expect(getRootExchange(tree)?.id).toBe(rootId);
		expect(childIds(tree, rootId)).toEqual([mainId, sideId]);
		expect(getChildExchanges(tree.exchanges, 'missing')).toEqual([]);
	});
});

describe('canCreateSideChats and canAcceptNewChat', () => {
	it('returns true for main-path exchanges with children, false for leaves and side exchanges', () => {
		const { tree, rootId, mainId, sideId } = buildRootWithSideChat();

		expect(canCreateSideChats(tree.exchanges, rootId)).toBe(true);
		expect(canCreateSideChats(tree.exchanges, mainId)).toBe(false);
		expect(canCreateSideChats(tree.exchanges, sideId)).toBe(false);
	});

	it('allows a leaf side exchange to accept a child but blocks a second one', () => {
		const { tree: baseTree, sideId } = buildRootWithSideChat();
		expect(canAcceptNewChat(baseTree.exchanges, sideId)).toBe(true);

		const tree = addExchange(baseTree, sideId, 'first child', MODEL, PROVIDER);
		expect(canAcceptNewChat(tree.exchanges, sideId)).toBe(false);
	});

	it('returns true immediately for a main-path exchange', () => {
		const { tree, mainId } = buildRootWithSideChat();
		expect(canAcceptNewChat(tree.exchanges, mainId)).toBe(true);
	});

	it('throws for a missing exchange in an empty map', () => {
		const empty = buildEmptyTree();
		expect(() => canCreateSideChats(empty.exchanges, 'missing')).toThrow('not found in tree');
		expect(() => canAcceptNewChat(empty.exchanges, 'missing')).toThrow('not found in tree');
	});

	it('returns false for a root-only tree (no children)', () => {
		const root = addExchangeResult(buildEmptyTree(), 'ignored', 'root prompt', MODEL, PROVIDER);
		expect(canCreateSideChats(root.exchanges, root.id)).toBe(false);
	});
});

describe('getHistory', () => {
	it('returns the conversation path for a leaf exchange', () => {
		const { tree, rootId, childId } = buildLinearTree();
		let exchanges = updateExchangeResponse(tree.exchanges, rootId, 'root response');
		exchanges = updateExchangeResponse(exchanges, childId, 'child response');
		const updatedTree: ChatTree = { rootId: tree.rootId, exchanges };

		expect(getHistory(updatedTree, childId)).toEqual([
			{ role: 'user', content: 'root prompt' },
			{ role: 'assistant', content: 'root response' },
			{ role: 'user', content: 'child prompt' },
			{ role: 'assistant', content: 'child response' }
		]);
	});
});

describe('getPathTokenTotal', () => {
	it('sums tokens along the path to root', () => {
		const { tree, rootId, childId } = buildLinearTree();
		let exchanges = updateExchangeTokens(tree.exchanges, rootId, 10, 20);
		exchanges = updateExchangeTokens(exchanges, childId, 30, 40);

		expect(exchanges[rootId]!.response).toEqual({ text: '', tokenCount: 20 });
		expect(getPathTokenTotal(exchanges, childId)).toBe(100);
	});
});

describe('getDescendantExchanges', () => {
	it('returns all descendants except the exchange itself', () => {
		const { tree, rootId, mainId, sideId } = buildRootWithSideChat();
		expect(getDescendantExchanges(tree, rootId)).toEqual([mainId, sideId]);
	});
});

describe('findSideChatParent', () => {
	it('finds the outermost side chat parent for a side branch exchange', () => {
		const { tree: baseTree, sideId, rootId } = buildRootWithSideChat();
		const tree = addExchange(baseTree, sideId, 'nested side child', MODEL, PROVIDER);
		const nestedId = getMainChatTail({ rootId: sideId, exchanges: tree.exchanges })!;

		expect(findSideChatParent(tree, nestedId)).toBe(rootId);
	});
});

// ── Mutations (immutable updates) ───────────────────────────────────────────

describe('updateExchangeTokens', () => {
	it('updates prompt and response token counts', () => {
		const { tree, rootId } = buildLinearTree();
		const exchanges = updateExchangeTokens(tree.exchanges, rootId, 10, 20);

		expect(exchanges[rootId]!.prompt.tokenCount).toBe(10);
		expect(exchanges[rootId]!.response).toEqual({ text: '', tokenCount: 20 });
	});
});

describe('updateExchangeResponse', () => {
	it('creates a response when updating response text on an exchange without one', () => {
		const root = addExchangeResult(buildEmptyTree(), 'ignored', 'root prompt', MODEL, PROVIDER);
		const exchanges = updateExchangeResponse(root.exchanges, root.id, 'new response');

		expect(exchanges[root.id]!.response).toEqual({ text: 'new response', tokenCount: 0 });
	});
});

// ── Promote & Copy ──────────────────────────────────────────────────────────

describe('getMainChatTail', () => {
	it('follows the first-child path as the main chat tail', () => {
		const { tree, leafId } = buildLinearTree();
		expect(getMainChatTail(tree)).toBe(leafId);
	});
});

describe('canPromoteSideChatToMainChat', () => {
	it('can promote a side chat only when the main branch does not branch', () => {
		const simple = buildRootWithSideChat();
		expect(canPromoteSideChatToMainChat(simple.tree, simple.sideId)).toBe(true);

		const complex = buildRootWithSideChat();
		complex.tree = addExchange(complex.tree, complex.mainId, 'branch base', MODEL, PROVIDER);
		const branchBaseId = getMainChatTail(complex.tree)!;
		complex.tree = addExchange(complex.tree, branchBaseId, 'branch main', MODEL, PROVIDER);
		complex.tree = addExchange(complex.tree, branchBaseId, 'branch side', MODEL, PROVIDER);

		expect(canPromoteSideChatToMainChat(complex.tree, complex.sideId)).toBe(false);
	});
});

describe('promoteSideChatToMainChat', () => {
	it('promotes a side chat to first-child position', () => {
		const { tree, rootId, mainId, sideId } = buildRootWithSideChat();
		const next = promoteSideChatToMainChat(tree, sideId);

		expect(childIds(next, rootId)).toEqual([sideId, mainId]);
	});
});

describe('copyPath', () => {
	it('copies the path from root to a selected exchange', () => {
		vi.spyOn(Date, 'now').mockReturnValue(500);

		const { tree, childId, leafId } = buildLinearTree();
		const copy = copyPath(tree, leafId);

		expect(copy.rootId).toBe(copy.firstCopiedId);
		expect(Object.keys(copy.copiedExchanges)).toHaveLength(3);
		expect(
			getHistory({ rootId: copy.rootId, exchanges: copy.copiedExchanges }, copy.firstCopiedId)
		).toEqual([{ role: 'user', content: 'root prompt' }]);

		const copiedRoot = copy.copiedExchanges[copy.rootId]!;
		const copiedChildId = copiedRoot.childIds[0]!;
		const copiedLeafId = copy.copiedExchanges[copiedChildId]!.childIds[0]!;

		expect(copy.copiedExchanges[copiedChildId]!.parentId).toBe(copy.rootId);
		expect(copy.copiedExchanges[copiedLeafId]!.parentId).toBe(copiedChildId);
		expect(copy.copiedExchanges[copiedLeafId]!.id).not.toBe(leafId);
		expect(copy.copiedExchanges[copiedChildId]!.id).not.toBe(childId);
	});
});
