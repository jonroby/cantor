import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	addExchangeResult,
	buildEmptyTree,
	getChildExchanges,
	getMainChatTail,
	promoteSideChatToMainChat,
	updateExchangeResponse,
	type ChatTree,
	type ExchangeMap
} from '@/domain/tree';

// Mock streams module (uses Svelte runes internally)
vi.mock('@/services/streams', () => ({
	isStreaming: vi.fn(() => false),
	cancelStreamsForExchanges: vi.fn()
}));

vi.mock('@/lib/models', () => ({
	getProviderForModelId: vi.fn(() => 'claude')
}));

let mockTree: ChatTree = buildEmptyTree();
let mockActiveExchangeId: string | null = null;
const mockForkChat = vi.fn();

vi.mock('@/state/chats.svelte', () => ({
	replaceActiveTree: vi.fn((nextTree: ChatTree) => {
		mockTree = nextTree;
	}),
	setActiveExchangeId: vi.fn((id: string | null) => {
		mockActiveExchangeId = id;
	}),
	forkChat: (...args: unknown[]) => mockForkChat(...args)
}));

import {
	getDeleteMode,
	getExchangeNodeData,
	performDelete,
	performFork,
	performPromote
} from '@/features/chat-ops';
import { cancelStreamsForExchanges } from '@/services/streams';

const MODEL = 'claude-sonnet-4-6';
const PROVIDER = 'claude';

function resetState() {
	mockTree = buildEmptyTree();
	mockActiveExchangeId = null;
}

function addMessage(parentId: string, prompt: string, response = ''): string {
	const created = addExchangeResult(mockTree, parentId, prompt, MODEL, PROVIDER);
	mockTree = {
		rootId: created.rootId,
		exchanges: updateExchangeResponse(created.exchanges, created.id, response)
	};
	mockActiveExchangeId = created.id;
	return created.id;
}

function buildRootWithSideChat(): { rootId: string; mainId: string; sideId: string } {
	const rootId = addMessage('ignored', 'root', 'root response');
	const mainId = addMessage(rootId, 'main', 'main response');
	const sideId = addMessage(rootId, 'side', 'side response');
	return { rootId, mainId, sideId };
}

function makeCallbacks() {
	return {
		onMeasure: vi.fn(),
		onSelect: vi.fn(),
		onFork: vi.fn(),
		onToggleSideChildren: vi.fn(),
		onPromote: vi.fn(),
		onDelete: vi.fn()
	};
}

