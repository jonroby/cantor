import { describe, expect, it, beforeEach } from 'vitest';
import {
	chatState,
	getActiveChat,
	getActiveExchanges,
	getActiveTree,
	getActiveExchangeId,
	getChatById,
	getExchangesByChatId,
	getTreeByChatId,
	replaceExchangesByChatId,
	replaceTreeByChatId,
	replaceActiveExchanges,
	replaceActiveTree,
	setActiveExchangeId,
	newChat,
	selectChat,
	deleteChat,
	renameChat,
	copyToNewChat,
	hydrate
} from './chats.svelte';
import {
	buildEmptyTree,
	addExchangeResult,
	getMainChatTail,
	validateChatTree,
	type Chat,
	type ChatTree
} from '@/domain';
import type { Provider } from '@/domain';

// ── Helpers ──────────────────────────────────────────────────────────────────

const PROVIDER: Provider = 'claude';
const MODEL = 'claude-sonnet-4-6';

function buildTreeWithExchanges(n: number): ChatTree {
	let tree = buildEmptyTree();
	let parentId = 'unused';
	for (let i = 0; i < n; i++) {
		const result = addExchangeResult(tree, parentId, `prompt-${i}`, MODEL, PROVIDER);
		tree = { rootId: result.rootId, exchanges: result.exchanges };
		parentId = result.id;
	}
	return tree;
}

function makeChat(name: string, tree?: ChatTree): Chat {
	const t = tree ?? buildTreeWithExchanges(2);
	return {
		id: crypto.randomUUID(),
		name,
		rootId: t.rootId,
		exchanges: t.exchanges,
		activeExchangeId: getMainChatTail(t)
	};
}

