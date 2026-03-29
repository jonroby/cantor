import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	addExchange,
	buildEmptyTree,
	ChatTreeOperationError,
	getChildren,
	getExchange,
	getPath,
	getMainChatTail,
	promoteSideChatToMainChat,
	removeExchange,
	removeExchangeSubtree,
	updateExchangeResponse,
	updateExchangeTokens,
	validateChatTree,
	constraints,
	type ChatTree,
	type Exchange
} from '../index';
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
	return getChildren(tree, exchangeId).map((child) => child.id);
}

function buildLinearTree(): { tree: ChatTree; rootId: string; childId: string; leafId: string } {
	let tree = buildEmptyTree();
	const root = addExchange(tree, 'ignored', 'root prompt', MODEL, PROVIDER);
	tree = root.tree;
	const child = addExchange(tree, root.id, 'child prompt', MODEL, PROVIDER);
	tree = child.tree;
	const leaf = addExchange(tree, child.id, 'leaf prompt', MODEL, PROVIDER);
	return { tree: leaf.tree, rootId: root.id, childId: child.id, leafId: leaf.id };
}

function buildRootWithSideChat(): {
	tree: ChatTree;
	rootId: string;
	mainId: string;
	sideId: string;
} {
	let tree = buildEmptyTree();
	const root = addExchange(tree, 'ignored', 'root prompt', MODEL, PROVIDER);
	tree = root.tree;
	const main = addExchange(tree, root.id, 'main prompt', MODEL, PROVIDER);
	tree = main.tree;
	const side = addExchange(tree, root.id, 'side prompt', MODEL, PROVIDER);
	return { tree: side.tree, rootId: root.id, mainId: main.id, sideId: side.id };
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

describe('addExchange', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('creates the root exchange when the tree is empty', () => {
		vi.spyOn(Date, 'now').mockReturnValue(123);

		const result = addExchange(buildEmptyTree(), 'ignored-parent', 'root prompt', MODEL, PROVIDER);
		const root = result.tree.rootId ? getExchange(result.tree, result.tree.rootId) : null;

		expect(result.tree.rootId).not.toBeNull();
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
		const root = addExchange(tree, 'ignored', 'root prompt', MODEL, PROVIDER);
		tree = root.tree;
		const child = addExchange(tree, root.id, 'child prompt', MODEL, PROVIDER);

		expect(child.id).toBeDefined();
		expect(child.tree.exchanges[root.id]!.childIds).toEqual([child.id]);
	});

	it('rejects a missing parent in a non-empty tree', () => {
		const tree = addExchange(buildEmptyTree(), 'ignored', 'root prompt', MODEL, PROVIDER).tree;
		expect(() => addExchange(tree, 'missing', 'child prompt', MODEL, PROVIDER)).toThrow(
			'Cannot add an exchange to missing parent'
		);
	});

	it('rejects adding a second child beneath a side exchange', () => {
		const { tree: baseTree, sideId } = buildRootWithSideChat();
		const tree = addExchange(baseTree, sideId, 'side child', MODEL, PROVIDER).tree;

		expect(() => addExchange(tree, sideId, 'second side child', MODEL, PROVIDER)).toThrow(
			'Cannot add exchange: side chat'
		);
	});
});

// ── Removing exchanges ──────────────────────────────────────────────────────

describe('removeExchange and removeExchangeSubtree', () => {
	it('removes a leaf exchange', () => {
		const { tree, leafId, childId } = buildLinearTree();
		const next = removeExchange(tree, leafId).tree;

		expect(next.exchanges[leafId]).toBeUndefined();
		expect(next.exchanges[childId]!.childIds).toEqual([]);
	});

	it('removes the root and promotes the first child', () => {
		const { tree: baseTree, rootId, mainId, sideId } = buildRootWithSideChat();
		const tree = addExchange(baseTree, mainId, 'main child', MODEL, PROVIDER).tree;

		const next = removeExchange(tree, rootId).tree;

		expect(next.rootId).toBe(mainId);
		expect(next.exchanges[mainId]!.parentId).toBeNull();
		expect(next.exchanges[mainId]!.childIds).toContain(sideId);
		expect(next.exchanges[sideId]!.parentId).toBe(mainId);
	});

	it('removes an entire subtree', () => {
		const { tree, childId, leafId } = buildLinearTree();
		const next = removeExchangeSubtree(tree, childId).tree;

		expect(next.exchanges[childId]).toBeUndefined();
		expect(next.exchanges[leafId]).toBeUndefined();
		expect(getMainChatTail(next)).toBe(next.rootId);
	});

	it('removes the root subtree and returns an empty tree', () => {
		const { tree, rootId } = buildLinearTree();
		expect(removeExchangeSubtree(tree, rootId).tree).toEqual({ rootId: null, exchanges: {} });
	});
});

