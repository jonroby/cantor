import {
	buildEmptyTree,
	forkExchanges,
	getMainChatTail,
	type Chat,
	type ExchangeMap
} from '@/domain/tree';
import { buildInitialExchanges } from '@/state/initial-exchanges';

function makeDefaultChat(): Chat {
	const tree = buildInitialExchanges();
	return {
		id: crypto.randomUUID(),
		name: 'Chat 1',
		rootId: tree.rootId,
		exchanges: tree.exchanges,
		activeExchangeId: getMainChatTail(tree)
	};
}

export const chatState = $state({
	chats: [makeDefaultChat()] as Chat[],
	activeChatIndex: 0
});

export function getActiveChat(): Chat {
	return chatState.chats[chatState.activeChatIndex] ?? chatState.chats[0];
}

export function getActiveExchanges(): ExchangeMap {
	return getActiveChat().exchanges;
}

export function getActiveExchangeId(): string | null {
	return getActiveChat().activeExchangeId;
}

export function getChatById(chatId: string): Chat | undefined {
	return chatState.chats.find((c) => c.id === chatId);
}

export function getExchangesByChatId(chatId: string): ExchangeMap | undefined {
	return getChatById(chatId)?.exchanges;
}

export function replaceExchangesByChatId(chatId: string, nextExchanges: ExchangeMap) {
	const chat = chatState.chats.find((c) => c.id === chatId);
	if (chat) chat.exchanges = nextExchanges;
}

function hasRenderableExchanges(exchanges: ExchangeMap) {
	return Object.keys(exchanges).length > 0;
}

export function replaceActiveExchanges(nextExchanges: ExchangeMap) {
	chatState.chats[chatState.activeChatIndex].exchanges = nextExchanges;
}

export function setActiveExchangeId(exchangeId: string | null) {
	chatState.chats[chatState.activeChatIndex].activeExchangeId = exchangeId;
}

export function newChat(): number {
	const tree = buildEmptyTree();
	const chat: Chat = {
		id: crypto.randomUUID(),
		name: `Chat ${chatState.chats.length + 1}`,
		rootId: tree.rootId,
		exchanges: tree.exchanges,
		activeExchangeId: getMainChatTail(tree)
	};
	chatState.chats = [...chatState.chats, chat];
	chatState.activeChatIndex = chatState.chats.length - 1;
	return chatState.chats.length - 1;
}

export function selectChat(index: number) {
	chatState.activeChatIndex = Math.min(Math.max(index, 0), chatState.chats.length - 1);
}

export function deleteChat(index: number) {
	if (chatState.chats.length <= 1) return;
	chatState.chats = chatState.chats.filter((_, i) => i !== index);
	chatState.activeChatIndex = Math.min(chatState.activeChatIndex, chatState.chats.length - 1);
}

export function renameChat(index: number, name: string) {
	chatState.chats[index].name = name;
}

export function forkChat(exchangeId: string) {
	const activeChat = chatState.chats[chatState.activeChatIndex];
	if (!activeChat) return;

	const result = forkExchanges(
		{ rootId: activeChat.rootId, exchanges: activeChat.exchanges },
		exchangeId
	);

	const forkedChat: Chat = {
		id: crypto.randomUUID(),
		name: `${activeChat.name} (fork ${chatState.chats.length + 1})`,
		rootId: result.rootId,
		exchanges: result.forkedExchanges,
		activeExchangeId: result.firstCopiedId
	};
	chatState.chats = [...chatState.chats, forkedChat];
	chatState.activeChatIndex = chatState.chats.length - 1;
}

export function hydrate(parsed: {
	chats?: Chat[];
	activeChatIndex?: number;
}) {
	if (parsed.chats?.length) {
		if (parsed.chats.some((c) => hasRenderableExchanges(c.exchanges))) {
			chatState.chats = parsed.chats;
		}
		if (typeof parsed.activeChatIndex === 'number') {
			chatState.activeChatIndex = Math.min(
				Math.max(parsed.activeChatIndex, 0),
				chatState.chats.length - 1
			);
		}
	}
}
