import type * as domain from '@/domain';
import {
	addDocToChat,
	copyChat,
	deleteExchange,
	promoteExchange,
	quickAsk,
	submitPrompt,
	type ChatCommandDeps
} from '@/app/chat/commands';
import { getDeleteMode, getExchangeNodeData, type ChatQueryDeps } from '@/app/chat/queries';
import type { ExchangeNodeData } from '@/app/chat/types';

export interface ChatActionDeps extends ChatCommandDeps, ChatQueryDeps {}

export function performDelete(
	activeExchanges: domain.tree.ExchangeMap,
	deleteTargetId: string,
	deleteMode: domain.tree.DeleteMode,
	activeExchangeId: string | null,
	onResetMeasuredHeights?: () => void,
	deps?: ChatActionDeps
): { error: string | null } {
	return deleteExchange(
		activeExchanges,
		deleteTargetId,
		deleteMode,
		activeExchangeId,
		onResetMeasuredHeights,
		deps
	);
}

export function performPromote(
	activeExchanges: domain.tree.ExchangeMap,
	exchangeId: string,
	onResetMeasuredHeights?: () => void,
	deps?: ChatActionDeps
): { error: string | null } {
	return promoteExchange(activeExchanges, exchangeId, onResetMeasuredHeights, deps);
}

export function performCopy(exchangeId: string, deps?: ChatActionDeps) {
	return copyChat(exchangeId, deps);
}

export function performSubmitPrompt(
	chatId: string,
	tree: domain.tree.ChatTree,
	activeExchangeId: string | null,
	prompt: string,
	model: domain.models.ActiveModel,
	liveDocContent?: string,
	deps?: ChatActionDeps
): { id: string; parentId: string; hasSideChildren: boolean } {
	return submitPrompt(chatId, tree, activeExchangeId, prompt, model, liveDocContent, deps);
}

export function performQuickAsk(
	chatId: string,
	tree: domain.tree.ChatTree,
	exchangeId: string,
	sourceText: string,
	model: domain.models.ActiveModel,
	deps?: ChatActionDeps
): { id: string; parentId: string; hasSideChildren: boolean } {
	return quickAsk(chatId, tree, exchangeId, sourceText, model, deps);
}

export function performAddDocToChat(
	tree: domain.tree.ChatTree,
	activeExchangeId: string | null,
	content: string,
	fileName: string,
	deps?: ChatActionDeps
): string {
	return addDocToChat(tree, activeExchangeId, content, fileName, deps);
}

export { getDeleteMode, getExchangeNodeData };
export type { ExchangeNodeData };
