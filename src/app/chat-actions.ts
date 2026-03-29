import type { ActiveModel } from '@/domain/models';
import type { ChatTree, DeleteMode, ExchangeMap } from '@/domain/tree';
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
	activeExchanges: ExchangeMap,
	deleteTargetId: string,
	deleteMode: DeleteMode,
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
	activeExchanges: ExchangeMap,
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
	tree: ChatTree,
	activeExchangeId: string | null,
	prompt: string,
	model: ActiveModel,
	liveDocContent?: string,
	deps?: ChatActionDeps
): { id: string; parentId: string; hasSideChildren: boolean } {
	return submitPrompt(chatId, tree, activeExchangeId, prompt, model, liveDocContent, deps);
}

export function performQuickAsk(
	chatId: string,
	tree: ChatTree,
	exchangeId: string,
	sourceText: string,
	model: ActiveModel,
	deps?: ChatActionDeps
): { id: string; parentId: string; hasSideChildren: boolean } {
	return quickAsk(chatId, tree, exchangeId, sourceText, model, deps);
}

export function performAddDocToChat(
	tree: ChatTree,
	activeExchangeId: string | null,
	content: string,
	fileName: string,
	deps?: ChatActionDeps
): string {
	return addDocToChat(tree, activeExchangeId, content, fileName, deps);
}

export { getDeleteMode, getExchangeNodeData };
export type { ExchangeNodeData };
