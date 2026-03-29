import * as domain from '@/domain';
import * as state from '@/state';
import * as external from '@/external';

export interface ChatCommandDeps {
	replaceActiveTree: (tree: domain.tree.ChatTree) => void;
	setActiveExchangeId: (id: string | null) => void;
	copyToNewChat: (exchangeId: string) => void;
	cancelStreamsForExchanges: (ids: string[]) => void;
}

const defaultDeps: ChatCommandDeps = {
	replaceActiveTree: state.chats.replaceActiveTree,
	setActiveExchangeId: state.chats.setActiveExchangeId,
	copyToNewChat: state.chats.copyToNewChat,
	cancelStreamsForExchanges: external.streams.cancelStreamsForExchanges
};

export function deleteExchange(
	activeExchanges: domain.tree.ExchangeMap,
	deleteTargetId: string,
	deleteMode: domain.tree.DeleteMode,
	activeExchangeId: string | null,
	onResetMeasuredHeights?: () => void,
	deps: ChatCommandDeps = defaultDeps
): { error: string | null } {
	try {
		const tree = { rootId: domain.tree.findRootId(activeExchanges), exchanges: activeExchanges };
		const result = domain.tree.deleteExchangeWithModeResult(tree, deleteTargetId, deleteMode);
		deps.cancelStreamsForExchanges(result.removedExchangeIds);
		onResetMeasuredHeights?.();
		deps.replaceActiveTree(result);
		if (deleteTargetId === activeExchangeId || !result.exchanges[activeExchangeId ?? '']) {
			deps.setActiveExchangeId(domain.tree.getMainChatTail(result));
		}
		return { error: null };
	} catch (error) {
		return { error: error instanceof Error ? error.message : 'Unable to delete exchange.' };
	}
}

export function promoteExchange(
	activeExchanges: domain.tree.ExchangeMap,
	exchangeId: string,
	onResetMeasuredHeights?: () => void,
	deps: ChatCommandDeps = defaultDeps
): { error: string | null } {
	try {
		const tree = { rootId: domain.tree.findRootId(activeExchanges), exchanges: activeExchanges };
		const result = domain.tree.promoteSideChatToMainChat(tree, exchangeId);
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
	tree: domain.tree.ChatTree,
	activeExchangeId: string | null,
	prompt: string,
	model: domain.models.ActiveModel,
	liveDocContent?: string,
	deps: ChatCommandDeps = defaultDeps
): { id: string; parentId: string; hasSideChildren: boolean } {
	const parentId = activeExchangeId ?? domain.tree.getMainChatTail(tree) ?? '';
	const hasSideChildren =
		activeExchangeId !== null &&
		domain.tree.getChildExchanges(tree.exchanges, activeExchangeId).length > 0;

	const created = domain.tree.addExchangeResult(
		tree,
		parentId,
		prompt,
		model.modelId,
		model.provider
	);

	deps.replaceActiveTree(created);
	deps.setActiveExchangeId(created.id);

	external.streams.startStream({
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
	tree: domain.tree.ChatTree,
	exchangeId: string,
	sourceText: string,
	model: domain.models.ActiveModel,
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
	tree: domain.tree.ChatTree,
	activeExchangeId: string | null,
	content: string,
	fileName: string,
	deps: ChatCommandDeps = defaultDeps
): string {
	const parentId = activeExchangeId ?? domain.tree.getMainChatTail(tree) ?? '';
	const result = domain.tree.addDocumentExchangeResult(
		tree,
		parentId,
		content,
		`${fileName} was added to chat`
	);
	deps.replaceActiveTree(result);
	deps.setActiveExchangeId(result.id);
	return result.id;
}
