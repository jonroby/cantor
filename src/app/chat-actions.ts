import { getProviderForModelId, type Provider } from '@/domain/models';
import type { ExchangeNodeData } from './types';
import {
	canCreateSideChats,
	canPromoteSideChatToMainChat,
	deleteExchangeWithModeResult,
	getChildExchanges,
	getMainChatTail,
	promoteSideChatToMainChat,
	type ChatTree,
	type DeleteMode,
	type ExchangeMap
} from '@/domain/tree';
import {
	replaceActiveTree,
	setActiveExchangeId,
	forkChat as forkChatAction
} from '@/state/chats.svelte';
import { isStreaming as isExchangeStreaming, cancelStreamsForExchanges } from '@/state/services/streams';

// ── Dependency interface for testability ─────────────────────────────────────

export interface ChatActionDeps {
	replaceActiveTree: (tree: ChatTree) => void;
	setActiveExchangeId: (id: string | null) => void;
	forkChat: (exchangeId: string) => void;
	isStreaming: (exchangeId: string) => boolean;
	cancelStreamsForExchanges: (ids: string[]) => void;
}

const defaultDeps: ChatActionDeps = {
	replaceActiveTree,
	setActiveExchangeId,
	forkChat: forkChatAction,
	isStreaming: isExchangeStreaming,
	cancelStreamsForExchanges
};

// ── Public API ───────────────────────────────────────────────────────────────

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
	},
	deps: ChatActionDeps = defaultDeps
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
			provider: (exchange.provider as Provider) || getProviderForModelId(exchange.model) || null,
			isActive: activeExchangeId === exchangeId,
			isStreaming: deps.isStreaming(exchangeId),
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
	onResetMeasuredHeights?: () => void,
	deps: ChatActionDeps = defaultDeps
): { error: string | null } {
	try {
		const tree = { rootId: findRootId(activeExchanges), exchanges: activeExchanges };
		const result = deleteExchangeWithModeResult(tree, deleteTargetId, deleteMode);
		deps.cancelStreamsForExchanges(result.removedExchangeIds);
		onResetMeasuredHeights?.();
		deps.replaceActiveTree(result);
		if (deleteTargetId === activeExchangeId || !result.exchanges[activeExchangeId ?? '']) {
			deps.setActiveExchangeId(getMainChatTail(result));
		}
		return { error: null };
	} catch (error) {
		return { error: error instanceof Error ? error.message : 'Unable to delete exchange.' };
	}
}

export function performPromote(
	activeExchanges: ExchangeMap,
	exchangeId: string,
	onResetMeasuredHeights?: () => void,
	deps: ChatActionDeps = defaultDeps
): { error: string | null } {
	try {
		const tree = { rootId: findRootId(activeExchanges), exchanges: activeExchanges };
		const result = promoteSideChatToMainChat(tree, exchangeId);
		deps.setActiveExchangeId(exchangeId);
		onResetMeasuredHeights?.();
		deps.replaceActiveTree(result);
		return { error: null };
	} catch (error) {
		return { error: error instanceof Error ? error.message : 'Unable to promote exchange.' };
	}
}

export function performFork(exchangeId: string, deps: ChatActionDeps = defaultDeps) {
	deps.forkChat(exchangeId);
}

export function getDeleteMode(activeExchanges: ExchangeMap, exchangeId: string): DeleteMode {
	const children = getChildExchanges(activeExchanges, exchangeId);
	return children.length > 1 ? 'exchangeAndSideChats' : 'exchange';
}

function findRootId(exchanges: ExchangeMap): string | null {
	for (const exchange of Object.values(exchanges)) {
		if (exchange.parentId === null) return exchange.id;
	}
	return null;
}
