import { getProviderForModelId, type Provider } from '@/lib/models';
import type { ExchangeNodeData } from '@/features/canvas/ExchangeNode.svelte';
import {
	buildExchangesByParentId,
	canCreateSideChats,
	canPromoteSideChatToMainChat,
	deleteExchangeWithModeResult,
	getChildExchanges,
	getMainChatTail,
	promoteSideChatToMainChat,
	type DeleteMode,
	type ExchangeMap,
	type ExchangesByParentId
} from '@/domain/tree';
import {
	replaceActiveExchanges,
	setActiveExchangeId,
	forkChat as forkChatAction
} from '@/state/chats.svelte';
import { isStreaming as isExchangeStreaming, cancelStreamsForExchanges } from '@/services/streams';

export interface ChatOpsCallbacks {
	onScrollToNode: (nodeId: string | null) => void;
	onResetMeasuredHeights?: () => void;
	onExpandSideChat?: (parentId: string) => void;
}

export function getExchangeNodeData(
	exchangeId: string,
	activeExchanges: ExchangeMap,
	activeExchangeId: string | null,
	exchangesByParentId: ExchangesByParentId,
	callbacks: {
		onMeasure?: (exchangeId: string, height: number) => void;
		onSelect: (exchangeId: string) => void;
		onFork: (exchangeId: string) => void;
		onToggleSideChildren: (exchangeId: string) => void;
		onPromote: (exchangeId: string) => void;
		onDelete: (exchangeId: string) => void;
	}
): ExchangeNodeData | null {
	try {
		const exchange = activeExchanges[exchangeId];
		if (!exchange) return null;
		const children = getChildExchanges(activeExchanges, exchangeId, exchangesByParentId);
		const sideChildrenCount = children.length > 1 ? children.length - 1 : 0;
		const hasSideChildren =
			canCreateSideChats(activeExchanges, exchangeId, exchangesByParentId) && sideChildrenCount > 0;
		const isSideRoot = exchange.parentId
			? (getChildExchanges(activeExchanges, exchange.parentId, exchangesByParentId)[0]?.id ??
					null) !== exchangeId
			: false;

		return {
			prompt: exchange.prompt,
			response: exchange.response,
			model: exchange.model,
			provider:
				(exchange.provider as Provider) ??
				(exchange.model ? getProviderForModelId(exchange.model) : null),
			isActive: activeExchangeId === exchangeId,
			isStreaming: isExchangeStreaming(exchangeId),
			canFork: true,
			hasSideChildren,
			sideChildrenCount,
			isSideRoot,
			canPromote: canPromoteSideChatToMainChat(activeExchanges, exchangeId, exchangesByParentId),
			onMeasure: (height: number) => callbacks.onMeasure?.(exchangeId, height),
			onSelect: () => callbacks.onSelect(exchangeId),
			onFork: () => callbacks.onFork(exchangeId),
			onToggleSideChildren: () => callbacks.onToggleSideChildren(exchangeId),
			onPromote: () => callbacks.onPromote(exchangeId),
			onDelete: () => callbacks.onDelete(exchangeId)
		};
	} catch (error) {
		console.error(`Failed to render exchange "${exchangeId}":`, error);
		return null;
	}
}

export function performDelete(
	activeExchanges: ExchangeMap,
	deleteTargetId: string,
	deleteMode: DeleteMode,
	activeExchangeId: string | null,
	onResetMeasuredHeights?: () => void
): { error: string | null } {
	try {
		const result = deleteExchangeWithModeResult(activeExchanges, deleteTargetId, deleteMode);
		cancelStreamsForExchanges(result.removedExchangeIds);
		onResetMeasuredHeights?.();
		replaceActiveExchanges(result.exchanges);
		if (deleteTargetId === activeExchangeId || !result.exchanges[activeExchangeId ?? '']) {
			setActiveExchangeId(getMainChatTail(result.exchanges));
		}
		return { error: null };
	} catch (error) {
		return { error: error instanceof Error ? error.message : 'Unable to delete exchange.' };
	}
}

export function performPromote(
	activeExchanges: ExchangeMap,
	exchangeId: string,
	onResetMeasuredHeights?: () => void
): { error: string | null } {
	try {
		setActiveExchangeId(exchangeId);
		onResetMeasuredHeights?.();
		replaceActiveExchanges(promoteSideChatToMainChat(activeExchanges, exchangeId));
		return { error: null };
	} catch (error) {
		return { error: error instanceof Error ? error.message : 'Unable to promote exchange.' };
	}
}

export function performFork(exchangeId: string) {
	forkChatAction(exchangeId);
}

export function getDeleteMode(
	activeExchanges: ExchangeMap,
	exchangeId: string,
	exchangesByParentId: ExchangesByParentId
): DeleteMode {
	const children = getChildExchanges(activeExchanges, exchangeId, exchangesByParentId);
	return children.length > 1 ? 'exchangeAndSideChats' : 'exchange';
}

export {
	buildExchangesByParentId,
	getChildExchanges,
	getMainChatTail,
	type DeleteMode,
	type ExchangeMap,
	type ExchangesByParentId
};
