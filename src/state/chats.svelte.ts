import { toast } from 'svelte-sonner';
import {
	buildEmptyExchanges,
	forkExchanges,
	getMainChatTail,
	hasExplicitExchangeOrder,
	validateChatUpload,
	withExplicitExchangeOrder,
	type Chat,
	type ExchangeMap
} from '@/lib/chat/tree';
import { buildInitialExchanges } from '@/lib/chat/initialExchanges';

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
	activeChatIndex: 0,
	streamingExchangeIds: [] as string[]
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

function hasRenderableExchanges(exchanges: ExchangeMap) {
	return Object.values(exchanges).some((exchange) => !exchange.isAnchor);
}

export function updateActiveChat(patch: Partial<Pick<Chat, 'exchanges' | 'activeExchangeId'>>) {
	chatState.chats = chatState.chats.map((c, i) => (i === chatState.activeChatIndex ? { ...c, ...patch } : c));
}

export function replaceActiveExchanges(nextExchanges: ExchangeMap) {
	updateActiveChat({ exchanges: nextExchanges });
}

export function setActiveExchangeId(exchangeId: string | null) {
	updateActiveChat({ activeExchangeId: exchangeId });
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
	chatState.chats = chatState.chats;
}

export function downloadChat(index: number) {
	const chat = chatState.chats[index];
	const payload = JSON.stringify(chat, null, 2);
	const blob = new Blob([payload], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = `${chat.name.replace(/[^a-zA-Z0-9-_ ]/g, '')}.json`;
	link.click();
	URL.revokeObjectURL(url);
}

export function uploadChat(): void {
	const input = document.createElement('input');
	input.type = 'file';
	input.accept = '.json';
	input.onchange = async () => {
		const file = input.files?.[0];
		if (!file) return;
		try {
			const text = await file.text();
			const data = JSON.parse(text);
			const chat = validateChatUpload(data);
			chat.id = crypto.randomUUID();
			const baseName = file.name.replace(/\.json$/i, '');
			const existingNames = new Set(chatState.chats.map((c) => c.name));
			let name = baseName;
			let i = 1;
			while (existingNames.has(name)) {
				name = `${baseName} (${i})`;
				i++;
			}
			chat.name = name;
			chatState.chats = [...chatState.chats, chat];
			chatState.activeChatIndex = chatState.chats.length - 1;
			toast.success(`Imported "${chat.name}"`);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Invalid chat file');
		}
	};
	input.click();
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
			if ('roots' in c && Array.isArray((c as any).roots)) {
				const legacyRoots = (c as any).roots as ExchangeMap[];
				const legacyActiveRootIndex = (c as any).activeRootIndex ?? 0;
				for (let i = 0; i < legacyRoots.length; i++) {
					const exchanges = hasExplicitExchangeOrder(legacyRoots[i])
						? legacyRoots[i]
						: withExplicitExchangeOrder(legacyRoots[i]);
					hydratedChats.push({
						id: crypto.randomUUID(),
						name: i === 0 ? (c.name ?? `Chat ${hydratedChats.length + 1}`) : `${c.name ?? 'Chat'} (fork ${i})`,
						exchanges,
						activeExchangeId: i === legacyActiveRootIndex
							? (c.activeExchangeId ?? getMainChatTail(exchanges))
							: getMainChatTail(exchanges)
					});
				}
			} else {
				const exchanges = c.exchanges && !hasExplicitExchangeOrder(c.exchanges)
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
