import * as domain from '@/domain';
import * as external from '@/external';
import type { ExchangeNodeData } from './types';

export interface ChatQueryDeps {
	isStreaming: (exchangeId: string) => boolean;
}

const defaultDeps: ChatQueryDeps = {
	isStreaming: external.streams.isStreaming
};

export function getExchangeNodeData(
	exchangeId: string,
	activeExchanges: domain.tree.ExchangeMap,
	activeExchangeId: string | null,
	callbacks: {
		onMeasure?: (exchangeId: string, height: number) => void;
		onSelect: (exchangeId: string) => void;
		onCopy: (exchangeId: string) => void;
		onToggleSideChildren: (exchangeId: string) => void;
		onPromote: (exchangeId: string) => void;
		onDelete: (exchangeId: string) => void;
		onQuickAsk?: (exchangeId: string, sourceText: string) => void;
		onQuickAdd?: (sourceText: string) => void;
	},
	deps: ChatQueryDeps = defaultDeps
): ExchangeNodeData | null {
	const exchange = activeExchanges[exchangeId];
	if (!exchange) return null;
	const children = domain.tree.getChildExchanges(activeExchanges, exchangeId);
	const sideChildrenCount = children.length > 1 ? children.length - 1 : 0;
	const hasSideChildren =
		domain.tree.canCreateSideChats(activeExchanges, exchangeId) && sideChildrenCount > 0;
	const isSideRoot = exchange.parentId
		? (domain.tree.getChildExchanges(activeExchanges, exchange.parentId)[0]?.id ?? null) !==
			exchangeId
		: false;
	return {
		prompt: exchange.prompt.text,
		response: exchange.response?.text ?? '',
		model: exchange.model,
		provider:
			(exchange.provider as domain.models.Provider) ||
			domain.models.getProviderForModelId(exchange.model) ||
			null,
		label: exchange.label,
		isActive: activeExchangeId === exchangeId,
		isStreaming: deps.isStreaming(exchangeId),
		hasSideChildren,
		sideChildrenCount,
		isSideRoot,
		canCreateSideChat: domain.tree.canCreateSideChats(activeExchanges, exchangeId),
		canPromote: domain.tree.canPromoteSideChatToMainChat(
			{ rootId: domain.tree.findRootId(activeExchanges), exchanges: activeExchanges },
			exchangeId
		),
		canQuickAsk: domain.tree.canAcceptNewChat(activeExchanges, exchangeId),
		canQuickAdd: !!callbacks.onQuickAdd,
		onMeasure: (height: number) => callbacks.onMeasure?.(exchangeId, height),
		onSelect: () => callbacks.onSelect(exchangeId),
		onCopy: () => callbacks.onCopy(exchangeId),
		onToggleSideChildren: () => callbacks.onToggleSideChildren(exchangeId),
		onPromote: () => callbacks.onPromote(exchangeId),
		onDelete: () => callbacks.onDelete(exchangeId),
		onQuickAsk: (sourceText: string) => callbacks.onQuickAsk?.(exchangeId, sourceText),
		onQuickAdd: (sourceText: string) => callbacks.onQuickAdd?.(sourceText)
	};
}

export function getDeleteMode(
	activeExchanges: domain.tree.ExchangeMap,
	exchangeId: string
): domain.tree.DeleteMode {
	const children = domain.tree.getChildExchanges(activeExchanges, exchangeId);
	return children.length > 1 ? 'exchangeAndSideChats' : 'exchange';
}
