import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';
import * as domain from '@/domain';

vi.mock('jszip', async () => {
	const mocks = await import('@tests/mocks/jszip');
	return await mocks.mockJSZipModule();
});
vi.mock('@/state', async () => {
	const mocks = await import('@tests/mocks/state');
	return await mocks.mockStateModule();
});
vi.mock('@/external', async () => {
	const mocks = await import('@tests/mocks/external');
	return await mocks.mockExternalModule();
});

import * as chat from '../index';
import * as state from '@/state';
import * as external from '@/external';

import {
	deleteExchange,
	promoteExchange,
	copyChat,
	quickAsk,
	submitPrompt,
	addDocumentToChat,
	type ChatActionDeps
} from '../index';

// ── Helpers ─────────────────────────────────────────────────────────────────

function setResponse(
	tree: domain.tree.ChatTree,
	exchangeId: string,
	text: string
): domain.tree.ChatTree {
	return {
		...tree,
		exchanges: domain.tree.updateExchangeResponse(tree.exchanges, exchangeId, text)
	};
}

const PROVIDER: domain.models.Provider = 'claude';
const MODEL = 'claude-sonnet-4-6';

function mockDeps(overrides?: Partial<ChatActionDeps>): ChatActionDeps {
	return {
		addChat: vi.fn(() => 0),
		getActiveChat: vi.fn(() => ({
			id: 'chat-1',
			name: 'Chat 1',
			rootId: null,
			exchanges: {},
			activeExchangeId: null,
			contextStrategy: 'full' as const,
			mode: 'chat' as const
		})),
		replaceActiveTree: vi.fn(),
		setActiveExchangeId: vi.fn(),
		isStreaming: vi.fn(() => false),
		cancelStreamsForExchanges: vi.fn(),
		...overrides
	};
}

function buildLinearTree(): {
	tree: domain.tree.ChatTree;
	rootId: string;
	childId: string;
	leafId: string;
} {
	let tree = domain.tree.buildEmptyTree();
	const root = domain.tree.addExchange(tree, 'ignored', 'root prompt', MODEL, PROVIDER);
	tree = root.tree;
	tree = setResponse(tree, root.id, 'root response');
	const child = domain.tree.addExchange(tree, root.id, 'child prompt', MODEL, PROVIDER);
	tree = child.tree;
	tree = setResponse(tree, child.id, 'child response');
	const leaf = domain.tree.addExchange(tree, child.id, 'leaf prompt', MODEL, PROVIDER);
	return { tree: leaf.tree, rootId: root.id, childId: child.id, leafId: leaf.id };
}

function buildTreeWithSideChat(): {
	tree: domain.tree.ChatTree;
	rootId: string;
	mainId: string;
	sideId: string;
} {
	let tree = domain.tree.buildEmptyTree();
	const root = domain.tree.addExchange(tree, 'ignored', 'root prompt', MODEL, PROVIDER);
	tree = root.tree;
	tree = setResponse(tree, root.id, 'root response');
	const main = domain.tree.addExchange(tree, root.id, 'main prompt', MODEL, PROVIDER);
	tree = main.tree;
	const side = domain.tree.addExchange(tree, root.id, 'side prompt', MODEL, PROVIDER);
	return { tree: side.tree, rootId: root.id, mainId: main.id, sideId: side.id };
}

// ── Transfer helpers ────────────────────────────────────────────────────────

let nextPickedFile: File | null;
let downloads: Array<{ blob: Blob; filename: string }>;

type TransferFeedback = {
	success: Mock;
	error: Mock;
};

function createFeedback(): TransferFeedback {
	return {
		success: vi.fn(),
		error: vi.fn()
	};
}

async function flushAsyncWork() {
	await Promise.resolve();
	await Promise.resolve();
}

