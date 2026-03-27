import type { Provider } from '@/lib/models';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Message {
	role: 'user' | 'assistant';
	content: string;
}

export interface MessagePart {
	text: string;
	tokenCount: number;
}

export interface Exchange {
	id: string;
	parentId: string | null;
	childIds: string[];
	prompt: MessagePart;
	response: MessagePart | null;
	model: string;
	provider: Provider;
	createdAt: number;
}

export type ExchangeMap = Record<string, Exchange>;

export type DeleteMode = 'exchange' | 'exchangeAndMainChat' | 'exchangeAndSideChats';

export interface ChatTree {
	rootId: string | null;
	exchanges: ExchangeMap;
}

export interface Chat {
	id: string;
	name: string;
	rootId: string | null;
	exchanges: ExchangeMap;
	activeExchangeId: string | null;
}

export interface DeleteResult extends ChatTree {
	removedExchangeIds: string[];
}

export interface AddExchangeResult extends ChatTree {
	id: string;
}

// ── Error & assertions ───────────────────────────────────────────────────────

export class ChatTreeOperationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ChatTreeOperationError';
	}
}

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) {
		throw new ChatTreeOperationError(message);
	}
}

function requireExchange(exchanges: ExchangeMap, id: string, message: string): Exchange {
	const node = exchanges[id];
	assert(node !== undefined, message);
	return node;
}

// ── Internal types ───────────────────────────────────────────────────────────

interface IndexedTree extends ChatTree {
	childrenByParentId: Record<string, Exchange[]>;
}

// ── Empty tree ───────────────────────────────────────────────────────────────

export function buildEmptyTree(): ChatTree {
	return { rootId: null, exchanges: {} };
}

// ── Atomic parent-child primitives ───────────────────────────────────────────

function attachChild(
	exchanges: ExchangeMap,
	parentId: string,
	childId: string,
	index?: number
): ExchangeMap {
	const parent = requireExchange(
		exchanges,
		parentId,
		`Cannot attach to missing parent "${parentId}".`
	);
	const child = requireExchange(exchanges, childId, `Cannot attach missing child "${childId}".`);

	assert(
		child.parentId === parentId,
		`Child "${childId}" parentId "${child.parentId}" does not match target parent "${parentId}".`
	);
	assert(
		!parent.childIds.includes(childId),
		`Child "${childId}" already in parent "${parentId}" childIds.`
	);

	const nextChildIds = [...parent.childIds];
	if (index !== undefined) {
		nextChildIds.splice(index, 0, childId);
	} else {
		nextChildIds.push(childId);
	}

	return {
		...exchanges,
		[parentId]: { ...parent, childIds: nextChildIds }
	};
}

// ── Tree building & validation ───────────────────────────────────────────────

function buildChildrenByParentId(exchanges: ExchangeMap): Record<string, Exchange[]> {
	const result: Record<string, Exchange[]> = {};

	for (const exchange of Object.values(exchanges)) {
		if (exchange.childIds.length === 0) continue;
		result[exchange.id] = exchange.childIds.map((childId) => {
			const child = exchanges[childId];
			assert(
				child !== undefined,
				`Exchange "${exchange.id}" references missing child "${childId}".`
			);
			assert(
				child.parentId === exchange.id,
				`Child "${childId}" parentId "${child.parentId}" does not match parent "${exchange.id}".`
			);
			return child;
		});
	}

	return result;
}

function indexTree(tree: ChatTree): IndexedTree {
	return {
		...tree,
		childrenByParentId: buildChildrenByParentId(tree.exchanges)
	};
}

