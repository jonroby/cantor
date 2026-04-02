import type { Provider } from '@/domain/models';

export interface ImageAttachment {
	mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
	base64: string;
}

export interface Message {
	role: 'user' | 'assistant';
	content: string;
	images?: ImageAttachment[];
}

export interface MessagePart {
	text: string;
	tokenCount: number;
	images?: ImageAttachment[];
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
	label?: string;
}

export type ExchangeMap = Record<string, Exchange>;

export interface ChatTree {
	rootId: string | null;
	exchanges: ExchangeMap;
}

export interface DeleteResult {
	tree: ChatTree;
	removedIds: string[];
}

export interface AddExchangeResult {
	tree: ChatTree;
	id: string;
}

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

interface IndexedTree extends ChatTree {
	childrenByParentId: Record<string, Exchange[]>;
}

export function buildEmptyTree(): ChatTree {
	return { rootId: null, exchanges: {} };
}

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

function validateTree(tree: ChatTree): IndexedTree {
	const exchangeList = Object.values(tree.exchanges);

	if (exchangeList.length === 0) {
		assert(tree.rootId === null, 'rootId must be null when there are no exchanges.');
		return indexTree(tree);
	}

	const roots = exchangeList.filter((exchange) => exchange.parentId === null);
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

function spliceExchange(tree: ChatTree, exchangeId: string): ChatTree {
	const exchange = requireExchange(
		tree.exchanges,
		exchangeId,
		`Cannot remove missing exchange "${exchangeId}".`
	);
	const indexed = indexTree(tree);
	const children = getChildrenFromTree(indexed, exchangeId);
	const childIds = children.map((child) => child.id);

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
				const childId = childIds[i]!;
				next[childId] = { ...next[childId]!, parentId: newRootId };
				next[newRootId] = {
					...next[newRootId]!,
					childIds: [...next[newRootId]!.childIds, childId]
				};
			}
		}
	} else {
		const parentId = exchange.parentId;
		const parent = requireExchange(tree.exchanges, parentId, `Cannot find parent "${parentId}".`);
		const removedIndex = parent.childIds.indexOf(exchangeId);
		assert(removedIndex >= 0, `Exchange "${exchangeId}" not in parent "${parentId}" childIds.`);

		const parentChildIds = parent.childIds.filter((id) => id !== exchangeId);
		for (let i = 0; i < childIds.length; i++) {
			const childId = childIds[i]!;
			next[childId] = { ...next[childId]!, parentId };
			parentChildIds.splice(removedIndex + i, 0, childId);
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

export function validateChatTree(tree: ChatTree): ChatTree {
	validateTree(tree);
	return tree;
}

export function addExchange(
	tree: ChatTree,
	parentId: string,
	prompt: string,
	model: string,
	provider: Provider,
	images?: ImageAttachment[]
): AddExchangeResult {
	const indexed = validateTree(tree);

	const id = crypto.randomUUID();
	const newExchange: Exchange = {
		id,
		parentId,
		childIds: [],
		prompt: { text: prompt, tokenCount: 0, ...(images?.length ? { images } : {}) },
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

		if (isSideExchange(indexed, parentId)) {
			assert(
				parent.childIds.length === 0,
				`Cannot add exchange: side chat "${parentId}" already has a child.`
			);
		}

		next = { ...indexed.exchanges, [id]: newExchange };
		next = attachChild(next, parentId, id);
	}

	const nextTree = { rootId: nextRootId, exchanges: next };
	validateTree(nextTree);
	return { tree: nextTree, id };
}

export function removeExchange(tree: ChatTree, exchangeId: string): DeleteResult {
	validateTree(tree);
	const nextTree = spliceExchange(tree, exchangeId);
	validateTree(nextTree);
	return { tree: nextTree, removedIds: [exchangeId] };
}

export function removeExchangeSubtree(tree: ChatTree, exchangeId: string): DeleteResult {
	validateTree(tree);
	const result = exciseSubtree(tree, exchangeId);
	validateTree(result.tree);
	return { tree: result.tree, removedIds: result.removedIds };
}

export function getExchange(tree: ChatTree, exchangeId: string): Exchange | null {
	return tree.exchanges[exchangeId] ?? null;
}

export function getChildren(tree: ChatTree, exchangeId: string): Exchange[] {
	const exchange = getExchange(tree, exchangeId);
	if (!exchange) return [];
	return exchange.childIds
		.map((id) => tree.exchanges[id])
		.filter((child): child is Exchange => child !== undefined);
}

export function getPath(tree: ChatTree, exchangeId: string): Exchange[] {
	requireExchange(
		tree.exchanges,
		exchangeId,
		`Cannot get path for missing exchange "${exchangeId}".`
	);
	return getPathToRoot(indexTree(tree), exchangeId);
}

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

export function getMainChat(tree: ChatTree): Exchange[] {
	const tailId = getMainChatTail(tree);
	return tailId ? getPath(tree, tailId) : [];
}

export function getMainChatTail(tree: ChatTree): string | null {
	const root = tree.rootId ? getExchange(tree, tree.rootId) : null;
	if (!root) return null;

	const indexed = indexTree(tree);
	let current: Exchange = root;
	while (true) {
		const children = getChildrenFromTree(indexed, current.id);
		if (children.length === 0) return current.id;
		current = children[0]!;
	}
}

export function promoteSideChatToMainChat(tree: ChatTree, exchangeId: string): { tree: ChatTree } {
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
	const promoted = { rootId: tree.rootId, exchanges: next };
	validateTree(promoted);
	return { tree: promoted };
}
