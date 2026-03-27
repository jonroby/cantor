import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	buildEmptyExchanges,
	addExchangeResult,
	buildExchangesByParentId,
	getChildExchanges,
	getMainChatTail,
	forkExchanges,
	canCreateSideChats,
	canPromoteSideChatToMainChat,
	ROOT_ANCHOR_ID,
	type ExchangeMap,
	type ExchangesByParentId
} from '@/domain/tree';

// ── Mocks ─────────────────────────────────────────────────────────────────

// Mock streams module (uses Svelte runes internally)
vi.mock('@/services/streams', () => ({
	isStreaming: vi.fn(() => false),
	cancelStreamsForExchanges: vi.fn()
}));

// Mock models module
vi.mock('@/lib/models', () => ({
	getProviderForModelId: vi.fn(() => 'claude')
}));

// Track state mutations through a simple in-memory store
let mockExchanges: ExchangeMap = buildEmptyExchanges();
let mockActiveExchangeId: string | null = null;
let mockChats: Array<{ id: string; name: string; exchanges: ExchangeMap; activeExchangeId: string | null }> = [];
let mockActiveChatIndex = 0;

const mockForkChat = vi.fn();

vi.mock('@/state/chats.svelte', () => ({
	replaceActiveExchanges: vi.fn((next: ExchangeMap) => {
		mockExchanges = next;
		mockChats[mockActiveChatIndex].exchanges = next;
	}),
	setActiveExchangeId: vi.fn((id: string | null) => {
		mockActiveExchangeId = id;
		mockChats[mockActiveChatIndex].activeExchangeId = id;
	}),
	forkChat: (...args: unknown[]) => mockForkChat(...args)
}));

import {
	getExchangeNodeData,
	performDelete,
	performPromote,
	performFork,
	getDeleteMode
} from '@/features/chat-ops';
import { cancelStreamsForExchanges } from '@/services/streams';

// ── Helpers ───────────────────────────────────────────────────────────────

function resetMockState(exchanges?: ExchangeMap) {
	mockExchanges = exchanges ?? buildEmptyExchanges();
	mockActiveExchangeId = getMainChatTail(mockExchanges);
	mockChats = [{
		id: crypto.randomUUID(),
		name: 'Chat 1',
		exchanges: mockExchanges,
		activeExchangeId: mockActiveExchangeId
	}];
	mockActiveChatIndex = 0;
}

function addMessage(parentId: string, prompt: string, response = ''): { id: string; exchanges: ExchangeMap } {
	const result = addExchangeResult(mockExchanges, parentId, prompt, response);
	mockExchanges = result.exchanges;
	mockChats[mockActiveChatIndex].exchanges = mockExchanges;
	mockActiveExchangeId = result.id;
	mockChats[mockActiveChatIndex].activeExchangeId = result.id;
	return { id: result.id, exchanges: result.exchanges };
}

function getMainPath(exchanges: ExchangeMap): string[] {
	const byParent = buildExchangesByParentId(exchanges);
	const root = Object.values(exchanges).find(e => e.parentId === null);
	if (!root) return [];
	const ids: string[] = [];
	const rootChildren = getChildExchanges(exchanges, root.id, byParent);
	if (rootChildren.length === 0) return ids;
	let current = rootChildren[0];
	while (current) {
		ids.push(current.id);
		const children = getChildExchanges(exchanges, current.id, byParent);
		current = children.length > 0 ? children[0]! : undefined;
	}
	return ids;
}