function buildValidUploadData() {
	let tree = domain.tree.buildEmptyTree();
	const result = domain.tree.addExchange(tree, 'unused', 'hello', 'claude-sonnet-4-6', 'claude');
	tree = {
		rootId: result.tree.rootId,
		exchanges: domain.tree.updateExchangeResponse(result.tree.exchanges, result.id, 'response')
	};

	return {
		id: 'uploaded-id',
		name: 'Uploaded Chat',
		rootId: tree.rootId,
		activeExchangeId: result.id,
		exchanges: tree.exchanges
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	nextPickedFile = null;
	downloads = [];
	vi.mocked(external.io.validateChatUpload).mockImplementation(
		(data) =>
			({
				id: (data as ReturnType<typeof buildValidUploadData>).id,
				name: (data as ReturnType<typeof buildValidUploadData>).name,
				tree: {
					rootId: (data as ReturnType<typeof buildValidUploadData>).rootId,
					exchanges: (data as ReturnType<typeof buildValidUploadData>).exchanges
				},
				activeExchangeId: (data as ReturnType<typeof buildValidUploadData>).activeExchangeId
			}) as ReturnType<typeof external.io.validateChatUpload>
	);
	vi.mocked(external.io.pickFile).mockImplementation(async () => nextPickedFile);
	vi.mocked(external.io.downloadBlob).mockImplementation((blob, filename) => {
		downloads.push({ blob, filename });
	});

	const defaultData = buildValidUploadData();
	state.chats.chatState.chats = [
		{
			id: 'chat-1',
			name: 'Test Chat',
			rootId: defaultData.rootId,
			activeExchangeId: defaultData.activeExchangeId,
			exchanges: defaultData.exchanges,
			contextStrategy: 'full',
			mode: 'chat'
		}
	] as typeof state.chats.chatState.chats;
	state.chats.chatState.activeChatIndex = 0;
});

// ── Public API ──────────────────────────────────────────────────────────────

describe('public API', () => {
	it('exposes the expected public API', () => {
		expect(Object.keys(chat).sort()).toEqual([
			'addDocumentToChat',
			'canCreateSideChat',
			'canPromoteSideChat',
			'canSubmitPrompt',
			'copyChat',
			'createChat',
			'deleteExchange',
			'exportChat',
			'exportState',
			'getActiveChatIndex',
			'getActiveExchangeId',
			'getChat',
			'getChats',
			'getContextStrategy',
			'getEnabledToolNames',
			'getExchangePath',
			'getMainChat',
			'getMode',
			'getSideChats',
			'getTotalTokens',
			'getUsedTokens',
			'importChat',
			'isStreaming',
			'promoteExchange',
			'quickAsk',
			'removeChat',
			'renameChat',
			'selectChat',
			'selectExchange',
			'setContextStrategy',
			'setEnabledToolNames',
			'setMode',
			'stopChatStreams',
			'stopStream',
			'submitPrompt'
		]);
	});
});

// ── addDocumentToChat ───────────────────────────────────────────────────────

describe('addDocumentToChat', () => {
	it('adds a labeled document exchange and activates it', () => {
		const { tree, leafId } = buildLinearTree();
		const deps = mockDeps();

		const addedId = addDocumentToChat(tree, leafId, '# Notes', 'notes.md', deps);
		const nextTree = vi.mocked(deps.replaceActiveTree).mock.calls[0]?.[0];

		expect(addedId).toBeTruthy();
		expect(deps.replaceActiveTree).toHaveBeenCalledOnce();
		expect(deps.setActiveExchangeId).toHaveBeenCalledWith(addedId);
		expect(nextTree?.exchanges[addedId]?.prompt.text).toBe('# Notes');
		expect(nextTree?.exchanges[addedId]?.label).toBe('notes.md was added to chat');
	});
});

// ── deleteExchange ──────────────────────────────────────────────────────────