// ── Queries ─────────────────────────────────────────────────────────────────

describe('getExchange and getChildren', () => {
	it('returns null for an empty tree', () => {
		expect(buildEmptyTree().rootId).toBeNull();
	});

	it('returns the root exchange and ordered children', () => {
		const { tree, rootId, mainId, sideId } = buildRootWithSideChat();

		expect(getExchange(tree, rootId)?.id).toBe(rootId);
		expect(childIds(tree, rootId)).toEqual([mainId, sideId]);
		expect(getChildren(tree, 'missing')).toEqual([]);
	});
});

describe('canCreateSideChats and canAcceptNewChat', () => {
	it('returns true for main-path exchanges with children, false for leaves and side exchanges', () => {
		const { tree, rootId, mainId, sideId } = buildRootWithSideChat();

		expect(constraints.canCreateSideChats(tree, rootId)).toBe(true);
		expect(constraints.canCreateSideChats(tree, mainId)).toBe(false);
		expect(constraints.canCreateSideChats(tree, sideId)).toBe(false);
	});

	it('allows a leaf side exchange to accept a child but blocks a second one', () => {
		const { tree: baseTree, sideId } = buildRootWithSideChat();
		expect(constraints.canAcceptNewChat(baseTree, sideId)).toBe(true);

		const tree = addExchange(baseTree, sideId, 'first child', MODEL, PROVIDER).tree;
		expect(constraints.canAcceptNewChat(tree, sideId)).toBe(false);
	});

	it('returns true immediately for a main-path exchange', () => {
		const { tree, mainId } = buildRootWithSideChat();
		expect(constraints.canAcceptNewChat(tree, mainId)).toBe(true);
	});

	it('throws for a missing exchange in an empty map', () => {
		const empty = buildEmptyTree();
		expect(() => constraints.canCreateSideChats(empty, 'missing')).toThrow(
			'Cannot get path for missing exchange'
		);
		expect(() => constraints.canAcceptNewChat(empty, 'missing')).toThrow(
			'Cannot get path for missing exchange'
		);
	});

	it('returns false for a root-only tree (no children)', () => {
		const root = addExchange(buildEmptyTree(), 'ignored', 'root prompt', MODEL, PROVIDER);
		expect(constraints.canCreateSideChats(root.tree, root.id)).toBe(false);
	});
});

describe('getPath', () => {
	it('returns the root-to-exchange path', () => {
		const { tree, rootId, childId } = buildLinearTree();
		let exchanges = updateExchangeResponse(tree.exchanges, rootId, 'root response');
		exchanges = updateExchangeResponse(exchanges, childId, 'child response');
		const updatedTree: ChatTree = { rootId: tree.rootId, exchanges };

		expect(getPath(updatedTree, childId).map((exchange) => exchange.id)).toEqual([rootId, childId]);
	});
});

describe('getPath token reduction', () => {
	it('can sum tokens along the path', () => {
		const { tree, rootId, childId } = buildLinearTree();
		let exchanges = updateExchangeTokens(tree.exchanges, rootId, 10, 20);
		exchanges = updateExchangeTokens(exchanges, childId, 30, 40);
		const updatedTree: ChatTree = { rootId: tree.rootId, exchanges };

		expect(exchanges[rootId]!.response).toEqual({ text: '', tokenCount: 20 });
		expect(
			getPath(updatedTree, childId).reduce(
				(total, exchange) =>
					total + exchange.prompt.tokenCount + (exchange.response?.tokenCount ?? 0),
				0
			)
		).toBe(100);
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
		const root = addExchange(buildEmptyTree(), 'ignored', 'root prompt', MODEL, PROVIDER);
		const exchanges = updateExchangeResponse(root.tree.exchanges, root.id, 'new response');

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
	it('can promote a side chat only when the main path does not split', () => {
		const simple = buildRootWithSideChat();
		expect(constraints.canPromoteSideChatToMainChat(simple.tree, simple.sideId)).toBe(true);

		const complex = buildRootWithSideChat();
		complex.tree = addExchange(complex.tree, complex.mainId, 'split base', MODEL, PROVIDER).tree;
		const splitBaseId = getMainChatTail(complex.tree)!;
		complex.tree = addExchange(complex.tree, splitBaseId, 'split main', MODEL, PROVIDER).tree;
		complex.tree = addExchange(complex.tree, splitBaseId, 'split side', MODEL, PROVIDER).tree;

		expect(constraints.canPromoteSideChatToMainChat(complex.tree, complex.sideId)).toBe(false);
	});
});

describe('promoteSideChatToMainChat', () => {
	it('promotes a side chat to first-child position', () => {
		const { tree, rootId, mainId, sideId } = buildRootWithSideChat();
		const next = promoteSideChatToMainChat(tree, sideId).tree;

		expect(childIds(next, rootId)).toEqual([sideId, mainId]);
	});
});
