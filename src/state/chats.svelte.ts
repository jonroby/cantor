import {
	buildEmptyExchanges,
	forkExchanges,
	getMainChatTail,
	hasExplicitExchangeOrder,
	withExplicitExchangeOrder,
	type Chat,
	type ExchangeMap
} from '@/domain/tree';
import { buildInitialExchanges } from '@/state/initial-exchanges';

function makeDefaultChat(): Chat {
	const exchanges = withExplicitExchangeOrder(buildInitialExchanges());
	return {
		id: crypto.randomUUID(),
		name: 'Chat 1',
		exchanges,
		activeExchangeId: getMainChatTail(exchanges)
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
	return Object.values(exchanges).some((exchange) => !exchange.isAnchor);
}

export function replaceActiveExchanges(nextExchanges: ExchangeMap) {
	chatState.chats[chatState.activeChatIndex].exchanges = nextExchanges;
}

export function setActiveExchangeId(exchangeId: string | null) {
	chatState.chats[chatState.activeChatIndex].activeExchangeId = exchangeId;
}

export function newChat(): number {
	const exchanges = buildEmptyExchanges();
	const chat: Chat = {
		id: crypto.randomUUID(),
		name: `Chat ${chatState.chats.length + 1}`,
		exchanges,
		activeExchangeId: getMainChatTail(exchanges)
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

	const result = forkExchanges(activeChat.exchanges, exchangeId);
	if (!result) return;

	const forkedChat: Chat = {
		id: crypto.randomUUID(),
		name: `${activeChat.name} (fork ${chatState.chats.length + 1})`,
		exchanges: result.forkedRoot,
		activeExchangeId: result.firstCopiedId
	};
	chatState.chats = [...chatState.chats, forkedChat];
	chatState.activeChatIndex = chatState.chats.length - 1;
}

export function hydrate(parsed: {
	chats?: Chat[];
	activeChatIndex?: number;
	sessions?: Chat[];
	activeSessionIndex?: number;
	roots?: ExchangeMap[];
	activeRootIndex?: number;
}) {
	const rawChats = parsed.chats ?? parsed.sessions;
	const rawIndex = parsed.activeChatIndex ?? parsed.activeSessionIndex;

	if (rawChats?.length) {
		const hydratedChats: Chat[] = [];
		for (const c of rawChats) {
			if ('roots' in c && Array.isArray((c as Record<string, unknown>).roots)) {
				const legacyRoots = (c as Record<string, unknown>).roots as ExchangeMap[];
				const legacyActiveRootIndex =
					((c as Record<string, unknown>).activeRootIndex as number) ?? 0;
				for (let i = 0; i < legacyRoots.length; i++) {
					const exchanges = hasExplicitExchangeOrder(legacyRoots[i])
						? legacyRoots[i]
						: withExplicitExchangeOrder(legacyRoots[i]);
					hydratedChats.push({
						id: crypto.randomUUID(),
						name:
							i === 0
								? (c.name ?? `Chat ${hydratedChats.length + 1}`)
								: `${c.name ?? 'Chat'} (fork ${i})`,
						exchanges,
						activeExchangeId:
							i === legacyActiveRootIndex
								? (c.activeExchangeId ?? getMainChatTail(exchanges))
								: getMainChatTail(exchanges)
					});
				}
			} else {
				const exchanges =
					c.exchanges && !hasExplicitExchangeOrder(c.exchanges)
						? withExplicitExchangeOrder(c.exchanges)
						: c.exchanges;
				hydratedChats.push({
					...c,
					exchanges,
					activeExchangeId: c.activeExchangeId ?? getMainChatTail(exchanges)
				});
			}
		}
		if (hydratedChats.some((c) => hasRenderableExchanges(c.exchanges))) {
			chatState.chats = hydratedChats;
		}
		if (typeof rawIndex === 'number') {
			chatState.activeChatIndex = Math.min(Math.max(rawIndex, 0), chatState.chats.length - 1);
		}
	} else if (parsed.roots?.length) {
		const hydratedChats: Chat[] = parsed.roots.map((root, i) => ({
			id: crypto.randomUUID(),
			name: i === 0 ? 'Chat 1' : `Chat 1 (fork ${i})`,
			exchanges: withExplicitExchangeOrder(root),
			activeExchangeId: getMainChatTail(root)
		}));
		if (hydratedChats.some((c) => hasRenderableExchanges(c.exchanges))) {
			chatState.chats = hydratedChats;
			chatState.activeChatIndex = 0;
		}
	}
}