describe('chat-ops', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		resetState();
	});

	describe('getExchangeNodeData', () => {
		it('returns display data for a main-path exchange', () => {
			const rootId = addMessage('ignored', 'root', 'root response');
			const childId = addMessage(rootId, 'child prompt', 'child response');
			const callbacks = makeCallbacks();

			const data = getExchangeNodeData(
				childId,
				mockTree.exchanges,
				childId,
				callbacks
			);

			expect(data).not.toBeNull();
			expect(data!.prompt).toBe('child prompt');
			expect(data!.response).toBe('child response');
			expect(data!.isActive).toBe(true);
			expect(data!.isSideRoot).toBe(false);
			expect(data!.hasSideChildren).toBe(false);
		});

		it('detects side roots and promotion eligibility', () => {
			const { sideId } = buildRootWithSideChat();
			const callbacks = makeCallbacks();

			const data = getExchangeNodeData(sideId, mockTree.exchanges, sideId, callbacks);

			expect(data).not.toBeNull();
			expect(data!.isSideRoot).toBe(true);
			expect(data!.canPromote).toBe(true);
		});

		it('counts side children on a branching main node', () => {
			const rootId = addMessage('ignored', 'root', 'root response');
			const mainId = addMessage(rootId, 'main', 'main response');
			addMessage(mainId, 'main child', 'main child response');
			addMessage(mainId, 'side-1', 'side response');
			addMessage(mainId, 'side-2', 'side response');
			const callbacks = makeCallbacks();

			const data = getExchangeNodeData(mainId, mockTree.exchanges, mainId, callbacks);

			expect(data).not.toBeNull();
			expect(data!.hasSideChildren).toBe(true);
			expect(data!.sideChildrenCount).toBe(2);
		});

		it('returns null for the root exchange and missing exchanges', () => {
			const rootId = addMessage('ignored', 'root', 'root response');
			const callbacks = makeCallbacks();

			expect(getExchangeNodeData(rootId, mockTree.exchanges, rootId, callbacks)).toBeNull();
			expect(getExchangeNodeData('missing', mockTree.exchanges, null, callbacks)).toBeNull();
		});

		it('wires callbacks to the selected exchange id', () => {
			const rootId = addMessage('ignored', 'root', 'root response');
			const childId = addMessage(rootId, 'child', 'child response');
			const callbacks = makeCallbacks();
			const data = getExchangeNodeData(childId, mockTree.exchanges, childId, callbacks)!;

			data.onMeasure(42);
			data.onSelect();
			data.onFork();
			data.onToggleSideChildren();
			data.onPromote();
			data.onDelete();

			expect(callbacks.onMeasure).toHaveBeenCalledWith(childId, 42);
			expect(callbacks.onSelect).toHaveBeenCalledWith(childId);
			expect(callbacks.onFork).toHaveBeenCalledWith(childId);
			expect(callbacks.onToggleSideChildren).toHaveBeenCalledWith(childId);
			expect(callbacks.onPromote).toHaveBeenCalledWith(childId);
			expect(callbacks.onDelete).toHaveBeenCalledWith(childId);
		});
	});

	describe('performDelete', () => {
		it('deletes an exchange, updates the active selection, and cancels removed streams', () => {
			const rootId = addMessage('ignored', 'root', 'root response');
			const childId = addMessage(rootId, 'child', 'child response');
			const leafId = addMessage(childId, 'leaf', 'leaf response');

			const result = performDelete(mockTree.exchanges, childId, 'exchange', leafId);

			expect(result).toEqual({ error: null });
			expect(mockTree.exchanges[childId]).toBeUndefined();
			expect(mockTree.exchanges[leafId]!.parentId).toBe(rootId);
			expect(mockActiveExchangeId).toBe(leafId);
			expect(cancelStreamsForExchanges).toHaveBeenCalledWith([childId]);
		});

		it('keeps rootId in sync when deleting the root in exchangeAndMainChat mode', () => {
			const { rootId, mainId, sideId } = buildRootWithSideChat();
			addMessage(mainId, 'main leaf', 'main leaf response');

			const result = performDelete(mockTree.exchanges, rootId, 'exchangeAndMainChat', mainId);

			expect(result).toEqual({ error: null });
			expect(mockTree.rootId).toBe(sideId);
			expect(mockTree.exchanges[rootId]).toBeUndefined();
			expect(mockTree.exchanges[mainId]).toBeUndefined();
			expect(mockActiveExchangeId).toBe(sideId);
		});

		it('returns an error for invalid delete requests', () => {
			addMessage('ignored', 'root', 'root response');

			const result = performDelete(mockTree.exchanges, 'missing', 'exchange', null);

			expect(result.error).toContain('missing');
		});
	});

	describe('performPromote', () => {
		it('promotes a side branch and keeps it first in child order', () => {
			const { rootId, mainId, sideId } = buildRootWithSideChat();
			const expected = promoteSideChatToMainChat(mockTree, sideId);

			const result = performPromote(mockTree.exchanges, sideId);

			expect(result).toEqual({ error: null });
			expect(mockActiveExchangeId).toBe(sideId);
			expect(getChildExchanges(mockTree.exchanges, rootId).map((child) => child.id)).toEqual(
				getChildExchanges(expected.exchanges, rootId).map((child) => child.id)
			);
			expect(getChildExchanges(mockTree.exchanges, rootId).map((child) => child.id)).toEqual([
				sideId,
				mainId
			]);
		});

		it('returns an error when promoting a main-path exchange', () => {
			const { mainId } = buildRootWithSideChat();

			const result = performPromote(mockTree.exchanges, mainId);

			expect(result.error).toContain('not a side chat');
		});
	});

	describe('performFork', () => {
		it('delegates to chat state', () => {
			const rootId = addMessage('ignored', 'root', 'root response');
			const childId = addMessage(rootId, 'child', 'child response');

			performFork(childId);

			expect(mockForkChat).toHaveBeenCalledWith(childId);
		});
	});

	describe('getDeleteMode', () => {
		it('uses side-chat delete mode when an exchange has side branches', () => {
			const { rootId } = buildRootWithSideChat();

			expect(getDeleteMode(mockTree.exchanges, rootId)).toBe('exchangeAndSideChats');
		});

		it('uses simple delete mode for linear exchanges', () => {
			const rootId = addMessage('ignored', 'root', 'root response');
			const childId = addMessage(rootId, 'child', 'child response');

			expect(getDeleteMode(mockTree.exchanges, childId)).toBe('exchange');
			expect(getMainChatTail(mockTree)).toBe(childId);
		});
	});
});