function validateTree(tree: ChatTree): IndexedTree {
	const exchangeList = Object.values(tree.exchanges);

	if (exchangeList.length === 0) {
		assert(tree.rootId === null, 'rootId must be null when there are no exchanges.');
		return indexTree(tree);
	}

	const roots = exchangeList.filter((e) => e.parentId === null);
	assert(roots.length === 1, `Tree must contain exactly one root exchange, found ${roots.length}.`);
	const root = roots[0]!;
	assert(
		tree.rootId === root.id,
		`rootId must point to root exchange "${root.id}", but points to "${tree.rootId}".`
	);

	for (const exchange of exchangeList) {
		if (exchange.parentId === null) continue;

		assert(
			tree.exchanges[exchange.parentId] !== undefined,
			`Exchange "${exchange.id}" has missing parent "${exchange.parentId}".`
		);

		const parent = tree.exchanges[exchange.parentId]!;
		assert(
			parent.childIds.includes(exchange.id),
			`Exchange "${exchange.id}" has parentId "${exchange.parentId}" but is not in parent's childIds.`
		);
	}

	for (const exchange of exchangeList) {
		const childIds = exchange.childIds;
		assert(
			new Set(childIds).size === childIds.length,
			`Exchange "${exchange.id}" has duplicate child ids.`
		);

		for (const childId of childIds) {
			const child = tree.exchanges[childId];
			assert(
				child !== undefined,
				`Exchange "${exchange.id}" references missing child "${childId}".`
			);
			assert(
				child.parentId === exchange.id,
				`Exchange "${exchange.id}" childIds contains "${childId}" but child's parentId is "${child.parentId}".`
			);
		}
	}

	const indexed = indexTree(tree);

	for (const exchange of exchangeList) {
		if (isSideExchange(indexed, exchange.id)) {
			assert(
				getChildrenFromTree(indexed, exchange.id).length <= 1,
				`Side exchange "${exchange.id}" cannot have multiple children.`
			);
		}
	}

	const visited = new Set<string>();
	const queue = [root.id];
	while (queue.length > 0) {
		const currentId = queue.shift()!;
		if (visited.has(currentId)) continue;
		visited.add(currentId);
		for (const child of getChildrenFromTree(indexed, currentId)) {
			queue.push(child.id);
		}
	}
	assert(visited.size === exchangeList.length, 'Tree contains unreachable or cyclic nodes.');

	return indexed;
}

// ── Tree traversal helpers ───────────────────────────────────────────────────

function isMainChild(tree: IndexedTree, parentId: string, childId: string): boolean {
	return tree.childrenByParentId[parentId]?.[0]?.id === childId;
}

function isSideExchange(tree: IndexedTree, exchangeId: string): boolean {
	let current: Exchange | undefined = tree.exchanges[exchangeId];
	assert(current !== undefined, `Exchange "${exchangeId}" not found in tree.`);

	while (current) {
		if (current.parentId === null) return false;
		if (!isMainChild(tree, current.parentId, current.id)) {
			return true;
		}
		current = tree.exchanges[current.parentId];
	}

	return false;
}

function getChildrenFromTree(tree: IndexedTree, exchangeId: string): Exchange[] {
	return tree.childrenByParentId[exchangeId] ?? [];
}

function getPathToRoot(tree: IndexedTree, exchangeId: string): Exchange[] {
	const path: Exchange[] = [];
	let current: Exchange | undefined = tree.exchanges[exchangeId];
	assert(current !== undefined, `Exchange "${exchangeId}" not found in tree.`);

	while (current) {
		path.push(current);
		if (current.parentId === null) break;
		current = tree.exchanges[current.parentId];
	}

	return path.reverse();
}

function collectSubtreeIds(tree: IndexedTree, exchangeId: string): string[] {
	assert(tree.exchanges[exchangeId] !== undefined, `Exchange "${exchangeId}" not found in tree.`);

	const visited = new Set<string>();
	const queue = [exchangeId];
	const ids: string[] = [];

	while (queue.length > 0) {
		const currentId = queue.shift()!;
		if (visited.has(currentId)) continue;
		visited.add(currentId);
		ids.push(currentId);
		for (const child of getChildrenFromTree(tree, currentId)) {
			queue.push(child.id);
		}
	}

	return ids;
}

function hasBranchingDescendant(tree: IndexedTree, exchangeId: string): boolean {
	const queue = [exchangeId];

	while (queue.length > 0) {
		const currentId = queue.shift()!;
		const children = getChildrenFromTree(tree, currentId);
		if (children.length > 1) return true;
		for (const child of children) {
			queue.push(child.id);
		}
	}

	return false;
}

