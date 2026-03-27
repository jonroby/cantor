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
	forkExchanges,
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
	type DeleteMode,
	type Exchange
} from './index';
import type { Provider } from '@/lib/models';

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

		expect(() => validateChatTree(tree)).toThrow('Side exchange "side" cannot have multiple children');
	});
});

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
		let { tree, sideId } = buildRootWithSideChat();
		tree = addExchange(tree, sideId, 'side child', MODEL, PROVIDER);

		expect(() => addExchange(tree, sideId, 'second side child', MODEL, PROVIDER)).toThrow(
			'Cannot add exchange: side chat'
		);
	});
});

describe('removeExchange and removeExchangeSubtree', () => {
	it('removes a leaf exchange', () => {
		const { tree, leafId, childId } = buildLinearTree();
		const next = removeExchange(tree, leafId);

		expect(next.exchanges[leafId]).toBeUndefined();
		expect(next.exchanges[childId]!.childIds).toEqual([]);
	});

	it('removes the root and promotes the first child', () => {
		let { tree, rootId, mainId, sideId } = buildRootWithSideChat();
		tree = addExchange(tree, mainId, 'main child', MODEL, PROVIDER);

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
		let { tree, rootId, mainId } = buildRootWithSideChat();
		tree = addExchange(tree, mainId, 'grandchild', MODEL, PROVIDER);

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
		let { tree, rootId, mainId, sideId } = buildRootWithSideChat();
		tree = addExchange(tree, mainId, 'main grandchild', MODEL, PROVIDER);
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

	it('supports all public delete modes', () => {
		const modes: DeleteMode[] = ['exchange', 'exchangeAndMainChat', 'exchangeAndSideChats'];
		expect(modes).toHaveLength(3);
	});
});

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
	it('distinguishes main-path exchanges from side exchanges', () => {
		const { tree, rootId, mainId, sideId } = buildRootWithSideChat();

		expect(canCreateSideChats(tree.exchanges, rootId)).toBe(true);
		expect(canCreateSideChats(tree.exchanges, mainId)).toBe(true);
		expect(canCreateSideChats(tree.exchanges, sideId)).toBe(false);
	});

	it('allows a leaf side exchange to accept a child but blocks a second one', () => {
		let { tree, sideId } = buildRootWithSideChat();
		expect(canAcceptNewChat(tree.exchanges, sideId)).toBe(true);

		tree = addExchange(tree, sideId, 'first child', MODEL, PROVIDER);
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

	it('returns false from side detection for a root-only tree', () => {
		const root = addExchangeResult(buildEmptyTree(), 'ignored', 'root prompt', MODEL, PROVIDER);
		expect(canCreateSideChats(root.exchanges, root.id)).toBe(true);
	});
});

describe('getHistory, getPathTokenTotal, updateExchangeTokens, and updateExchangeResponse', () => {
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

	it('updates tokens and sums them along the path', () => {
		const { tree, rootId, childId } = buildLinearTree();
		let exchanges = updateExchangeTokens(tree.exchanges, rootId, 10, 20);
		exchanges = updateExchangeTokens(exchanges, childId, 30, 40);

		expect(exchanges[rootId]!.response).toEqual({ text: '', tokenCount: 20 });
		expect(getPathTokenTotal(exchanges, childId)).toBe(100);
	});

	it('creates a response when updating response text on an exchange without one', () => {
		const root = addExchangeResult(buildEmptyTree(), 'ignored', 'root prompt', MODEL, PROVIDER);
		const exchanges = updateExchangeResponse(root.exchanges, root.id, 'new response');

		expect(exchanges[root.id]!.response).toEqual({ text: 'new response', tokenCount: 0 });
	});
});

describe('getMainChatTail, canPromoteSideChatToMainChat, and promoteSideChatToMainChat', () => {
	it('follows the first-child path as the main chat tail', () => {
		const { tree, leafId } = buildLinearTree();
		expect(getMainChatTail(tree)).toBe(leafId);
	});

	it('can promote a side chat only when the main branch does not branch', () => {
		const simple = buildRootWithSideChat();
		expect(canPromoteSideChatToMainChat(simple.tree, simple.sideId)).toBe(true);

		let complex = buildRootWithSideChat();
		complex.tree = addExchange(complex.tree, complex.mainId, 'branch base', MODEL, PROVIDER);
		const branchBaseId = getMainChatTail(complex.tree)!;
		complex.tree = addExchange(complex.tree, branchBaseId, 'branch main', MODEL, PROVIDER);
		complex.tree = addExchange(complex.tree, branchBaseId, 'branch side', MODEL, PROVIDER);

		expect(canPromoteSideChatToMainChat(complex.tree, complex.sideId)).toBe(false);
	});

	it('promotes a side chat to first-child position', () => {
		const { tree, rootId, mainId, sideId } = buildRootWithSideChat();
		const next = promoteSideChatToMainChat(tree, sideId);

		expect(childIds(next, rootId)).toEqual([sideId, mainId]);
	});
});

describe('getDescendantExchanges and findSideChatParent', () => {
	it('returns all descendants except the exchange itself', () => {
		const { tree, rootId, mainId, sideId } = buildRootWithSideChat();
		expect(getDescendantExchanges(tree, rootId)).toEqual([mainId, sideId]);
	});

	it('finds the outermost side chat parent for a side branch exchange', () => {
		let { tree, sideId, rootId } = buildRootWithSideChat();
		tree = addExchange(tree, sideId, 'nested side child', MODEL, PROVIDER);
		const nestedId = getMainChatTail({ rootId: sideId, exchanges: tree.exchanges })!;

		expect(findSideChatParent(tree, nestedId)).toBe(rootId);
	});
});

describe('forkExchanges', () => {
	it('forks the path to a selected exchange', () => {
		vi.spyOn(Date, 'now').mockReturnValue(500);

		const { tree, childId, leafId } = buildLinearTree();
		const fork = forkExchanges(tree, leafId);

		expect(fork.rootId).toBe(fork.firstCopiedId);
		expect(Object.keys(fork.forkedExchanges)).toHaveLength(3);
		expect(getHistory({ rootId: fork.rootId, exchanges: fork.forkedExchanges }, fork.firstCopiedId)).toEqual([
			{ role: 'user', content: 'root prompt' }
		]);

		const copiedRoot = fork.forkedExchanges[fork.rootId]!;
		const copiedChildId = copiedRoot.childIds[0]!;
		const copiedLeafId = fork.forkedExchanges[copiedChildId]!.childIds[0]!;

		expect(fork.forkedExchanges[copiedChildId]!.parentId).toBe(fork.rootId);
		expect(fork.forkedExchanges[copiedLeafId]!.parentId).toBe(copiedChildId);
		expect(fork.forkedExchanges[copiedLeafId]!.id).not.toBe(leafId);
		expect(fork.forkedExchanges[copiedChildId]!.id).not.toBe(childId);
	});
});
