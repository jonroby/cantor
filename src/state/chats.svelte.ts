import * as domain from '@/domain';

export type ContextStrategy = 'full' | 'lru' | 'bm25';
export type ChatMode = 'chat' | 'agent';

export interface ChatRecord extends domain.tree.ChatTree {
	id: string;
	name: string;
	activeExchangeId: string | null;
	contextStrategy: ContextStrategy;
	mode: ChatMode;
	enabledToolNames?: string[] | null;
}

function makeDefaultChat(): ChatRecord {
	const tree = domain.tree.buildEmptyTree();
	return {
		id: crypto.randomUUID(),
		name: 'Chat 1',
		rootId: tree.rootId,
		exchanges: tree.exchanges,
		activeExchangeId: domain.tree.getMainChatTail(tree),
		contextStrategy: 'full',
		mode: 'chat',
		enabledToolNames: null
	};
}

export const chatState = $state({
	chats: [makeDefaultChat()] as ChatRecord[],
	activeChatIndex: 0
});

export function getActiveChat(): ChatRecord {
	return chatState.chats[chatState.activeChatIndex] ?? chatState.chats[0];
}

export function getActiveTree(): domain.tree.ChatTree {
	const chat = getActiveChat();
	return { rootId: chat.rootId, exchanges: chat.exchanges };
}

export function getActiveExchangeId(): string | null {
	return getActiveChat().activeExchangeId;
}

export function getChatById(chatId: string): ChatRecord | undefined {
	return chatState.chats.find((c) => c.id === chatId);
}

export function getTreeByChatId(chatId: string): domain.tree.ChatTree | undefined {
	const chat = getChatById(chatId);
	if (!chat) return undefined;
	return { rootId: chat.rootId, exchanges: chat.exchanges };
}

export function replaceTreeByChatId(chatId: string, nextTree: domain.tree.ChatTree) {
	chatState.chats = chatState.chats.map((c) =>
		c.id === chatId ? { ...c, rootId: nextTree.rootId, exchanges: nextTree.exchanges } : c
	);
}

function hasRenderableExchanges(exchanges: domain.tree.ExchangeMap) {
	return Object.keys(exchanges).length > 0;
}

export function replaceActiveTree(nextTree: domain.tree.ChatTree) {
	const i = chatState.activeChatIndex;
	chatState.chats = chatState.chats.map((c, idx) =>
		idx === i ? { ...c, rootId: nextTree.rootId, exchanges: nextTree.exchanges } : c
	);
}

export function addChat(chat: ChatRecord): number {
	chatState.chats = [...chatState.chats, chat];
	chatState.activeChatIndex = chatState.chats.length - 1;
	return chatState.activeChatIndex;
}

export function setActiveExchangeId(exchangeId: string | null) {
	const i = chatState.activeChatIndex;
	if (chatState.chats[i]?.activeExchangeId === exchangeId) return;
	chatState.chats = chatState.chats.map((c, idx) =>
		idx === i ? { ...c, activeExchangeId: exchangeId } : c
	);
}

function nextChatName(): string {
	const names = new Set(chatState.chats.map((c) => c.name));
	let i = 1;
	while (names.has(`Chat (${i})`)) i++;
	return `Chat (${i})`;
}

export function newChat(): number {
	const tree = domain.tree.buildEmptyTree();
	const chat: ChatRecord = {
		id: crypto.randomUUID(),
		name: nextChatName(),
		rootId: tree.rootId,
		exchanges: tree.exchanges,
		activeExchangeId: domain.tree.getMainChatTail(tree),
		contextStrategy: 'full',
		mode: 'chat',
		enabledToolNames: null
	};
	return addChat(chat);
}

export function selectChat(index: number) {
	chatState.activeChatIndex = Math.min(Math.max(index, 0), chatState.chats.length - 1);
}

export function deleteChat(index: number) {
	if (chatState.chats.length <= 1) return;
	chatState.chats = chatState.chats.filter((_, i) => i !== index);
	chatState.activeChatIndex = Math.min(chatState.activeChatIndex, chatState.chats.length - 1);
}

export function setContextStrategy(strategy: ContextStrategy) {
	chatState.chats[chatState.activeChatIndex].contextStrategy = strategy;
}

export function getMode(): ChatMode {
	return getActiveChat().mode;
}

export function setMode(mode: ChatMode) {
	chatState.chats[chatState.activeChatIndex].mode = mode;
}

export function getEnabledToolNames(): string[] | null {
	return getActiveChat().enabledToolNames ?? null;
}

export function setEnabledToolNames(names: string[] | null) {
	chatState.chats[chatState.activeChatIndex].enabledToolNames = names;
}

export function renameChat(index: number, name: string): boolean {
	const conflict = chatState.chats.some((c, i) => i !== index && c.name === name);
	if (conflict) return false;
	chatState.chats[index].name = name;
	return true;
}

export function hydrate(parsed: { chats?: ChatRecord[]; activeChatIndex?: number }) {
	if (parsed.chats?.length) {
		if (parsed.chats.some((c) => hasRenderableExchanges(c.exchanges))) {
			chatState.chats = parsed.chats;
			if (typeof parsed.activeChatIndex === 'number') {
				chatState.activeChatIndex = Math.min(
					Math.max(parsed.activeChatIndex, 0),
					chatState.chats.length - 1
				);
			}
		}
	}
}