// ── Internal mutation helpers ────────────────────────────────────────────────

function spliceExchange(tree: ChatTree, exchangeId: string): ChatTree {
	const exchange = requireExchange(
		tree.exchanges,
		exchangeId,
		`Cannot remove missing exchange "${exchangeId}".`
	);
	const indexed = indexTree(tree);
	const children = getChildrenFromTree(indexed, exchangeId);
	const childIds = children.map((c) => c.id);

	// Shallow copy — mutated imperatively below for perf
	const next = { ...tree.exchanges };
	delete next[exchangeId];
	let nextRootId = tree.rootId;

	if (exchange.parentId === null) {
		if (childIds.length === 0) {
			nextRootId = null;
		} else {
			const newRootId = childIds[0]!;
			nextRootId = newRootId;
			next[newRootId] = {
				...next[newRootId]!,
				parentId: null,
				childIds: [...next[newRootId]!.childIds]
			};
			for (let i = 1; i < childIds.length; i++) {
				const cid = childIds[i]!;
				next[cid] = { ...next[cid]!, parentId: newRootId };
				next[newRootId] = { ...next[newRootId]!, childIds: [...next[newRootId]!.childIds, cid] };
			}
		}
	} else {
		const parentId = exchange.parentId;
		const parent = requireExchange(tree.exchanges, parentId, `Cannot find parent "${parentId}".`);
		const removedIndex = parent.childIds.indexOf(exchangeId);
		assert(removedIndex >= 0, `Exchange "${exchangeId}" not in parent "${parentId}" childIds.`);

		const parentChildIds = parent.childIds.filter((id) => id !== exchangeId);
		for (let i = 0; i < childIds.length; i++) {
			const cid = childIds[i]!;
			next[cid] = { ...next[cid]!, parentId };
			parentChildIds.splice(removedIndex + i, 0, cid);
		}
		next[parentId] = { ...parent, childIds: parentChildIds };
	}

	return { rootId: nextRootId, exchanges: next };
}

function exciseSubtree(
	tree: ChatTree,
	exchangeId: string
): { tree: ChatTree; removedIds: string[] } {
	const exchange = requireExchange(
		tree.exchanges,
		exchangeId,
		`Cannot remove missing subtree "${exchangeId}".`
	);
	const indexed = indexTree(tree);

	const removedIds = collectSubtreeIds(indexed, exchangeId);
	const removedIdSet = new Set(removedIds);

	if (exchange.parentId === null) {
		return { tree: { rootId: null, exchanges: {} }, removedIds };
	}

	const parent = requireExchange(
		tree.exchanges,
		exchange.parentId,
		`Cannot find parent "${exchange.parentId}".`
	);
	const next = {
		...tree.exchanges,
		[exchange.parentId]: { ...parent, childIds: parent.childIds.filter((id) => id !== exchangeId) }
	};
	const filtered = Object.fromEntries(
		Object.entries(next).filter(([id]) => !removedIdSet.has(id))
	) as ExchangeMap;

	return { tree: { rootId: tree.rootId, exchanges: filtered }, removedIds };
}

// ── Tree construction & validation ──────────────────────────────────────────

export function validateChatTree(tree: ChatTree): ChatTree {
	validateTree(tree);
	return tree;
}

// ── Adding exchanges ────────────────────────────────────────────────────────

export function addExchange(
	tree: ChatTree,
	parentId: string,
	prompt: string,
	model: string,
	provider: Provider
): ChatTree {
	const r = addExchangeResult(tree, parentId, prompt, model, provider);
	return { rootId: r.rootId, exchanges: r.exchanges };
}