describe('deleteExchange', () => {
	it('deletes exchange, cancels streams, replaces tree, returns no error', () => {
		const { tree, leafId, childId } = buildLinearTree();
		const deps = mockDeps();
		const result = deleteExchange(tree, leafId, 'exchange', childId, undefined, deps);
		expect(result.error).toBeNull();
		expect(deps.cancelStreamsForExchanges).toHaveBeenCalledWith([leafId]);
		expect(deps.replaceActiveTree).toHaveBeenCalled();
	});

	it('redirects activeExchangeId to main chat tail when deleting active exchange', () => {
		const { tree, leafId } = buildLinearTree();
		const deps = mockDeps();
		deleteExchange(tree, leafId, 'exchange', leafId, undefined, deps);
		expect(deps.setActiveExchangeId).toHaveBeenCalled();
	});

	it('does not redirect activeExchangeId when deleting non-active exchange', () => {
		const { tree, leafId, childId } = buildLinearTree();
		const deps = mockDeps();
		deleteExchange(tree, leafId, 'exchange', childId, undefined, deps);
		expect(deps.setActiveExchangeId).not.toHaveBeenCalled();
	});

	it('calls onResetMeasuredHeights when provided', () => {
		const { tree, leafId } = buildLinearTree();
		const onReset = vi.fn();
		deleteExchange(tree, leafId, 'exchange', null, onReset, mockDeps());
		expect(onReset).toHaveBeenCalled();
	});

	it('returns error when domain throws', () => {
		const { tree } = buildLinearTree();
		const result = deleteExchange(tree, 'nonexistent', 'exchange', null, undefined, mockDeps());
		expect(result.error).toBeTypeOf('string');
	});
});

// ── promoteExchange ─────────────────────────────────────────────────────────

describe('promoteExchange', () => {
	it('promotes side chat, updates state, returns no error', () => {
		const { tree, sideId } = buildTreeWithSideChat();
		const deps = mockDeps();
		const result = promoteExchange(tree, sideId, undefined, deps);
		expect(result.error).toBeNull();
		expect(deps.setActiveExchangeId).toHaveBeenCalledWith(sideId);
		expect(deps.replaceActiveTree).toHaveBeenCalled();
	});

	it('calls onResetMeasuredHeights when provided', () => {
		const { tree, sideId } = buildTreeWithSideChat();
		const onReset = vi.fn();
		promoteExchange(tree, sideId, onReset, mockDeps());
		expect(onReset).toHaveBeenCalled();
	});

	it('returns error and does not mutate state when domain throws (non-side-root)', () => {
		const { tree, mainId } = buildTreeWithSideChat();
		const deps = mockDeps();
		const result = promoteExchange(tree, mainId, undefined, deps);
		expect(result.error).toBeTypeOf('string');
		expect(result.error!.length).toBeGreaterThan(0);
		expect(deps.setActiveExchangeId).not.toHaveBeenCalled();
		expect(deps.replaceActiveTree).not.toHaveBeenCalled();
	});

	it('returns error and does not mutate state for nonexistent exchange', () => {
		const { tree } = buildTreeWithSideChat();
		const deps = mockDeps();
		const result = promoteExchange(tree, 'nonexistent', undefined, deps);
		expect(result.error).toBeTypeOf('string');
		expect(deps.setActiveExchangeId).not.toHaveBeenCalled();
		expect(deps.replaceActiveTree).not.toHaveBeenCalled();
	});
});

// ── copyChat ────────────────────────────────────────────────────────────────

describe('copyChat', () => {
	it('creates a copied chat from the selected path', () => {
		const { tree, leafId } = buildLinearTree();
		const deps = mockDeps();
		vi.mocked(deps.getActiveChat).mockReturnValue({
			id: 'chat-1',
			name: 'Source',
			rootId: tree.rootId,
			exchanges: tree.exchanges,
			activeExchangeId: leafId,
			contextStrategy: 'full',
			mode: 'chat'
		});

		copyChat(leafId, deps);

		expect(deps.addChat).toHaveBeenCalledOnce();
		const added = vi.mocked(deps.addChat).mock.calls[0]![0];
		expect(added.name).toBe('Copy Path (1)');
		expect(() =>
			domain.tree.validateChatTree({ rootId: added.rootId, exchanges: added.exchanges })
		).not.toThrow();
	});
});

// ── submitPrompt ────────────────────────────────────────────────────────────

describe('submitPrompt', () => {
	const activeModel = { modelId: MODEL, provider: PROVIDER, label: MODEL };

	it('returns parentId so caller can expand the correct side chat parent', () => {
		const { tree, childId } = buildLinearTree();
		const deps = mockDeps();
		const result = submitPrompt(
			'chat-1',
			tree,
			childId,
			'new prompt',
			activeModel,
			undefined,
			deps
		);
		expect(result.parentId).toBe(childId);
	});

	it('returns parentId as main chat tail when activeExchangeId is null', () => {
		const { tree, leafId } = buildLinearTree();
		const deps = mockDeps();
		const result = submitPrompt('chat-1', tree, null, 'new prompt', activeModel, undefined, deps);
		expect(result.parentId).toBe(leafId);
	});
});

