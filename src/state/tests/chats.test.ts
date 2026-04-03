import { describe, expect, it, beforeEach } from 'vitest';
import {
	addChat,
	chatState,
	getActiveChat,
	getActiveTree,
	getActiveExchangeId,
	getMode,
	getChatById,
	getTreeByChatId,
	replaceTreeByChatId,
	replaceActiveTree,
	setActiveExchangeId,
	newChat,
	selectChat,
	deleteChat,
	renameChat,
	setMode,
	hydrate
} from '../chats.svelte';
import * as domain from '@/domain';

// ── Helpers ──────────────────────────────────────────────────────────────────

const PROVIDER: domain.models.Provider = 'claude';
const MODEL = 'claude-sonnet-4-6';

function buildTreeWithExchanges(n: number): domain.tree.ChatTree {
	let tree = domain.tree.buildEmptyTree();
	let parentId = 'unused';
	for (let i = 0; i < n; i++) {
		const result = domain.tree.addExchange(tree, parentId, `prompt-${i}`, MODEL, PROVIDER);
		tree = result.tree;
		parentId = result.id;
	}
	return tree;
}

function makeChat(name: string, tree?: domain.tree.ChatTree): import('../chats.svelte').ChatRecord {
	const t = tree ?? buildTreeWithExchanges(2);
	return {
		id: crypto.randomUUID(),
		name,
		rootId: t.rootId,
		exchanges: t.exchanges,
		activeExchangeId: domain.tree.getMainChatTail(t),
		contextStrategy: 'full',
		mode: 'chat'
	};
}