export function addExchangeResult(
	tree: ChatTree,
	parentId: string,
	prompt: string,
	model: string,
	provider: Provider
): AddExchangeResult {
	const indexed = validateTree(tree);

	const id = crypto.randomUUID();
	const newExchange: Exchange = {
		id,
		parentId,
		childIds: [],
		prompt: { text: prompt, tokenCount: 0 },
		response: null,
		model,
		provider,
		createdAt: Date.now()
	};

	let nextRootId = tree.rootId;
	let next: ExchangeMap;

	if (Object.keys(indexed.exchanges).length === 0) {
		next = { [id]: { ...newExchange, parentId: null } };
		nextRootId = id;
	} else {
		const parent = requireExchange(
			indexed.exchanges,
			parentId,
			`Cannot add an exchange to missing parent "${parentId}".`
		);

		// Side-chat depth constraint: if parent is a side exchange, it can have at most 1 child
		if (isSideExchange(indexed, parentId)) {
			assert(
				parent.childIds.length === 0,
				`Cannot add exchange: side chat "${parentId}" already has a child.`
			);
		}

		next = { ...indexed.exchanges, [id]: newExchange };
		next = attachChild(next, parentId, id);
	}

	return { id, rootId: nextRootId, exchanges: next };
}

// ── Removing exchanges ──────────────────────────────────────────────────────

export function removeExchange(tree: ChatTree, exchangeId: string): ChatTree {
	validateTree(tree);
	return spliceExchange(tree, exchangeId);
}

export function removeExchangeSubtree(tree: ChatTree, exchangeId: string): ChatTree {
	const r = removeExchangeSubtreeResult(tree, exchangeId);
	return { rootId: r.rootId, exchanges: r.exchanges };
}

export function removeMainChatChild(tree: ChatTree, exchangeId: string): ChatTree {
	const indexed = validateTree(tree);
	const mainChild = getChildrenFromTree(indexed, exchangeId)[0];
	assert(mainChild !== undefined, `Exchange "${exchangeId}" has no main chat child to remove.`);

	const result = exciseSubtree(tree, mainChild.id);
	return result.tree;
}

export function removeSideChatChildren(tree: ChatTree, exchangeId: string): ChatTree {
	const indexed = validateTree(tree);
	const sideChildren = getChildrenFromTree(indexed, exchangeId).slice(1);
	assert(sideChildren.length > 0, `Exchange "${exchangeId}" has no side chat children to remove.`);

	let current: ChatTree = tree;
	for (const child of sideChildren) {
		const result = exciseSubtree(current, child.id);
		current = result.tree;
	}
	return current;
}

export function deleteExchangeWithMode(
	tree: ChatTree,
	exchangeId: string,
	mode: DeleteMode
): ChatTree {
	const r = deleteExchangeWithModeResult(tree, exchangeId, mode);
	return { rootId: r.rootId, exchanges: r.exchanges };
}

export function deleteExchangeWithModeResult(
	tree: ChatTree,
	exchangeId: string,
	mode: DeleteMode
): DeleteResult {
	const indexed = validateTree(tree);
	requireExchange(indexed.exchanges, exchangeId, `Cannot delete missing exchange "${exchangeId}".`);

	switch (mode) {
		case 'exchange': {
			const spliced = spliceExchange(tree, exchangeId);
			return { ...spliced, removedExchangeIds: [exchangeId] };
		}
		case 'exchangeAndMainChat':
			return deleteExchangeAndMainChat(indexed, exchangeId);
		case 'exchangeAndSideChats':
			return deleteExchangeAndSideChats(indexed, exchangeId);
	}
}

function removeExchangeSubtreeResult(tree: ChatTree, exchangeId: string): DeleteResult {
	validateTree(tree);
	const result = exciseSubtree(tree, exchangeId);
	return { ...result.tree, removedExchangeIds: result.removedIds };
}

function deleteExchangeAndMainChat(indexed: IndexedTree, exchangeId: string): DeleteResult {
	const mainChild = getChildrenFromTree(indexed, exchangeId)[0];

	let current: ChatTree = indexed;
	let removedIds: string[] = [];

	if (mainChild) {
		const result = exciseSubtree(current, mainChild.id);
		current = result.tree;
		removedIds = result.removedIds;
	}

	const spliced = spliceExchange(current, exchangeId);
	return { ...spliced, removedExchangeIds: [exchangeId, ...removedIds] };
}

