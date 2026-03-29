import { getProviderForModelId, type Provider } from '@/domain/models';
import {
	canAcceptNewChat,
	canCreateSideChats,
	canPromoteSideChatToMainChat,
	findRootId,
	getChildExchanges,
	type ExchangeMap,
	type DeleteMode
} from '@/domain/tree';
import { isStreaming as isExchangeStreaming } from '@/external/streams';
import type { ExchangeNodeData } from './types';

export interface ChatQueryDeps {
	isStreaming: (exchangeId: string) => boolean;
}

const defaultDeps: ChatQueryDeps = {
	isStreaming: isExchangeStreaming
};

export function getExchangeNodeData(
	exchangeId: string,
	activeExchanges: ExchangeMap,
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
	const children = getChildExchanges(activeExchanges, exchangeId);
	const sideChildrenCount = children.length > 1 ? children.length - 1 : 0;
	const hasSideChildren = canCreateSideChats(activeExchanges, exchangeId) && sideChildrenCount > 0;
	const isSideRoot = exchange.parentId
		? (getChildExchanges(activeExchanges, exchange.parentId)[0]?.id ?? null) !== exchangeId
		: false;
	return {
		prompt: exchange.prompt.text,
		response: exchange.response?.text ?? '',
		model: exchange.model,
		provider: (exchange.provider as Provider) || getProviderForModelId(exchange.model) || null,
		label: exchange.label,
		isActive: activeExchangeId === exchangeId,
		isStreaming: deps.isStreaming(exchangeId),
		hasSideChildren,
		sideChildrenCount,
		isSideRoot,
		canCreateSideChat: canCreateSideChats(activeExchanges, exchangeId),
		canPromote: canPromoteSideChatToMainChat(
			{ rootId: findRootId(activeExchanges), exchanges: activeExchanges },
			exchangeId
		),
		canQuickAsk: canAcceptNewChat(activeExchanges, exchangeId),
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

export function getDeleteMode(activeExchanges: ExchangeMap, exchangeId: string): DeleteMode {
	const children = getChildExchanges(activeExchanges, exchangeId);
	return children.length > 1 ? 'exchangeAndSideChats' : 'exchange';
}