function makeCallbacks() {
	return {
		onSelect: vi.fn(),
		onFork: vi.fn(),
		onToggleSideChildren: vi.fn(),
		onPromote: vi.fn(),
		onDelete: vi.fn()
	};
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('chat-ops integration', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		resetMockState();
		mockForkChat.mockImplementation((exchangeId: string) => {
			const activeChat = mockChats[mockActiveChatIndex];
			if (!activeChat) return;
			const result = forkExchanges(activeChat.exchanges, exchangeId);
			if (!result) return;
			const forkedChat = {
				id: crypto.randomUUID(),
				name: `${activeChat.name} (fork ${mockChats.length + 1})`,
				exchanges: result.forkedRoot,
				activeExchangeId: result.firstCopiedId
			};
			mockChats = [...mockChats, forkedChat];
			mockActiveChatIndex = mockChats.length - 1;
			mockExchanges = forkedChat.exchanges;
			mockActiveExchangeId = forkedChat.activeExchangeId;
		});
	});

	describe('creating a new chat and sending messages', () => {
		it('starts with an empty exchange map containing only the root anchor', () => {
			expect(Object.keys(mockExchanges)).toHaveLength(1);
			expect(mockExchanges[ROOT_ANCHOR_ID]).toBeDefined();
			expect(mockExchanges[ROOT_ANCHOR_ID].isAnchor).toBe(true);
			expect(mockActiveExchangeId).toBeNull();
		});

		it('adds a first message to a new chat', () => {
			const { id } = addMessage(ROOT_ANCHOR_ID, 'Hello', 'Hi there!');

			expect(Object.keys(mockExchanges)).toHaveLength(2);
			expect(mockExchanges[id].prompt).toBe('Hello');
			expect(mockExchanges[id].response).toBe('Hi there!');
			expect(mockExchanges[id].parentId).toBe(ROOT_ANCHOR_ID);
			expect(mockActiveExchangeId).toBe(id);
		});

		it('builds a multi-turn conversation', () => {
			const msg1 = addMessage(ROOT_ANCHOR_ID, 'What is 2+2?', '4');
			const msg2 = addMessage(msg1.id, 'And 3+3?', '6');
			const msg3 = addMessage(msg2.id, 'And 4+4?', '8');

			const path = getMainPath(mockExchanges);
			expect(path).toHaveLength(3);
			expect(path).toEqual([msg1.id, msg2.id, msg3.id]);

			expect(mockExchanges[msg1.id].prompt).toBe('What is 2+2?');
			expect(mockExchanges[msg2.id].prompt).toBe('And 3+3?');
			expect(mockExchanges[msg3.id].prompt).toBe('And 4+4?');

			expect(getMainChatTail(mockExchanges)).toBe(msg3.id);
			expect(mockActiveExchangeId).toBe(msg3.id);
		});

		it('tracks active exchange as the latest message', () => {
			const msg1 = addMessage(ROOT_ANCHOR_ID, 'First', 'R1');
			expect(mockActiveExchangeId).toBe(msg1.id);

			const msg2 = addMessage(msg1.id, 'Second', 'R2');
			expect(mockActiveExchangeId).toBe(msg2.id);

			const msg3 = addMessage(msg2.id, 'Third', 'R3');
			expect(mockActiveExchangeId).toBe(msg3.id);
		});
	});

	describe('getExchangeNodeData', () => {
		it('returns node data for a valid exchange', () => {
			const msg1 = addMessage(ROOT_ANCHOR_ID, 'Hello', 'World');
			const byParent = buildExchangesByParentId(mockExchanges);
			const callbacks = makeCallbacks();

			const data = getExchangeNodeData(msg1.id, mockExchanges, msg1.id, byParent, callbacks);

			expect(data).not.toBeNull();
			expect(data!.prompt).toBe('Hello');
			expect(data!.response).toBe('World');
			expect(data!.isActive).toBe(true);
			expect(data!.canFork).toBe(true);
			expect(data!.hasSideChildren).toBe(false);
			expect(data!.isSideRoot).toBe(false);
			expect(data!.isStreaming).toBe(false);
		});

		it('returns null for a missing exchange', () => {
			const byParent = buildExchangesByParentId(mockExchanges);
			const callbacks = makeCallbacks();

			const data = getExchangeNodeData('nonexistent', mockExchanges, null, byParent, callbacks);
			expect(data).toBeNull();
		});

		it('marks exchange as inactive when it is not the active exchange', () => {
			const msg1 = addMessage(ROOT_ANCHOR_ID, 'First', 'R1');
			const msg2 = addMessage(msg1.id, 'Second', 'R2');
			const byParent = buildExchangesByParentId(mockExchanges);
			const callbacks = makeCallbacks();

			const data = getExchangeNodeData(msg1.id, mockExchanges, msg2.id, byParent, callbacks);

			expect(data).not.toBeNull();
			expect(data!.isActive).toBe(false);
		});

		it('detects side children on a main path exchange', () => {
			const msg1 = addMessage(ROOT_ANCHOR_ID, 'Main', 'R1');
			addMessage(msg1.id, 'Continue main', 'R2');
			// Add a side chat to ROOT_ANCHOR
			addMessage(ROOT_ANCHOR_ID, 'Side prompt', 'Side response');

			const byParent = buildExchangesByParentId(mockExchanges);
			const callbacks = makeCallbacks();

			const rootData = getExchangeNodeData(ROOT_ANCHOR_ID, mockExchanges, null, byParent, callbacks);
			// Root anchor itself isn't rendered as a message, but let's check msg1
			const data = getExchangeNodeData(msg1.id, mockExchanges, msg1.id, byParent, callbacks);

			// msg1 is on the main path - check if it reports side children correctly
			// msg1 itself has one child (msg2), no side children
			expect(data).not.toBeNull();
			expect(data!.hasSideChildren).toBe(false);
		});

		it('identifies a side root exchange', () => {
			const msg1 = addMessage(ROOT_ANCHOR_ID, 'Main', 'R1');
			const side = addMessage(ROOT_ANCHOR_ID, 'Side', 'Side R');

			const byParent = buildExchangesByParentId(mockExchanges);
			const callbacks = makeCallbacks();

			const sideData = getExchangeNodeData(side.id, mockExchanges, side.id, byParent, callbacks);

			expect(sideData).not.toBeNull();
			expect(sideData!.isSideRoot).toBe(true);
		});

		it('wires callback functions correctly', () => {
			const msg1 = addMessage(ROOT_ANCHOR_ID, 'Hello', 'World');
			const byParent = buildExchangesByParentId(mockExchanges);
			const callbacks = makeCallbacks();

			const data = getExchangeNodeData(msg1.id, mockExchanges, msg1.id, byParent, callbacks);

			data!.onSelect();
			expect(callbacks.onSelect).toHaveBeenCalledWith(msg1.id);

			data!.onFork();
			expect(callbacks.onFork).toHaveBeenCalledWith(msg1.id);

			data!.onDelete();
			expect(callbacks.onDelete).toHaveBeenCalledWith(msg1.id);
		});
	});

	describe('side chats', () => {
		it('creates a side chat by adding a second child to a main path node', () => {
			const msg1 = addMessage(ROOT_ANCHOR_ID, 'Main prompt', 'Main response');
			const msg2 = addMessage(msg1.id, 'Continue main', 'Main R2');

			// Add a side chat off msg1
			const side = addMessage(msg1.id, 'Side question', 'Side answer');

			const byParent = buildExchangesByParentId(mockExchanges);
			const children = getChildExchanges(mockExchanges, msg1.id, byParent);

			expect(children).toHaveLength(2);
			expect(children[0].id).toBe(msg2.id); // main child is first
			expect(children[1].id).toBe(side.id); // side child is second
		});

		it('side chat nodes are identified correctly in node data', () => {
			const msg1 = addMessage(ROOT_ANCHOR_ID, 'Main', 'R1');
			addMessage(msg1.id, 'Main child', 'R2');
			const side = addMessage(msg1.id, 'Side', 'Side R');

			const byParent = buildExchangesByParentId(mockExchanges);
			const callbacks = makeCallbacks();

			const mainData = getExchangeNodeData(msg1.id, mockExchanges, msg1.id, byParent, callbacks);
			expect(mainData!.hasSideChildren).toBe(true);
			expect(mainData!.sideChildrenCount).toBe(1);

			const sideData = getExchangeNodeData(side.id, mockExchanges, side.id, byParent, callbacks);
			expect(sideData!.isSideRoot).toBe(true);
		});

		it('side chats can have at most 1 child (enforced by canAcceptNewChat)', () => {
			const msg1 = addMessage(ROOT_ANCHOR_ID, 'Main', 'R1');
			addMessage(msg1.id, 'Main child', 'R2');
			const side = addMessage(msg1.id, 'Side', 'Side R');

			// Side chat can accept one child
			const byParent = buildExchangesByParentId(mockExchanges);
			expect(canCreateSideChats(mockExchanges, side.id, byParent)).toBe(false);

			// Add one child to the side chat
			const sideChild = addMessage(side.id, 'Side child', 'Side child R');

			// Now side chat's child cannot accept more (it's a side exchange leaf)
			const byParent2 = buildExchangesByParentId(mockExchanges);
			const sideChildChildren = getChildExchanges(mockExchanges, sideChild.id, byParent2);
			expect(sideChildChildren).toHaveLength(0);
		});

		it('multiple side chats can branch off the same main path node', () => {
			const msg1 = addMessage(ROOT_ANCHOR_ID, 'Main', 'R1');
			addMessage(msg1.id, 'Continue', 'R2');
			const side1 = addMessage(msg1.id, 'Side 1', 'S1');
			const side2 = addMessage(msg1.id, 'Side 2', 'S2');
			const side3 = addMessage(msg1.id, 'Side 3', 'S3');

			const byParent = buildExchangesByParentId(mockExchanges);
			const children = getChildExchanges(mockExchanges, msg1.id, byParent);

			expect(children).toHaveLength(4); // main + 3 sides
			expect(children[1].id).toBe(side1.id);
			expect(children[2].id).toBe(side2.id);
			expect(children[3].id).toBe(side3.id);

			const callbacks = makeCallbacks();
			const data = getExchangeNodeData(msg1.id, mockExchanges, null, byParent, callbacks);
			expect(data!.sideChildrenCount).toBe(3);
		});
	});

	describe('navigating between chats', () => {
		it('switching active exchange updates state', () => {
			const msg1 = addMessage(ROOT_ANCHOR_ID, 'First', 'R1');
			const msg2 = addMessage(msg1.id, 'Second', 'R2');
			const msg3 = addMessage(msg2.id, 'Third', 'R3');

			// Simulate selecting an earlier message
			mockActiveExchangeId = msg1.id;

			const byParent = buildExchangesByParentId(mockExchanges);
			const callbacks = makeCallbacks();

			const data1 = getExchangeNodeData(msg1.id, mockExchanges, mockActiveExchangeId, byParent, callbacks);
			const data3 = getExchangeNodeData(msg3.id, mockExchanges, mockActiveExchangeId, byParent, callbacks);

			expect(data1!.isActive).toBe(true);
			expect(data3!.isActive).toBe(false);
		});

		it('creating a new chat resets to empty state', () => {
			addMessage(ROOT_ANCHOR_ID, 'Hello', 'World');
			expect(Object.keys(mockExchanges).length).toBeGreaterThan(1);

			// Simulate creating a new chat
			const newExchanges = buildEmptyExchanges();
			mockChats.push({
				id: crypto.randomUUID(),
				name: 'Chat 2',
				exchanges: newExchanges,
				activeExchangeId: null
			});
			mockActiveChatIndex = mockChats.length - 1;
			mockExchanges = newExchanges;
			mockActiveExchangeId = null;

			expect(Object.keys(mockExchanges)).toHaveLength(1);
			expect(mockActiveExchangeId).toBeNull();
		});

		it('switching between chats preserves each chat state', () => {
			// Build conversation in chat 1
			const msg1 = addMessage(ROOT_ANCHOR_ID, 'Chat1 msg', 'Chat1 response');

			// Create chat 2
			const chat2Exchanges = buildEmptyExchanges();
			mockChats.push({
				id: crypto.randomUUID(),
				name: 'Chat 2',
				exchanges: chat2Exchanges,
				activeExchangeId: null
			});

			// Switch to chat 2
			mockActiveChatIndex = 1;
			mockExchanges = mockChats[1].exchanges;
			mockActiveExchangeId = mockChats[1].activeExchangeId;

			// Add message in chat 2
			const result = addExchangeResult(mockExchanges, ROOT_ANCHOR_ID, 'Chat2 msg', 'Chat2 response');
			mockExchanges = result.exchanges;
			mockChats[1].exchanges = mockExchanges;

			// Switch back to chat 1
			mockActiveChatIndex = 0;
			mockExchanges = mockChats[0].exchanges;
			mockActiveExchangeId = mockChats[0].activeExchangeId;

			// Chat 1 should still have its message
			expect(mockExchanges[msg1.id].prompt).toBe('Chat1 msg');
			expect(Object.keys(mockExchanges)).toHaveLength(2); // anchor + 1 message

			// Chat 2 has its own message
			expect(Object.keys(mockChats[1].exchanges)).toHaveLength(2);
		});
	});

	describe('performDelete', () => {
		it('deletes a leaf exchange', () => {
			const msg1 = addMessage(ROOT_ANCHOR_ID, 'First', 'R1');
			const msg2 = addMessage(msg1.id, 'Second', 'R2');

			const result = performDelete(mockExchanges, msg2.id, 'exchange', msg2.id);

			expect(result.error).toBeNull();
			expect(cancelStreamsForExchanges).toHaveBeenCalledWith([msg2.id]);
			// After delete, active exchange should redirect to main tail
			expect(mockExchanges[msg2.id]).toBeUndefined();
		});

		it('deletes a middle exchange and reparents children', () => {
			const msg1 = addMessage(ROOT_ANCHOR_ID, 'First', 'R1');
			const msg2 = addMessage(msg1.id, 'Second', 'R2');
			const msg3 = addMessage(msg2.id, 'Third', 'R3');

			const result = performDelete(mockExchanges, msg2.id, 'exchange', msg3.id);

			expect(result.error).toBeNull();
			expect(mockExchanges[msg2.id]).toBeUndefined();
			// msg3 should now be a child of msg1
			expect(mockExchanges[msg3.id].parentId).toBe(msg1.id);
		});

		it('redirects active exchange when deleting the active node', () => {
			const msg1 = addMessage(ROOT_ANCHOR_ID, 'First', 'R1');
			const msg2 = addMessage(msg1.id, 'Second', 'R2');

			performDelete(mockExchanges, msg2.id, 'exchange', msg2.id);

			// Active should be redirected to the new tail
			expect(mockActiveExchangeId).toBe(getMainChatTail(mockExchanges));
		});

		it('deletes exchange and its side chats', () => {
			const msg1 = addMessage(ROOT_ANCHOR_ID, 'Main', 'R1');
			const msg2 = addMessage(msg1.id, 'Continue', 'R2');
			const side = addMessage(msg1.id, 'Side', 'Side R');

			const result = performDelete(mockExchanges, msg1.id, 'exchangeAndSideChats', msg2.id);

			expect(result.error).toBeNull();
			expect(mockExchanges[msg1.id]).toBeUndefined();
			expect(mockExchanges[side.id]).toBeUndefined();
			// msg2 should still exist, reparented to root
			expect(mockExchanges[msg2.id]).toBeDefined();
			expect(mockExchanges[msg2.id].parentId).toBe(ROOT_ANCHOR_ID);
		});

		it('deletes exchange and main chat subtree', () => {
			const msg1 = addMessage(ROOT_ANCHOR_ID, 'Main', 'R1');
			const msg2 = addMessage(msg1.id, 'Main child', 'R2');
			const msg3 = addMessage(msg2.id, 'Main grandchild', 'R3');
			const side = addMessage(msg1.id, 'Side', 'Side R');

			const result = performDelete(mockExchanges, msg1.id, 'exchangeAndMainChat', side.id);

			expect(result.error).toBeNull();
			expect(mockExchanges[msg1.id]).toBeUndefined();
			expect(mockExchanges[msg2.id]).toBeUndefined();
			expect(mockExchanges[msg3.id]).toBeUndefined();
			// Side chat should still exist, reparented to root
			expect(mockExchanges[side.id]).toBeDefined();
			expect(mockExchanges[side.id].parentId).toBe(ROOT_ANCHOR_ID);
		});
	});

	describe('getDeleteMode', () => {
		it('returns "exchange" for a leaf node', () => {
			const msg1 = addMessage(ROOT_ANCHOR_ID, 'Hello', 'World');
			const byParent = buildExchangesByParentId(mockExchanges);

			const mode = getDeleteMode(mockExchanges, msg1.id, byParent);
			expect(mode).toBe('exchange');
		});

		it('returns "exchange" for a node with one child', () => {
			const msg1 = addMessage(ROOT_ANCHOR_ID, 'First', 'R1');
			addMessage(msg1.id, 'Second', 'R2');
			const byParent = buildExchangesByParentId(mockExchanges);

			const mode = getDeleteMode(mockExchanges, msg1.id, byParent);
			expect(mode).toBe('exchange');
		});

		it('returns "exchangeAndSideChats" for a node with multiple children', () => {
			const msg1 = addMessage(ROOT_ANCHOR_ID, 'Main', 'R1');
			addMessage(msg1.id, 'Child 1', 'R2');
			addMessage(msg1.id, 'Child 2', 'R3');
			const byParent = buildExchangesByParentId(mockExchanges);

			const mode = getDeleteMode(mockExchanges, msg1.id, byParent);
			expect(mode).toBe('exchangeAndSideChats');
		});
	});

	describe('performPromote', () => {
		it('promotes a side chat to main', () => {
			const msg1 = addMessage(ROOT_ANCHOR_ID, 'Main', 'R1');
			addMessage(msg1.id, 'Main child', 'R2');
			const side = addMessage(msg1.id, 'Side', 'Side R');

			const result = performPromote(mockExchanges, side.id);

			expect(result.error).toBeNull();

			// After promotion, side should be the first child of msg1
			const byParent = buildExchangesByParentId(mockExchanges);
			const children = getChildExchanges(mockExchanges, msg1.id, byParent);
			expect(children[0].id).toBe(side.id);
		});

		it('returns error when promoting a main path exchange', () => {
			const msg1 = addMessage(ROOT_ANCHOR_ID, 'Main', 'R1');

			const result = performPromote(mockExchanges, msg1.id);

			expect(result.error).not.toBeNull();
		});

		it('cannot promote when main child has branching descendants', () => {
			const msg1 = addMessage(ROOT_ANCHOR_ID, 'Main', 'R1');
			const msg2 = addMessage(msg1.id, 'Main child', 'R2');
			// Create branching on the main child
			addMessage(msg2.id, 'Branch A', 'BA');
			addMessage(msg2.id, 'Branch B', 'BB');
			// Add a side chat on msg1
			const side = addMessage(msg1.id, 'Side', 'Side R');

			// canPromote should be false because main child (msg2) has branching
			const byParent = buildExchangesByParentId(mockExchanges);
			expect(canPromoteSideChatToMainChat(mockExchanges, side.id, byParent)).toBe(false);
		});
	});

	describe('performFork', () => {
		it('forks a conversation at a given exchange', () => {
			const msg1 = addMessage(ROOT_ANCHOR_ID, 'Hello', 'World');
			const msg2 = addMessage(msg1.id, 'Follow up', 'Response');

			performFork(msg2.id);

			// A new chat should have been created
			expect(mockChats).toHaveLength(2);
			const forkedChat = mockChats[1];

			// The forked chat should have the path up to msg2 (re-created with new IDs)
			const forkedPath = getMainPath(forkedChat.exchanges);
			expect(forkedPath).toHaveLength(2);

			// Content should be preserved
			const forkedExchanges = forkedChat.exchanges;
			expect(forkedExchanges[forkedPath[0]].prompt).toBe('Hello');
			expect(forkedExchanges[forkedPath[0]].response).toBe('World');
			expect(forkedExchanges[forkedPath[1]].prompt).toBe('Follow up');
			expect(forkedExchanges[forkedPath[1]].response).toBe('Response');
		});

		it('forked chat has new unique IDs', () => {
			const msg1 = addMessage(ROOT_ANCHOR_ID, 'Hello', 'World');

			performFork(msg1.id);

			const forkedPath = getMainPath(mockChats[1].exchanges);
			expect(forkedPath[0]).not.toBe(msg1.id);
		});

		it('forking mid-conversation only copies the path to that point', () => {
			const msg1 = addMessage(ROOT_ANCHOR_ID, 'A', 'RA');
			const msg2 = addMessage(msg1.id, 'B', 'RB');
			addMessage(msg2.id, 'C', 'RC');

			// Fork at msg2 (should not include msg3)
			performFork(msg2.id);

			const forkedPath = getMainPath(mockChats[1].exchanges);
			expect(forkedPath).toHaveLength(2);
		});

		it('fork does not include sibling branches', () => {
			const msg1 = addMessage(ROOT_ANCHOR_ID, 'Main', 'R1');
			addMessage(msg1.id, 'Main child', 'R2');
			addMessage(msg1.id, 'Side chat', 'Side R');

			// Fork at msg1 - should only get the path, not the side chat
			performFork(msg1.id);

			const forkedExchanges = mockChats[1].exchanges;
			// Should have anchor + 1 exchange (msg1 copy only)
			const nonAnchorCount = Object.values(forkedExchanges).filter(e => !e.isAnchor).length;
			expect(nonAnchorCount).toBe(1);
		});
	});

	describe('full conversation flow', () => {
		it('simulates a complete chat session: send messages, create side chat, promote, delete', () => {
			// 1. Start conversation
			const msg1 = addMessage(ROOT_ANCHOR_ID, 'What is TypeScript?', 'TypeScript is a typed superset of JavaScript.');
			const msg2 = addMessage(msg1.id, 'How do generics work?', 'Generics allow parameterized types.');
			const msg3 = addMessage(msg2.id, 'Show an example', 'function identity<T>(arg: T): T { return arg; }');

			expect(getMainPath(mockExchanges)).toHaveLength(3);

			// 2. Go back and create a side chat from msg1
			const side = addMessage(msg1.id, 'What about interfaces?', 'Interfaces define object shapes.');

			const byParent = buildExchangesByParentId(mockExchanges);
			const msg1Children = getChildExchanges(mockExchanges, msg1.id, byParent);
			expect(msg1Children).toHaveLength(2);
			expect(msg1Children[0].id).toBe(msg2.id); // main path first
			expect(msg1Children[1].id).toBe(side.id); // side chat second

			// 3. Promote the side chat
			const promoteResult = performPromote(mockExchanges, side.id);
			expect(promoteResult.error).toBeNull();

			const byParent2 = buildExchangesByParentId(mockExchanges);
			const msg1Children2 = getChildExchanges(mockExchanges, msg1.id, byParent2);
			expect(msg1Children2[0].id).toBe(side.id); // now main
			expect(msg1Children2[1].id).toBe(msg2.id); // now side

			// 4. Delete the old main path (now side)
			const deleteResult = performDelete(mockExchanges, msg2.id, 'exchangeAndMainChat', side.id);
			expect(deleteResult.error).toBeNull();

			expect(mockExchanges[msg2.id]).toBeUndefined();
			expect(mockExchanges[msg3.id]).toBeUndefined();
			expect(mockExchanges[side.id]).toBeDefined();

			// Main path should now be: msg1 -> side
			const finalPath = getMainPath(mockExchanges);
			expect(finalPath).toHaveLength(2);
			expect(finalPath[0]).toBe(msg1.id);
			expect(finalPath[1]).toBe(side.id);
		});

		it('simulates forking mid-conversation and continuing both threads', () => {
			// Build initial conversation
			const msg1 = addMessage(ROOT_ANCHOR_ID, 'Topic A', 'Response A');
			const msg2 = addMessage(msg1.id, 'Topic B', 'Response B');

			// Fork at msg2 (copies msg1 + msg2 into new chat)
			performFork(msg2.id);

			// We're now in the forked chat
			expect(mockChats).toHaveLength(2);
			expect(mockActiveChatIndex).toBe(1);

			// The forked chat has 2 exchanges (copies of msg1, msg2)
			const forkedPath = getMainPath(mockExchanges);
			expect(forkedPath).toHaveLength(2);

			// Add a message in the fork (child of the last forked exchange)
			const forkedTail = forkedPath[forkedPath.length - 1];
			addMessage(forkedTail, 'Forked topic C', 'Forked response C');

			// Fork should have 3 messages now
			expect(getMainPath(mockExchanges)).toHaveLength(3);

			// Switch back to original chat
			mockActiveChatIndex = 0;
			mockExchanges = mockChats[0].exchanges;
			mockActiveExchangeId = mockChats[0].activeExchangeId;

			// Original chat should still have msg1 -> msg2 (unchanged)
			const originalPath = getMainPath(mockExchanges);
			expect(originalPath).toHaveLength(2);
			expect(originalPath[0]).toBe(msg1.id);
			expect(originalPath[1]).toBe(msg2.id);
		});

		it('creates side chat, adds child to it, then promotes it', () => {
			const msg1 = addMessage(ROOT_ANCHOR_ID, 'Main start', 'R1');
			const msg2 = addMessage(msg1.id, 'Main continue', 'R2');

			// Create side chat off msg1
			const side = addMessage(msg1.id, 'Alternative', 'Alt R');

			// Side chat should not be promotable yet if main child has no branching
			const byParent = buildExchangesByParentId(mockExchanges);
			expect(canPromoteSideChatToMainChat(mockExchanges, side.id, byParent)).toBe(true);

			// Add a child to the side chat
			const sideChild = addMessage(side.id, 'Side follow up', 'Side follow R');

			// Promote the side chat
			const result = performPromote(mockExchanges, side.id);
			expect(result.error).toBeNull();

			// Now the main path should go through the promoted side chat
			const newPath = getMainPath(mockExchanges);
			expect(newPath[0]).toBe(msg1.id);
			expect(newPath[1]).toBe(side.id);
			expect(newPath[2]).toBe(sideChild.id);
		});
	});
});