function deleteExchangeAndSideChats(indexed: IndexedTree, exchangeId: string): DeleteResult {
	const sideChats = getChildrenFromTree(indexed, exchangeId).slice(1);

	let current: ChatTree = indexed;
	const removedIds: string[] = [];

	for (const child of sideChats) {
		const result = exciseSubtree(current, child.id);
		current = result.tree;
		removedIds.push(...result.removedIds);
	}

	const spliced = spliceExchange(current, exchangeId);
	return { ...spliced, removedExchangeIds: [exchangeId, ...removedIds] };
}

// ── Queries ─────────────────────────────────────────────────────────────────

export function getRootExchange(tree: ChatTree): Exchange | null {
	if (tree.rootId === null) return null;
	return tree.exchanges[tree.rootId] ?? null;
}

function findRootId(exchanges: ExchangeMap): string | null {
	for (const exchange of Object.values(exchanges)) {
		if (exchange.parentId === null) return exchange.id;
	}
	return null;
}

export function getChildExchanges(exchanges: ExchangeMap, exchangeId: string): Exchange[] {
	const exchange = exchanges[exchangeId];
	if (!exchange) return [];
	return exchange.childIds.map((id) => exchanges[id]).filter((e): e is Exchange => e !== undefined);
}

export function canCreateSideChats(exchanges: ExchangeMap, exchangeId: string): boolean {
	const rootId = findRootId(exchanges);
	const indexed = indexTree({ rootId, exchanges });
	return !isSideExchange(indexed, exchangeId);
}

export function canAcceptNewChat(exchanges: ExchangeMap, exchangeId: string): boolean {
	if (canCreateSideChats(exchanges, exchangeId)) {
		return true;
	}

	const exchange = exchanges[exchangeId];
	return !exchange || exchange.childIds.length === 0;
}

export function getHistory(tree: ChatTree, exchangeId: string): Message[] {
	requireExchange(
		tree.exchanges,
		exchangeId,
		`Cannot get history for missing exchange "${exchangeId}".`
	);
	const indexed = indexTree(tree);

	return getPathToRoot(indexed, exchangeId).flatMap((exchange) => {
		const messages: Message[] = [{ role: 'user', content: exchange.prompt.text }];
		if (exchange.response) {
			messages.push({ role: 'assistant', content: exchange.response.text });
		}
		return messages;
	});
}

export function getPathTokenTotal(exchanges: ExchangeMap, exchangeId: string): number {
	let current: Exchange | undefined = exchanges[exchangeId];
	let total = 0;

	while (current) {
		total += current.prompt.tokenCount + (current.response?.tokenCount ?? 0);
		if (current.parentId === null) break;
		current = exchanges[current.parentId];
	}

	return total;
}

// ── Mutations (immutable updates) ────────────────────────────────────────────

export function updateExchangeTokens(
	exchanges: ExchangeMap,
	exchangeId: string,
	promptTokens: number,
	responseTokens: number
): ExchangeMap {
	const exchange = requireExchange(
		exchanges,
		exchangeId,
		`Cannot update tokens for missing exchange "${exchangeId}".`
	);
	return {
		...exchanges,
		[exchangeId]: {
			...exchange,
			prompt: { ...exchange.prompt, tokenCount: promptTokens },
			response: exchange.response
				? { ...exchange.response, tokenCount: responseTokens }
				: { text: '', tokenCount: responseTokens }
		}
	};
}

export function updateExchangeResponse(
	exchanges: ExchangeMap,
	exchangeId: string,
	text: string
): ExchangeMap {
	const exchange = requireExchange(
		exchanges,
		exchangeId,
		`Cannot update response for missing exchange "${exchangeId}".`
	);
	return {
		...exchanges,
		[exchangeId]: {
			...exchange,
			response: exchange.response ? { ...exchange.response, text } : { text, tokenCount: 0 }
		}
	};
}

// ── Promote & Fork ──────────────────────────────────────────────────────────

export function getMainChatTail(tree: ChatTree): string | null {
	const root = getRootExchange(tree);
	if (!root) return null;

	const indexed = indexTree(tree);
	let current: Exchange = root;
	while (true) {
		const children = getChildrenFromTree(indexed, current.id);
		if (children.length === 0) return current.id;
		current = children[0]!;
	}
}

