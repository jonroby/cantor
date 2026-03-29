import * as domain from '@/domain';
import { buildInitialExchanges } from '@/state/initial-exchanges';

function makeDefaultChat(): domain.tree.Chat {
	const tree = buildInitialExchanges();
	return {
		id: crypto.randomUUID(),
		name: 'Chat 1',
		rootId: tree.rootId,
		exchanges: tree.exchanges,
		activeExchangeId: domain.tree.getMainChatTail(tree)
	};
}

export const chatState = $state({
	chats: [makeDefaultChat()] as domain.tree.Chat[],
	activeChatIndex: 0
});

export function getActiveChat(): domain.tree.Chat {
	return chatState.chats[chatState.activeChatIndex] ?? chatState.chats[0];
}

export function getActiveExchanges(): domain.tree.ExchangeMap {
	return getActiveChat().exchanges;
}

export function getActiveTree(): domain.tree.ChatTree {
	const chat = getActiveChat();
	return { rootId: chat.rootId, exchanges: chat.exchanges };
}

export function getActiveExchangeId(): string | null {
	return getActiveChat().activeExchangeId;
}

export function getChatById(chatId: string): domain.tree.Chat | undefined {
	return chatState.chats.find((c) => c.id === chatId);
}

export function getExchangesByChatId(chatId: string): domain.tree.ExchangeMap | undefined {
	return getChatById(chatId)?.exchanges;
}

export function getTreeByChatId(chatId: string): domain.tree.ChatTree | undefined {
	const chat = getChatById(chatId);
	if (!chat) return undefined;
	return { rootId: chat.rootId, exchanges: chat.exchanges };
}

export function replaceExchangesByChatId(chatId: string, nextExchanges: domain.tree.ExchangeMap) {
	const chat = chatState.chats.find((c) => c.id === chatId);
	if (chat) chat.exchanges = nextExchanges;
}

export function replaceTreeByChatId(chatId: string, nextTree: domain.tree.ChatTree) {
	const chat = chatState.chats.find((c) => c.id === chatId);
	if (!chat) return;
	chat.rootId = nextTree.rootId;
	chat.exchanges = nextTree.exchanges;
}

function hasRenderableExchanges(exchanges: domain.tree.ExchangeMap) {
	return Object.keys(exchanges).length > 0;
}

export function replaceActiveExchanges(nextExchanges: domain.tree.ExchangeMap) {
	chatState.chats[chatState.activeChatIndex].exchanges = nextExchanges;
}

export function replaceActiveTree(nextTree: domain.tree.ChatTree) {
	const chat = chatState.chats[chatState.activeChatIndex];
	chat.rootId = nextTree.rootId;
	chat.exchanges = nextTree.exchanges;
}

export function setActiveExchangeId(exchangeId: string | null) {
	chatState.chats[chatState.activeChatIndex].activeExchangeId = exchangeId;
}

function nextChatName(): string {
	const names = new Set(chatState.chats.map((c) => c.name));
	let i = 1;
	while (names.has(`Chat (${i})`)) i++;
	return `Chat (${i})`;
}

export function newChat(): number {
	const tree = domain.tree.buildEmptyTree();
	const chat: domain.tree.Chat = {
		id: crypto.randomUUID(),
		name: nextChatName(),
		rootId: tree.rootId,
		exchanges: tree.exchanges,
		activeExchangeId: domain.tree.getMainChatTail(tree)
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

export function renameChat(index: number, name: string): boolean {
	const conflict = chatState.chats.some((c, i) => i !== index && c.name === name);
	if (conflict) return false;
	chatState.chats[index].name = name;
	return true;
}

function nextCopyName(): string {
	const names = new Set(chatState.chats.map((c) => c.name));
	let i = 1;
	while (names.has(`Copy Path (${i})`)) i++;
	return `Copy Path (${i})`;
}

export function copyToNewChat(exchangeId: string) {
	const activeChat = chatState.chats[chatState.activeChatIndex];
	if (!activeChat) return;

	const result = domain.tree.copyPath(
		{ rootId: activeChat.rootId, exchanges: activeChat.exchanges },
		exchangeId
	);

	const copiedTree: domain.tree.ChatTree = {
		rootId: result.rootId,
		exchanges: result.copiedExchanges
	};
	const name = nextCopyName();
	const copiedChat: domain.tree.Chat = {
		id: crypto.randomUUID(),
		name,
		rootId: result.rootId,
		exchanges: result.copiedExchanges,
		activeExchangeId: domain.tree.getMainChatTail(copiedTree)
	};
	chatState.chats = [...chatState.chats, copiedChat];
	chatState.activeChatIndex = chatState.chats.length - 1;
}

export function hydrate(parsed: { chats?: domain.tree.Chat[]; activeChatIndex?: number }) {
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
