import * as domain from '@/domain';
import * as chat from '@/app/chat';

export type Exchange = domain.tree.Exchange;
export type ChatTree = domain.tree.ChatTree;

export function getHiddenExchangeIds(tree: ChatTree, expandedParentId: string | null): Set<string> {
	const hidden = new Set<string>();

	for (const exchange of Object.values(tree.exchanges)) {
		if (exchange.childIds.length <= 1 || exchange.id === expandedParentId) continue;
		for (const childId of exchange.childIds.slice(1)) {
			hideSubtree(tree, childId, hidden);
		}
	}

	return hidden;
}

function hideSubtree(tree: ChatTree, exchangeId: string, hidden: Set<string>) {
	const exchange = tree.exchanges[exchangeId];
	if (!exchange) return;
	hidden.add(exchangeId);
	for (const childId of exchange.childIds) {
		hideSubtree(tree, childId, hidden);
	}
}

export function isSideRoot(tree: ChatTree, exchangeId: string): boolean {
	const exchange = tree.exchanges[exchangeId];
	if (!exchange?.parentId) return false;
	const parent = tree.exchanges[exchange.parentId];
	return !!parent && (parent.childIds[0] ?? null) !== exchangeId;
}

export function getExpandedParentFromSelection(
	tree: ChatTree,
	activeExchangeId: string | null
): string | null {
	if (!activeExchangeId) return null;
	const path = domain.tree.getPath(tree, activeExchangeId);

	for (let index = 1; index < path.length; index += 1) {
		const parent = path[index - 1];
		const child = path[index];
		if (!parent || !child) continue;
		if ((parent.childIds[0] ?? null) === child.id) continue;
		return parent.id;
	}

	return null;
}

export function getSideChatIndexFromSelection(
	tree: ChatTree,
	parentExchangeId: string,
	activeExchangeId: string | null
): number {
	const sideChats = chat.getSideChats(tree, parentExchangeId);
	if (!activeExchangeId || sideChats.length === 0) return 0;

	const matchIndex = sideChats.findIndex((sideChat) =>
		sideChat.some((exchange) => exchange.id === activeExchangeId)
	);

	return matchIndex >= 0 ? matchIndex : 0;
}

export function getDeleteMode(tree: ChatTree, exchangeId: string): chat.DeleteMode {
	const exchange = tree.exchanges[exchangeId];
	if (!exchange) return 'exchange';
	return exchange.childIds.length > 1 ? 'exchangeAndSideChats' : 'exchange';
}