export function canPromoteSideChatToMainChat(tree: ChatTree, exchangeId: string): boolean {
	const exchange = tree.exchanges[exchangeId];
	if (!exchange || exchange.parentId === null) return false;

	const parent = tree.exchanges[exchange.parentId];
	if (!parent) return false;

	const index = parent.childIds.indexOf(exchangeId);
	if (index <= 0) return false;

	const mainChildId = parent.childIds[0]!;
	return !hasBranchingDescendant(indexTree(tree), mainChildId);
}

export function promoteSideChatToMainChat(tree: ChatTree, exchangeId: string): ChatTree {
	const indexed = validateTree(tree);
	const exchange = requireExchange(
		indexed.exchanges,
		exchangeId,
		`Cannot promote missing exchange "${exchangeId}".`
	);

	assert(exchange.parentId !== null, `Cannot promote root exchange "${exchangeId}".`);
	const parent = requireExchange(
		indexed.exchanges,
		exchange.parentId,
		`Cannot find parent "${exchange.parentId}".`
	);
	const siblingIds = parent.childIds;
	const index = siblingIds.indexOf(exchangeId);
	assert(index > 0, `Exchange "${exchangeId}" is not a side chat child of its parent.`);

	const reorderedSiblingIds = [...siblingIds];
	reorderedSiblingIds.splice(index, 1);
	reorderedSiblingIds.unshift(exchangeId);

	const next: ExchangeMap = {
		...indexed.exchanges,
		[exchange.parentId]: { ...parent, childIds: reorderedSiblingIds }
	};
	return { rootId: tree.rootId, exchanges: next };
}

export function getDescendantExchanges(tree: ChatTree, exchangeId: string): string[] {
	requireExchange(
		tree.exchanges,
		exchangeId,
		`Cannot get descendants for missing exchange "${exchangeId}".`
	);
	const indexed = indexTree(tree);
	return collectSubtreeIds(indexed, exchangeId).slice(1);
}

export function findSideChatParent(tree: ChatTree, exchangeId: string): string | null {
	const indexed = indexTree(tree);
	let current: Exchange | undefined = indexed.exchanges[exchangeId];
	let outermostSideChatParent: string | null = null;

	while (current) {
		if (current.parentId === null) break;
		if (!isMainChild(indexed, current.parentId, current.id)) {
			outermostSideChatParent = current.parentId;
		}
		current = indexed.exchanges[current.parentId];
	}

	return outermostSideChatParent;
}

export function forkExchanges(
	tree: ChatTree,
	exchangeId: string
): { rootId: string; forkedExchanges: ExchangeMap; firstCopiedId: string } {
	const indexed = indexTree(tree);
	requireExchange(
		indexed.exchanges,
		exchangeId,
		`Cannot fork from missing exchange "${exchangeId}".`
	);

	const path = getPathToRoot(indexed, exchangeId);
	assert(path.length > 0, `Path to root from "${exchangeId}" is empty.`);

	const idMap = new Map<string, string>();
	for (const exchange of path) {
		idMap.set(exchange.id, crypto.randomUUID());
	}

	let result: ExchangeMap = {};
	let newRootId = '';
	let firstCopiedId = '';

	for (const exchange of path) {
		const copiedId = idMap.get(exchange.id)!;
		if (!firstCopiedId) firstCopiedId = copiedId;

		const copiedParentId =
			exchange.parentId === null ? null : (idMap.get(exchange.parentId) ?? null);

		const copied: Exchange = {
			id: copiedId,
			parentId: copiedParentId,
			childIds: [],
			prompt: { ...exchange.prompt },
			response: exchange.response ? { ...exchange.response } : null,
			model: exchange.model,
			provider: exchange.provider,
			createdAt: Date.now()
		};

		result = { ...result, [copiedId]: copied };

		if (copiedParentId === null) {
			newRootId = copiedId;
		} else {
			result = attachChild(result, copiedParentId, copiedId);
		}
	}

	return { rootId: newRootId, forkedExchanges: result, firstCopiedId };
}