describe('quickAsk', () => {
	const activeModel = { modelId: MODEL, provider: PROVIDER, label: MODEL };

	it('wraps the source text in the quick ask prompt template', () => {
		const { tree, childId } = buildLinearTree();
		const deps = mockDeps();

		quickAsk('chat-1', tree, childId, 'Selected paragraph', activeModel, deps);

		expect(deps.replaceActiveTree).toHaveBeenCalledOnce();
		const createdTree = vi.mocked(deps.replaceActiveTree).mock.calls[0]![0];
		const createdExchangeId = vi.mocked(deps.setActiveExchangeId).mock.calls[0]![0] as string;
		expect(createdTree.exchanges[createdExchangeId]?.prompt.text).toBe(
			'Can you explain more:\n\nSelected paragraph'
		);
	});
});

// ── exportState ─────────────────────────────────────────────────────────────

describe('chat.exportState', () => {
	it('creates a JSON blob and triggers download', () => {
		chat.exportState();

		expect(external.io.downloadBlob).toHaveBeenCalledOnce();
		expect(downloads[0]?.filename).toMatch(/^chat-tree-\d+\.json$/);
	});
});

// ── exportChat ──────────────────────────────────────────────────────────────

describe('chat.exportChat', () => {
	it('downloads a single chat as JSON', () => {
		chat.exportChat(0);

		expect(external.io.downloadBlob).toHaveBeenCalledOnce();
		expect(downloads[0]?.filename).toBe('Test Chat.json');
	});

	it('strips invalid filename characters', () => {
		state.chats.chatState.chats[0].name = 'Chat/With:Bad*Chars?';
		chat.exportChat(0);

		expect(downloads[0]?.filename).toBe('ChatWithBadChars.json');
	});
});

// ── importChat ──────────────────────────────────────────────────────────────

describe('chat.importChat', () => {
	it('imports a valid chat file', async () => {
		const feedback = createFeedback();
		const fileContent = JSON.stringify(buildValidUploadData());
		const file = new File([fileContent], 'Imported Chat.json', { type: 'application/json' });
		nextPickedFile = file;
		chat.importChat(feedback);
		await vi.waitFor(() => {
			expect(feedback.success).toHaveBeenCalled();
		});

		expect(state.chats.chatState.chats.length).toBe(2);
		expect(state.chats.chatState.activeChatIndex).toBe(1);
		expect(state.chats.chatState.chats[1].name).toBe('Imported Chat');
		expect(state.chats.chatState.chats[1].id).not.toBe('uploaded-id');
		expect(state.chats.chatState.chats[1].activeExchangeId).toBeDefined();
	});

	it('deduplicates imported chat names based on the filename', async () => {
		const feedback = createFeedback();
		state.chats.chatState.chats[0].name = 'Imported Chat';

		const file = new File([JSON.stringify(buildValidUploadData())], 'Imported Chat.json', {
			type: 'application/json'
		});
		nextPickedFile = file;
		chat.importChat(feedback);
		await vi.waitFor(() => {
			expect(feedback.success).toHaveBeenCalled();
		});

		expect(state.chats.chatState.chats[1].name).toBe('Imported Chat (1)');
	});

	it('shows error toast for invalid JSON', async () => {
		const feedback = createFeedback();

		const file = new File(['not json'], 'bad.json', { type: 'application/json' });
		nextPickedFile = file;
		chat.importChat(feedback);

		await vi.waitFor(() => {
			expect(feedback.error).toHaveBeenCalled();
		});
	});

	it('does nothing when no file selected', async () => {
		const feedback = createFeedback();
		nextPickedFile = null;
		chat.importChat(feedback);
		await flushAsyncWork();

		expect(feedback.success).not.toHaveBeenCalled();
		expect(feedback.error).not.toHaveBeenCalled();
	});
});
