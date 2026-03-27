import { getProviderForModelId, type Provider } from '@/lib/models';
import type { ExchangeNodeData } from '@/views/shared/types';
import {
	canCreateSideChats,
	canPromoteSideChatToMainChat,
	deleteExchangeWithModeResult,
	getChildExchanges,
	getMainChatTail,
	promoteSideChatToMainChat,
	type DeleteMode,
	type ExchangeMap
} from '@/domain/tree';
import {
	replaceActiveTree,
	setActiveExchangeId,
	forkChat as forkChatAction
} from '@/state/chats.svelte';
import { isStreaming as isExchangeStreaming, cancelStreamsForExchanges } from '@/services/streams';

export function getExchangeNodeData(
	exchangeId: string,
	activeExchanges: ExchangeMap,
	activeExchangeId: string | null,
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
		if (!exchange || exchange.parentId === null) return null;
		const children = getChildExchanges(activeExchanges, exchangeId);
		const sideChildrenCount = children.length > 1 ? children.length - 1 : 0;
		const hasSideChildren =
			canCreateSideChats(activeExchanges, exchangeId) && sideChildrenCount > 0;
		const isSideRoot = exchange.parentId
			? (getChildExchanges(activeExchanges, exchange.parentId)[0]?.id ?? null) !== exchangeId
			: false;

		return {
			prompt: exchange.prompt.text,
			response: exchange.response?.text ?? '',
			model: exchange.model,
			provider:
				(exchange.provider as Provider) ||
				getProviderForModelId(exchange.model) ||
				null,
			isActive: activeExchangeId === exchangeId,
			isStreaming: isExchangeStreaming(exchangeId),
			canFork: true,
			hasSideChildren,
			sideChildrenCount,
			isSideRoot,
			canPromote: canPromoteSideChatToMainChat(
				{ rootId: findRootId(activeExchanges), exchanges: activeExchanges },
				exchangeId
			),
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
		const tree = { rootId: findRootId(activeExchanges), exchanges: activeExchanges };
		const result = deleteExchangeWithModeResult(tree, deleteTargetId, deleteMode);
		cancelStreamsForExchanges(result.removedExchangeIds);
		onResetMeasuredHeights?.();
		replaceActiveTree(result);
		if (deleteTargetId === activeExchangeId || !result.exchanges[activeExchangeId ?? '']) {
			setActiveExchangeId(getMainChatTail(result));
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
		const tree = { rootId: findRootId(activeExchanges), exchanges: activeExchanges };
		const result = promoteSideChatToMainChat(tree, exchangeId);
		replaceActiveTree(result);
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
	exchangeId: string
): DeleteMode {
	const children = getChildExchanges(activeExchanges, exchangeId);
	return children.length > 1 ? 'exchangeAndSideChats' : 'exchange';
}

function findRootId(exchanges: ExchangeMap): string | null {
	for (const exchange of Object.values(exchanges)) {
		if (exchange.parentId === null) return exchange.id;
	}
	return null;
}
