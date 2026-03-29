import * as domain from '@/domain';
import * as state from '@/state';
import * as external from '@/external';
import type { ExchangeCardData } from './types';

export interface ChatTransferFeedback {
	success?: (message: string) => void;
	error?: (message: string) => void;
}

const NOOP_FEEDBACK: ChatTransferFeedback = {};

export interface ChatActionDeps {
	replaceActiveTree: (tree: domain.tree.ChatTree) => void;
	setActiveExchangeId: (id: string | null) => void;
	copyToNewChat: (exchangeId: string) => void;
	cancelStreamsForExchanges: (ids: string[]) => void;
	isStreaming: (exchangeId: string) => boolean;
}

const defaultDeps: ChatActionDeps = {
	replaceActiveTree: state.chats.replaceActiveTree,
	setActiveExchangeId: state.chats.setActiveExchangeId,
	copyToNewChat: state.chats.copyToNewChat,
	cancelStreamsForExchanges: external.streams.cancelStreamsForExchanges,
	isStreaming: external.streams.isStreaming
};

export * from './types';

export const getChats = () => state.chats.chatState.chats;
export const getActiveChatIndex = () => state.chats.chatState.activeChatIndex;
export const getChat = () => state.chats.getActiveChat();
export const getActiveExchangeId = () => state.chats.getActiveExchangeId();

export const createChat = state.chats.newChat;
export const selectChat = state.chats.selectChat;
export const removeChat = state.chats.deleteChat;

export function renameChat(index: number, name: string): string | null {
	const trimmed = name.trim();
	if (!trimmed) return null;

	let candidate = trimmed;
	let i = 1;
	while (!state.chats.renameChat(index, candidate)) {
		candidate = `${trimmed} (${i})`;
		i++;
	}
	return candidate;
}

export const selectExchange = state.chats.setActiveExchangeId;
export const isStreaming = external.streams.isStreaming;
export const stopStream = external.streams.cancelStream;
export const stopChatStreams = external.streams.cancelStreamsForChat;

export function getMainChat(chat: domain.tree.Chat): domain.tree.Exchange[] {
	const tree = { rootId: chat.rootId, exchanges: chat.exchanges };
	const root = domain.tree.getRootExchange(tree);
	if (!root) return [];

	const path: domain.tree.Exchange[] = [root];
	let currentId: string | null = root.id;
	while (currentId) {
		const children = domain.tree.getChildExchanges(tree.exchanges, currentId);
		if (children.length === 0) break;
		const mainChild = children[0]!;
		path.push(mainChild);
		currentId = mainChild.id;
	}
	return path;
}

export function getSideChats(
	activeExchanges: domain.tree.ExchangeMap,
	parentExchangeId: string
): domain.tree.Exchange[][] {
	const children = domain.tree.getChildExchanges(activeExchanges, parentExchangeId);
	if (children.length <= 1) return [];

	const sideChats: domain.tree.Exchange[][] = [];
	for (let i = 1; i < children.length; i++) {
		const sideChat: domain.tree.Exchange[] = [];
		let current: domain.tree.Exchange | undefined = children[i];
		while (current) {
			sideChat.push(current);
			current = domain.tree.getChildExchanges(activeExchanges, current.id)[0];
		}
		sideChats.push(sideChat);
	}
	return sideChats;
}

export function canSubmitPrompt(
	activeExchanges: domain.tree.ExchangeMap,
	activeExchangeId: string
): boolean {
	return domain.tree.canAcceptNewChat(activeExchanges, activeExchangeId);
}

export function getUsedTokens(
	activeExchanges: domain.tree.ExchangeMap,
	activeExchangeId: string
): number {
	return domain.tree.getPathTokenTotal(activeExchanges, activeExchangeId);
}

export function hasSideChats(
	activeExchanges: domain.tree.ExchangeMap,
	exchangeId: string
): boolean {
	return domain.tree.getChildExchanges(activeExchanges, exchangeId).length > 1;
}