function resetState() {
	const tree = buildTreeWithExchanges(1);
	const chat: import('../chats.svelte').ChatRecord = {
		id: 'test-chat-1',
		name: 'Chat 1',
		rootId: tree.rootId,
		exchanges: tree.exchanges,
		activeExchangeId: domain.tree.getMainChatTail(tree),
		contextStrategy: 'full',
		mode: 'chat'
	};
	chatState.chats = [chat];
	chatState.activeChatIndex = 0;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('chats state', () => {
	beforeEach(() => {
		resetState();
	});

	describe('getActiveChat', () => {
		it('returns the chat at activeChatIndex', () => {
			expect(getActiveChat().name).toBe('Chat 1');
		});

		it('falls back to first chat if index is out of range', () => {
			chatState.activeChatIndex = 999;
			expect(getActiveChat().name).toBe('Chat 1');
		});
	});

	describe('getActiveTree', () => {
		it('tracks the currently selected chat', () => {
			const firstTree = buildTreeWithExchanges(2);
			const secondTree = buildTreeWithExchanges(3);
			chatState.chats = [makeChat('A', firstTree), makeChat('B', secondTree)];

			selectChat(1);

			const tree = getActiveTree();
			expect(tree.rootId).toBe(chatState.chats[1].rootId);
			expect(Object.keys(tree.exchanges)).toHaveLength(Object.keys(secondTree.exchanges).length);
		});
	});

	describe('getActiveExchangeId', () => {
		it('returns the active exchange for the selected chat', () => {
			chatState.chats = [
				makeChat('A', buildTreeWithExchanges(1)),
				makeChat('B', buildTreeWithExchanges(3))
			];
			selectChat(1);
			expect(getActiveExchangeId()).toBe(chatState.chats[1].activeExchangeId);
		});
	});

	describe('mode', () => {
		it('defaults to chat mode', () => {
			expect(getMode()).toBe('chat');
		});

		it('sets mode on the active chat', () => {
			setMode('agent');
			expect(getMode()).toBe('agent');
			expect(chatState.chats[0].mode).toBe('agent');
		});
	});

	describe('getChatById', () => {
		it('returns the chat with matching id', () => {
			expect(getChatById('test-chat-1')?.name).toBe('Chat 1');
		});

		it('returns undefined for nonexistent id', () => {
			expect(getChatById('nonexistent')).toBeUndefined();
		});
	});

	describe('getTreeByChatId', () => {
		it('returns ChatTree for existing chat', () => {
			const tree = getTreeByChatId('test-chat-1');
			expect(tree).toBeDefined();
			expect(tree!.rootId).toBe(chatState.chats[0].rootId);
		});

		it('returns undefined for nonexistent chat', () => {
			expect(getTreeByChatId('nope')).toBeUndefined();
		});
	});

	describe('replaceTreeByChatId', () => {
		it('replaces rootId and exchanges on the matching chat', () => {
			const newTree = buildTreeWithExchanges(3);
			replaceTreeByChatId('test-chat-1', newTree);
			expect(chatState.chats[0].rootId).toBe(newTree.rootId);
			expect(chatState.chats[0].exchanges).toBe(newTree.exchanges);
		});

		it('does nothing for nonexistent chat id', () => {
			const beforeRootId = chatState.chats[0].rootId;
			replaceTreeByChatId('nope', domain.tree.buildEmptyTree());
			expect(chatState.chats[0].rootId).toBe(beforeRootId);
		});

		it('updates only the targeted chat tree', () => {
			const first = makeChat('A', buildTreeWithExchanges(1));
			const second = makeChat('B', buildTreeWithExchanges(2));
			const replacement = buildTreeWithExchanges(3);
			chatState.chats = [first, second];

			replaceTreeByChatId(second.id, replacement);

			expect(chatState.chats[0].rootId).toBe(first.rootId);
			expect(chatState.chats[1].rootId).toBe(replacement.rootId);
		});
	});

	describe('replaceActiveTree', () => {
		it('replaces rootId and exchanges on the selected active chat only', () => {
			chatState.chats = [
				makeChat('A', buildTreeWithExchanges(1)),
				makeChat('B', buildTreeWithExchanges(2))
			];
			selectChat(1);
			const newTree = buildTreeWithExchanges(3);

			replaceActiveTree(newTree);

			expect(chatState.chats[0].rootId).toBeDefined();
			expect(chatState.chats[1].rootId).toBe(newTree.rootId);
			expect(chatState.chats[1].exchanges).toBe(newTree.exchanges);
		});
	});

	describe('setActiveExchangeId', () => {
		it('sets activeExchangeId on the selected chat only', () => {
			chatState.chats = [
				makeChat('A', buildTreeWithExchanges(1)),
				makeChat('B', buildTreeWithExchanges(2))
			];
			selectChat(1);

			setActiveExchangeId('some-id');

			expect(chatState.chats[0].activeExchangeId).not.toBe('some-id');
			expect(chatState.chats[1].activeExchangeId).toBe('some-id');
		});

		it('can set to null', () => {
			setActiveExchangeId(null);
			expect(chatState.chats[0].activeExchangeId).toBeNull();
		});
	});

	describe('addChat', () => {
		it('appends a chat and selects it', () => {
			const chat = makeChat('Added', buildTreeWithExchanges(2));
			const index = addChat(chat);

			expect(index).toBe(1);
			expect(chatState.chats[1]).toBe(chat);
			expect(chatState.activeChatIndex).toBe(1);
		});
	});

	describe('newChat', () => {
		it('adds a new chat with empty tree', () => {
			const index = newChat();
			expect(chatState.chats.length).toBe(2);
			expect(chatState.activeChatIndex).toBe(index);
		});

		it('new chat has null rootId (empty tree)', () => {
			const index = newChat();
			expect(chatState.chats[index].rootId).toBeNull();
		});

		it('sets activeChatIndex to the new chat', () => {
			newChat();
			expect(chatState.activeChatIndex).toBe(1);
		});

		it('generates unique names that never collide', () => {
			const i1 = newChat();
			const i2 = newChat();
			const names = chatState.chats.map((c) => c.name);
			expect(new Set(names).size).toBe(names.length);
			expect(chatState.chats[i1].name).not.toBe(chatState.chats[i2].name);
		});

		it('reuses freed name after deleting a chat', () => {
			const i1 = newChat();
			expect(chatState.chats[i1].name).toBe('Chat (1)');
			deleteChat(i1);
			const i2 = newChat();
			expect(chatState.chats[i2].name).toBe('Chat (1)');
		});

		it('skips names that are already taken', () => {
			newChat(); // Chat (1)
			newChat(); // Chat (2)
			expect(chatState.chats.map((c) => c.name)).toEqual(['Chat 1', 'Chat (1)', 'Chat (2)']);
			deleteChat(1); // remove Chat (1)
			const i = newChat();
			expect(chatState.chats[i].name).toBe('Chat (1)');
		});
	});

	describe('selectChat', () => {
		it('sets activeChatIndex to the given index', () => {
			chatState.chats = [makeChat('A'), makeChat('B'), makeChat('C')];
			selectChat(2);
			expect(chatState.activeChatIndex).toBe(2);
		});

		it('clamps to 0 for negative index', () => {
			selectChat(-5);
			expect(chatState.activeChatIndex).toBe(0);
		});

		it('clamps to last index for out-of-range', () => {
			selectChat(999);
			expect(chatState.activeChatIndex).toBe(chatState.chats.length - 1);
		});
	});

	describe('deleteChat', () => {
		it('removes the chat at the given index', () => {
			chatState.chats = [makeChat('A'), makeChat('B'), makeChat('C')];
			chatState.activeChatIndex = 0;
			deleteChat(1);
			expect(chatState.chats.length).toBe(2);
			expect(chatState.chats.map((c) => c.name)).toEqual(['A', 'C']);
		});

		it('does not delete the last remaining chat', () => {
			deleteChat(0);
			expect(chatState.chats.length).toBe(1);
		});

		it('clamps activeChatIndex if it would be out of range', () => {
			chatState.chats = [makeChat('A'), makeChat('B')];
			chatState.activeChatIndex = 1;
			deleteChat(1);
			expect(chatState.activeChatIndex).toBe(0);
		});

		it('keeps the same active chat selected when deleting an earlier chat', () => {
			chatState.chats = [makeChat('A'), makeChat('B'), makeChat('C')];
			chatState.activeChatIndex = 2;

			deleteChat(0);

			expect(chatState.activeChatIndex).toBe(1);
			expect(getActiveChat().name).toBe('C');
		});
	});

	describe('renameChat', () => {
		it('renames the chat at the given index', () => {
			renameChat(0, 'Renamed');
			expect(chatState.chats[0].name).toBe('Renamed');
		});

		it('does not rename other chats', () => {
			chatState.chats = [makeChat('A'), makeChat('B')];
			renameChat(1, 'Renamed');
			expect(chatState.chats[0].name).toBe('A');
			expect(chatState.chats[1].name).toBe('Renamed');
		});

		it('returns true on success and has no duplicate names', () => {
			chatState.chats = [makeChat('A'), makeChat('B')];
			expect(renameChat(0, 'C')).toBe(true);
			const names = chatState.chats.map((c) => c.name);
			expect(new Set(names).size).toBe(names.length);
		});

		it('returns false when the name conflicts and has no duplicate names', () => {
			chatState.chats = [makeChat('A'), makeChat('B')];
			expect(renameChat(1, 'A')).toBe(false);
			expect(chatState.chats[1].name).toBe('B');
			const names = chatState.chats.map((c) => c.name);
			expect(new Set(names).size).toBe(names.length);
		});

		it('allows renaming a chat to its own name and has no duplicate names', () => {
			chatState.chats = [makeChat('A'), makeChat('B')];
			expect(renameChat(0, 'A')).toBe(true);
			const names = chatState.chats.map((c) => c.name);
			expect(new Set(names).size).toBe(names.length);
		});
	});

	describe('hydrate', () => {
		it('restores chats from parsed data', () => {
			const tree = buildTreeWithExchanges(2);
			const chats: import('../chats.svelte').ChatRecord[] = [
				{
					id: 'h1',
					name: 'Hydrated',
					rootId: tree.rootId,
					exchanges: tree.exchanges,
					activeExchangeId: domain.tree.getMainChatTail(tree),
					contextStrategy: 'full',
					mode: 'agent'
				}
			];
			hydrate({ chats, activeChatIndex: 0 });
			expect(chatState.chats[0].name).toBe('Hydrated');
		});

		it('ignores empty chats array', () => {
			const before = chatState.chats[0].name;
			hydrate({ chats: [] });
			expect(chatState.chats[0].name).toBe(before);
		});

		it('ignores chats with no renderable exchanges', () => {
			const before = chatState.chats[0].name;
			hydrate({
				chats: [
					{
						id: 'empty',
						name: 'Empty',
						rootId: null,
						exchanges: {},
						activeExchangeId: null,
						contextStrategy: 'full',
						mode: 'chat'
					}
				]
			});
			expect(chatState.chats[0].name).toBe(before);
		});

		it('clamps activeChatIndex to valid range', () => {
			const tree = buildTreeWithExchanges(2);
			const chats: import('../chats.svelte').ChatRecord[] = [
				{
					id: 'h1',
					name: 'H1',
					rootId: tree.rootId,
					exchanges: tree.exchanges,
					activeExchangeId: domain.tree.getMainChatTail(tree),
					contextStrategy: 'full',
					mode: 'chat'
				}
			];
			hydrate({ chats, activeChatIndex: 99 });
			expect(chatState.activeChatIndex).toBe(0);
		});

		it('clamps negative activeChatIndex to 0', () => {
			const tree = buildTreeWithExchanges(2);
			const chats: import('../chats.svelte').ChatRecord[] = [
				{
					id: 'h1',
					name: 'H1',
					rootId: tree.rootId,
					exchanges: tree.exchanges,
					activeExchangeId: domain.tree.getMainChatTail(tree),
					contextStrategy: 'full',
					mode: 'chat'
				}
			];
			hydrate({ chats, activeChatIndex: -3 });
			expect(chatState.activeChatIndex).toBe(0);
		});
	});
});