function resetState() {
	const tree = buildTreeWithExchanges(1);
	const chat: Chat = {
		id: 'test-chat-1',
		name: 'Chat 1',
		rootId: tree.rootId,
		exchanges: tree.exchanges,
		activeExchangeId: getMainChatTail(tree)
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

	describe('getActiveExchanges', () => {
		it('returns the exchanges of the active chat', () => {
			const exchanges = getActiveExchanges();
			expect(Object.keys(exchanges).length).toBeGreaterThan(0);
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

	describe('getChatById', () => {
		it('returns the chat with matching id', () => {
			expect(getChatById('test-chat-1')?.name).toBe('Chat 1');
		});

		it('returns undefined for nonexistent id', () => {
			expect(getChatById('nonexistent')).toBeUndefined();
		});
	});

	describe('getExchangesByChatId', () => {
		it('returns exchanges for existing chat', () => {
			const exchanges = getExchangesByChatId('test-chat-1');
			expect(exchanges).toBeDefined();
			expect(Object.keys(exchanges!).length).toBeGreaterThan(0);
		});

		it('returns undefined for nonexistent chat', () => {
			expect(getExchangesByChatId('nope')).toBeUndefined();
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

	describe('replaceExchangesByChatId', () => {
		it('replaces exchanges on the matching chat', () => {
			const newTree = buildTreeWithExchanges(3);
			replaceExchangesByChatId('test-chat-1', newTree.exchanges);
			expect(Object.keys(chatState.chats[0].exchanges).length).toBe(
				Object.keys(newTree.exchanges).length
			);
		});

		it('does nothing for nonexistent chat id', () => {
			const before = { ...chatState.chats[0].exchanges };
			replaceExchangesByChatId('nope', {});
			expect(Object.keys(chatState.chats[0].exchanges).length).toBe(Object.keys(before).length);
		});

		it('does not modify other chats', () => {
			const first = makeChat('A', buildTreeWithExchanges(1));
			const second = makeChat('B', buildTreeWithExchanges(2));
			const replacement = buildTreeWithExchanges(4);
			chatState.chats = [first, second];

			replaceExchangesByChatId(second.id, replacement.exchanges);

			expect(Object.keys(chatState.chats[0].exchanges)).toHaveLength(1);
			expect(Object.keys(chatState.chats[1].exchanges)).toHaveLength(4);
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
			replaceTreeByChatId('nope', buildEmptyTree());
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

	describe('replaceActiveExchanges', () => {
		it('replaces exchanges on the selected active chat only', () => {
			chatState.chats = [
				makeChat('A', buildTreeWithExchanges(1)),
				makeChat('B', buildTreeWithExchanges(2))
			];
			selectChat(1);
			const newTree = buildTreeWithExchanges(3);

			replaceActiveExchanges(newTree.exchanges);

			expect(Object.keys(chatState.chats[0].exchanges)).toHaveLength(1);
			expect(chatState.chats[1].exchanges).toBe(newTree.exchanges);
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

	describe('copyToNewChat', () => {
		it('creates a new chat from copied path', () => {
			const tree = buildTreeWithExchanges(3);
			chatState.chats = [
				{
					id: 'src',
					name: 'Source',
					rootId: tree.rootId,
					exchanges: tree.exchanges,
					activeExchangeId: getMainChatTail(tree)
				}
			];
			chatState.activeChatIndex = 0;

			const tail = getMainChatTail(tree)!;
			copyToNewChat(tail);

			expect(chatState.chats.length).toBe(2);
			expect(chatState.activeChatIndex).toBe(1);
			expect(chatState.chats[1].name).toBe('Copy Path (1)');
		});

		it('copied chat has a valid tree', () => {
			const tree = buildTreeWithExchanges(3);
			chatState.chats = [
				{
					id: 'src',
					name: 'Source',
					rootId: tree.rootId,
					exchanges: tree.exchanges,
					activeExchangeId: getMainChatTail(tree)
				}
			];
			chatState.activeChatIndex = 0;

			const tail = getMainChatTail(tree)!;
			copyToNewChat(tail);

			const copiedTree = getTreeByChatId(chatState.chats[1].id);
			expect(copiedTree).toBeDefined();
			expect(() => validateChatTree(copiedTree!)).not.toThrow();
		});

		it('does nothing if no active chat', () => {
			chatState.chats = [];
			chatState.activeChatIndex = 0;
			copyToNewChat('some-id');
			expect(chatState.chats.length).toBe(0);
		});

		it('skips copy names that are already taken', () => {
			const tree = buildTreeWithExchanges(3);
			chatState.chats = [
				{
					id: 'src',
					name: 'Source',
					rootId: tree.rootId,
					exchanges: tree.exchanges,
					activeExchangeId: getMainChatTail(tree)
				},
				makeChat('Copy Path (1)'),
				makeChat('Copy Path (2)')
			];
			chatState.activeChatIndex = 0;

			copyToNewChat(getMainChatTail(tree)!);

			expect(chatState.chats.at(-1)?.name).toBe('Copy Path (3)');
			const names = chatState.chats.map((chat) => chat.name);
			expect(new Set(names).size).toBe(names.length);
		});
	});

	describe('hydrate', () => {
		it('restores chats from parsed data', () => {
			const tree = buildTreeWithExchanges(2);
			const chats: Chat[] = [
				{
					id: 'h1',
					name: 'Hydrated',
					rootId: tree.rootId,
					exchanges: tree.exchanges,
					activeExchangeId: getMainChatTail(tree)
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
				chats: [{ id: 'empty', name: 'Empty', rootId: null, exchanges: {}, activeExchangeId: null }]
			});
			expect(chatState.chats[0].name).toBe(before);
		});

		it('clamps activeChatIndex to valid range', () => {
			const tree = buildTreeWithExchanges(2);
			const chats: Chat[] = [
				{
					id: 'h1',
					name: 'H1',
					rootId: tree.rootId,
					exchanges: tree.exchanges,
					activeExchangeId: getMainChatTail(tree)
				}
			];
			hydrate({ chats, activeChatIndex: 99 });
			expect(chatState.activeChatIndex).toBe(0);
		});

		it('clamps negative activeChatIndex to 0', () => {
			const tree = buildTreeWithExchanges(2);
			const chats: Chat[] = [
				{
					id: 'h1',
					name: 'H1',
					rootId: tree.rootId,
					exchanges: tree.exchanges,
					activeExchangeId: getMainChatTail(tree)
				}
			];
			hydrate({ chats, activeChatIndex: -3 });
			expect(chatState.activeChatIndex).toBe(0);
		});
	});
});
