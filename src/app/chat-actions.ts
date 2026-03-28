import { getProviderForModelId, type ActiveModel, type Provider } from '@/domain/models';
import type { ExchangeNodeData } from './types';
import {
	addDocumentExchangeResult,
	addExchangeResult,
	canAcceptNewChat,
	canCreateSideChats,
	canPromoteSideChatToMainChat,
	deleteExchangeWithModeResult,
	findRootId,
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
	copyToNewChat as copyToNewChatAction
} from '@/state/chats.svelte';
import {
	isStreaming as isExchangeStreaming,
	cancelStreamsForExchanges,
	startStream
} from '@/state/services/streams';

// ── Dependency interface for testability ─────────────────────────────────────

export interface ChatActionDeps {
	replaceActiveTree: (tree: ChatTree) => void;
	setActiveExchangeId: (id: string | null) => void;
	copyToNewChat: (exchangeId: string) => void;
	isStreaming: (exchangeId: string) => boolean;
	cancelStreamsForExchanges: (ids: string[]) => void;
}

const defaultDeps: ChatActionDeps = {
	replaceActiveTree,
	setActiveExchangeId,
	copyToNewChat: copyToNewChatAction,
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
		onCopy: (exchangeId: string) => void;
		onToggleSideChildren: (exchangeId: string) => void;
		onPromote: (exchangeId: string) => void;
		onDelete: (exchangeId: string) => void;
		onQuickAsk?: (exchangeId: string, sourceText: string) => void;
	},
	deps: ChatActionDeps = defaultDeps
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
		onMeasure: (height: number) => callbacks.onMeasure?.(exchangeId, height),
		onSelect: () => callbacks.onSelect(exchangeId),
		onCopy: () => callbacks.onCopy(exchangeId),
		onToggleSideChildren: () => callbacks.onToggleSideChildren(exchangeId),
		onPromote: () => callbacks.onPromote(exchangeId),
		onDelete: () => callbacks.onDelete(exchangeId),
		onQuickAsk: (sourceText: string) => callbacks.onQuickAsk?.(exchangeId, sourceText)
	};
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

export function performCopy(exchangeId: string, deps: ChatActionDeps = defaultDeps) {
	deps.copyToNewChat(exchangeId);
}

export function getDeleteMode(activeExchanges: ExchangeMap, exchangeId: string): DeleteMode {
	const children = getChildExchanges(activeExchanges, exchangeId);
	return children.length > 1 ? 'exchangeAndSideChats' : 'exchange';
}

export function performSubmitPrompt(
	chatId: string,
	tree: ChatTree,
	activeExchangeId: string | null,
	prompt: string,
	model: ActiveModel,
	liveDocContent?: string,
	deps: ChatActionDeps = defaultDeps
): { id: string; parentId: string; hasSideChildren: boolean } {
	const parentId = activeExchangeId ?? getMainChatTail(tree) ?? '';
	const hasSideChildren =
		activeExchangeId !== null && getChildExchanges(tree.exchanges, activeExchangeId).length > 0;

	const created = addExchangeResult(tree, parentId, prompt, model.modelId, model.provider);

	deps.replaceActiveTree(created);
	deps.setActiveExchangeId(created.id);

	startStream({
		exchangeId: created.id,
		chatId,
		model,
		tree: created,
		liveDocContent
	});

	return { id: created.id, parentId, hasSideChildren };
}

export function performQuickAsk(
	chatId: string,
	tree: ChatTree,
	exchangeId: string,
	sourceText: string,
	model: ActiveModel,
	deps: ChatActionDeps = defaultDeps
): { id: string; parentId: string; hasSideChildren: boolean } {
	return performSubmitPrompt(
		chatId,
		tree,
		exchangeId,
		`Can you explain more:\n\n${sourceText}`,
		model,
		undefined,
		deps
	);
}

export function performAddDocToChat(
	tree: ChatTree,
	activeExchangeId: string | null,
	content: string,
	fileName: string,
	deps: ChatActionDeps = defaultDeps
): string {
	const parentId = activeExchangeId ?? getMainChatTail(tree) ?? '';
	const result = addDocumentExchangeResult(tree, parentId, content, `Added ${fileName} to chat`);
	deps.replaceActiveTree(result);
	deps.setActiveExchangeId(result.id);
	return result.id;
}
