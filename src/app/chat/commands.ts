import type { ActiveModel } from '@/domain/models';
import {
	addDocumentExchangeResult,
	addExchangeResult,
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
} from '@/state';
import { cancelStreamsForExchanges, startStream } from '@/external/streams';

export interface ChatCommandDeps {
	replaceActiveTree: (tree: ChatTree) => void;
	setActiveExchangeId: (id: string | null) => void;
	copyToNewChat: (exchangeId: string) => void;
	cancelStreamsForExchanges: (ids: string[]) => void;
}

const defaultDeps: ChatCommandDeps = {
	replaceActiveTree,
	setActiveExchangeId,
	copyToNewChat: copyToNewChatAction,
	cancelStreamsForExchanges
};

export function deleteExchange(
	activeExchanges: ExchangeMap,
	deleteTargetId: string,
	deleteMode: DeleteMode,
	activeExchangeId: string | null,
	onResetMeasuredHeights?: () => void,
	deps: ChatCommandDeps = defaultDeps
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

export function promoteExchange(
	activeExchanges: ExchangeMap,
	exchangeId: string,
	onResetMeasuredHeights?: () => void,
	deps: ChatCommandDeps = defaultDeps
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

export function copyChat(exchangeId: string, deps: ChatCommandDeps = defaultDeps) {
	deps.copyToNewChat(exchangeId);
}

export function submitPrompt(
	chatId: string,
	tree: ChatTree,
	activeExchangeId: string | null,
	prompt: string,
	model: ActiveModel,
	liveDocContent?: string,
	deps: ChatCommandDeps = defaultDeps
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

export function quickAsk(
	chatId: string,
	tree: ChatTree,
	exchangeId: string,
	sourceText: string,
	model: ActiveModel,
	deps: ChatCommandDeps = defaultDeps
): { id: string; parentId: string; hasSideChildren: boolean } {
	return submitPrompt(
		chatId,
		tree,
		exchangeId,
		`Can you explain more:\n\n${sourceText}`,
		model,
		undefined,
		deps
	);
}

export function addDocToChat(
	tree: ChatTree,
	activeExchangeId: string | null,
	content: string,
	fileName: string,
	deps: ChatCommandDeps = defaultDeps
): string {
	const parentId = activeExchangeId ?? getMainChatTail(tree) ?? '';
	const result = addDocumentExchangeResult(
		tree,
		parentId,
		content,
		`${fileName} was added to chat`
	);
	deps.replaceActiveTree(result);
	deps.setActiveExchangeId(result.id);
	return result.id;
}