export function getExchangeCardData(
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
	deps: Pick<ChatActionDeps, 'isStreaming'> = defaultDeps
): ExchangeCardData | null {
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
			external.providers.catalog.getProviderForModelId(exchange.model) ||
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
	return hasSideChats(activeExchanges, exchangeId) ? 'exchangeAndSideChats' : 'exchange';
}

export function deleteExchange(
	activeExchanges: domain.tree.ExchangeMap,
	deleteTargetId: string,
	deleteMode: domain.tree.DeleteMode,
	activeExchangeId: string | null,
	onResetMeasuredHeights?: () => void,
	deps: Omit<ChatActionDeps, 'isStreaming'> = defaultDeps
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
	deps: Omit<ChatActionDeps, 'isStreaming'> = defaultDeps
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

export function copyChat(exchangeId: string, deps: Pick<ChatActionDeps, 'copyToNewChat'> = defaultDeps) {
	deps.copyToNewChat(exchangeId);
}

export function submitPrompt(
	chatId: string,
	tree: domain.tree.ChatTree,
	activeExchangeId: string | null,
	prompt: string,
	model: domain.models.ActiveModel,
	liveDocContent?: string,
	deps: Omit<ChatActionDeps, 'isStreaming'> = defaultDeps
): { id: string; parentId: string; hasSideChildren: boolean } {
	const parentId = activeExchangeId ?? domain.tree.getMainChatTail(tree) ?? '';
	const hasSideChildren =
		activeExchangeId !== null && domain.tree.getChildExchanges(tree.exchanges, activeExchangeId).length > 0;

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
	deps: Omit<ChatActionDeps, 'isStreaming'> = defaultDeps
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

export function addDocumentToChat(
	tree: domain.tree.ChatTree,
	activeExchangeId: string | null,
	content: string,
	fileName: string,
	deps: Omit<ChatActionDeps, 'isStreaming'> = defaultDeps
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

export function exportState() {
	const payload = JSON.stringify(
		{
			chats: state.chats.chatState.chats,
			activeChatIndex: state.chats.chatState.activeChatIndex,
			folders: state.documents.docState.folders
		},
		null,
		2
	);
	const blob = new Blob([payload], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = `chat-tree-${Date.now()}.json`;
	link.click();
	URL.revokeObjectURL(url);
}

export function exportChat(index: number) {
	const chat = state.chats.chatState.chats[index];
	const payload = JSON.stringify(chat, null, 2);
	const blob = new Blob([payload], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = `${chat.name.replace(/[^a-zA-Z0-9-_ ]/g, '')}.json`;
	link.click();
	URL.revokeObjectURL(url);
}

export function importChat(feedback: ChatTransferFeedback = NOOP_FEEDBACK): void {
	const input = document.createElement('input');
	input.type = 'file';
	input.accept = '.json';
	input.onchange = async () => {
		const file = input.files?.[0];
		if (!file) return;
		try {
			const text = await file.text();
			const data = JSON.parse(text);
			const chat = external.files.validateChatUpload(data);
			chat.id = crypto.randomUUID();
			const baseName = file.name.replace(/\.json$/i, '');
			chat.name = external.files.deduplicateName(
				baseName,
				state.chats.chatState.chats.map((c) => c.name)
			);
			state.chats.chatState.chats = [...state.chats.chatState.chats, chat];
			state.chats.chatState.activeChatIndex = state.chats.chatState.chats.length - 1;
			feedback.success?.(`Imported "${chat.name}"`);
		} catch (e) {
			feedback.error?.(e instanceof Error ? e.message : 'Invalid chat file');
		}
	};
	input.click();
}

export type Chat = domain.tree.Chat;
export type Exchange = domain.tree.Exchange;
export type DeleteMode = domain.tree.DeleteMode;
export type Message = domain.tree.Message;
