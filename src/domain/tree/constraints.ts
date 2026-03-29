import { getChildren, getPath, type ChatTree } from './core';

function isInSideChat(tree: ChatTree, exchangeId: string): boolean {
	const path = getPath(tree, exchangeId);
	for (let i = 1; i < path.length; i++) {
		const current = path[i]!;
		const parent = path[i - 1]!;
		if ((getChildren(tree, parent.id)[0]?.id ?? null) !== current.id) {
			return true;
		}
	}
	return false;
}

function hasSplitDescendant(tree: ChatTree, exchangeId: string): boolean {
	const queue = [exchangeId];
	while (queue.length > 0) {
		const currentId = queue.shift()!;
		const children = getChildren(tree, currentId);
		if (children.length > 1) return true;
		for (const child of children) queue.push(child.id);
	}
	return false;
}

export function canCreateSideChats(tree: ChatTree, exchangeId: string): boolean {
	if (isInSideChat(tree, exchangeId)) return false;
	return getChildren(tree, exchangeId).length > 0;
}

export function canAcceptNewChat(tree: ChatTree, exchangeId: string): boolean {
	if (canCreateSideChats(tree, exchangeId)) return true;
	return getChildren(tree, exchangeId).length === 0;
}

export function canPromoteSideChatToMainChat(tree: ChatTree, exchangeId: string): boolean {
	const path = getPath(tree, exchangeId);
	const exchange = path[path.length - 1];
	const parent = path[path.length - 2];
	if (!exchange || !parent) return false;

	const siblings = getChildren(tree, parent.id);
	const index = siblings.findIndex((sibling) => sibling.id === exchangeId);
	if (index <= 0) return false;

	const mainChild = siblings[0];
	if (!mainChild) return false;
	return !hasSplitDescendant(tree, mainChild.id);
}
