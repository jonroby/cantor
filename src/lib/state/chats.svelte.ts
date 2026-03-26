import { toast } from 'svelte-sonner';
import {
	buildEmptyExchanges,
	getMainChatTail,
	hasExplicitExchangeOrder,
	validateChatUpload,
	withExplicitExchangeOrder,
	type Chat,
	type ExchangeMap
} from '@/lib/chat/tree';
import { buildInitialExchanges } from '@/lib/chat/initialExchanges';

export function createChatState() {
	let chats: Chat[] = $state([
		makeChat([withExplicitExchangeOrder(buildInitialExchanges())], 'Chat 1')
	]);
	let activeChatIndex = $state(0);

	function makeChat(roots: ExchangeMap[], name?: string): Chat {
		return {
			id: crypto.randomUUID(),
			name: name ?? `Chat ${chats.length + 1}`,
			roots,
			activeRootIndex: 0
		};
	}

	function clampRootIndex(index: number, rootCount: number) {
		if (rootCount <= 0) return 0;
		return Math.min(Math.max(index, 0), rootCount - 1);
	}

	function hasRenderableExchanges(rootList: ExchangeMap[]) {
		return rootList.some((root) => Object.values(root).some((exchange) => !exchange.isAnchor));
	}

	function updateActiveChat(patch: Partial<Pick<Chat, 'roots' | 'activeRootIndex'>>) {
		chats = chats.map((c, i) => (i === activeChatIndex ? { ...c, ...patch } : c));
	}

	function selectRoot(index: number): string | null {
		const roots = chats[activeChatIndex]?.roots ?? [];
		const clamped = clampRootIndex(index, roots.length);
		updateActiveChat({ activeRootIndex: clamped });
		return getMainChatTail(roots[clamped]);
	}

	function replaceActiveRoot(nextRoot: ExchangeMap) {
		const roots = chats[activeChatIndex]?.roots ?? [];
		const activeRootIndex = chats[activeChatIndex]?.activeRootIndex ?? 0;
		updateActiveChat({
			roots: roots.map((root, index) => (index === activeRootIndex ? nextRoot : root))
		});
	}

	function newChat(): { index: number; activeExchangeId: string | null } {
		const chat = makeChat([buildEmptyExchanges()]);
		chats = [...chats, chat];
		activeChatIndex = chats.length - 1;
		return {
			index: chats.length - 1,
			activeExchangeId: getMainChatTail(chat.roots[0])
		};
	}

	function selectChat(index: number): string | null {
		activeChatIndex = Math.min(Math.max(index, 0), chats.length - 1);
		const chat = chats[activeChatIndex];
		return getMainChatTail(chat.roots[chat.activeRootIndex ?? 0]);
	}

	function deleteChat(index: number): string | null {
		if (chats.length <= 1) return null;
		chats = chats.filter((_, i) => i !== index);
		activeChatIndex = Math.min(activeChatIndex, chats.length - 1);
		const chat = chats[activeChatIndex];
		return getMainChatTail(chat.roots[chat.activeRootIndex ?? 0]);
	}

	function renameChat(index: number, name: string) {
		chats[index].name = name;
		chats = chats;
	}

	function downloadChat(index: number) {
		const chat = chats[index];
		const payload = JSON.stringify(chat, null, 2);
		const blob = new Blob([payload], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `${chat.name.replace(/[^a-zA-Z0-9-_ ]/g, '')}.json`;
		link.click();
		URL.revokeObjectURL(url);
	}

	function uploadChat(): void {
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
				const existingNames = new Set(chats.map((c) => c.name));
				let name = baseName;
				let i = 1;
				while (existingNames.has(name)) {
					name = `${baseName} (${i})`;
					i++;
				}
				chat.name = name;
				chats = [...chats, chat];
				activeChatIndex = chats.length - 1;
				toast.success(`Imported "${chat.name}"`);
			} catch (e) {
				toast.error(e instanceof Error ? e.message : 'Invalid chat file');
			}
		};
		input.click();
	}

	function hydrate(parsed: {
		chats?: Chat[];
		activeChatIndex?: number;
		// Legacy format
		sessions?: Chat[];
		activeSessionIndex?: number;
		roots?: ExchangeMap[];
		activeRootIndex?: number;
	}) {
		const rawChats = parsed.chats ?? parsed.sessions;
		const rawIndex = parsed.activeChatIndex ?? parsed.activeSessionIndex;

		if (rawChats?.length) {
			const hydratedChats = rawChats.map((c) => ({
				...c,
				roots: c.roots.map((r) =>
					hasExplicitExchangeOrder(r) ? r : withExplicitExchangeOrder(r)
				)
			}));
			if (hydratedChats.some((c) => hasRenderableExchanges(c.roots))) {
				chats = hydratedChats;
			}
			if (typeof rawIndex === 'number') {
				activeChatIndex = Math.min(
					Math.max(rawIndex, 0),
					chats.length - 1
				);
			}
		} else if (parsed.roots?.length) {
			const hydratedRoots = parsed.roots.map((root) => withExplicitExchangeOrder(root));
			if (hasRenderableExchanges(hydratedRoots)) {
				chats = [makeChat(hydratedRoots, 'Chat 1')];
				activeChatIndex = 0;
			}
		}
	}

	function getActiveExchangeIdAfterHydrate(): string | null {
		const chat = chats[activeChatIndex];
		return getMainChatTail(
			chat?.roots[chat?.activeRootIndex ?? 0] ?? chats[0]?.roots[0]
		);
	}

	return {
		get chats() {
			return chats;
		},
		set chats(v: Chat[]) {
			chats = v;
		},
		get activeChatIndex() {
			return activeChatIndex;
		},
		set activeChatIndex(v: number) {
			activeChatIndex = v;
		},
		get roots() {
			return chats[activeChatIndex]?.roots ?? chats[0]?.roots ?? [];
		},
		get activeRootIndex() {
			return chats[activeChatIndex]?.activeRootIndex ?? 0;
		},
		updateActiveChat,
		selectRoot,
		replaceActiveRoot,
		newChat,
		selectChat,
		deleteChat,
		renameChat,
		downloadChat,
		uploadChat,
		hydrate,
		getActiveExchangeIdAfterHydrate
	};
}
