// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import ChatView from './ChatView.svelte';
import { chatState, getActiveExchanges } from '@/state/chats.svelte';
import { providerState } from '@/state/providers.svelte';
import {
	buildEmptyTree,
	addExchangeResult,
	getMainChatTail,
	getChildExchanges,
	type ChatTree,
	type Chat
} from '@/domain/tree';
import type { Provider } from '@/domain/models';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/state/services/streams', () => ({
	startStream: vi.fn(),
	cancelStream: vi.fn(),
	cancelAllStreams: vi.fn(),
	cancelStreamsForExchanges: vi.fn(),
	cancelStreamsForChat: vi.fn(),
	isStreaming: vi.fn(() => false),
	isAnyStreaming: vi.fn(() => false)
}));

vi.mock('@/view/shared/katex', () => ({
	renderRichText: (text: string) => text
}));

vi.mock('@/domain/document-map/index', () => ({
	mapDocument: (text: string) =>
		text ? [{ source: text, html: text }] : [],
	marked: { lexer: () => [], parser: () => '', parse: (t: string) => t }
}));

vi.mock('dompurify', () => ({
	default: { sanitize: (html: string) => html }
}));

vi.mock('@/domain/models/logos', () => ({
	PROVIDER_LOGOS: {}
}));

vi.mock('@/app/providers', () => ({
	connectOllama: vi.fn(),
	autoConnectOllama: vi.fn(),
	loadWebLLMModel_: vi.fn(),
	deleteWebLLMCache: vi.fn(),
	deleteAllWebLLMCaches: vi.fn(),
	unlockKeys: vi.fn(),
	saveKey: vi.fn(),
	forgetKey: vi.fn(),
	fetchOllamaContextLength: vi.fn(),
	getProviderStream: vi.fn(),
	init: vi.fn()
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

const MODEL = 'claude-sonnet-4-5';
const PROVIDER: Provider = 'claude';

function addExchange(tree: ChatTree, parentId: string, prompt: string, response: string): ChatTree {
	const result = addExchangeResult(tree, parentId, prompt, MODEL, PROVIDER);
	result.exchanges[result.id] = {
		...result.exchanges[result.id],
		response: { text: response, tokenCount: 10 }
	};
	return result;
}

/**
 * Builds a tree with visible exchanges.
 * Root is visible. N additional exchanges appear in the main path.
 */
function buildVisibleTree(n: number): ChatTree {
	let tree = buildEmptyTree();
	const root = addExchangeResult(tree, 'unused', 'Root prompt', MODEL, PROVIDER);
	tree = root;
	tree.exchanges[root.id] = {
		...tree.exchanges[root.id],
		response: { text: 'Root response', tokenCount: 10 }
	};

	let parentId = root.id;
	for (let i = 0; i < n; i++) {
		tree = addExchange(tree, parentId, `Prompt ${i + 1}`, `Response ${i + 1}`);
		parentId = getMainChatTail(tree)!;
	}
	return tree;
}

/**
 * Builds a tree with a side branch off a visible exchange.
 * Structure: root (visible) → e1 (visible) → e2 (visible, main)
 *                                           → side1 (visible, side branch)
 */
function buildTreeWithBranch(): { tree: ChatTree; branchParentId: string } {
	let tree = buildEmptyTree();
	// Root (hidden)
	const root = addExchangeResult(tree, 'unused', 'Root prompt', MODEL, PROVIDER);
	tree = root;
	tree.exchanges[root.id] = {
		...tree.exchanges[root.id],
		response: { text: 'Root response', tokenCount: 10 }
	};

	// First visible exchange (branch parent)
	tree = addExchange(tree, root.id, 'Main prompt 1', 'Main response 1');
	const e1Id = getMainChatTail(tree)!;

	// Main path child
	tree = addExchange(tree, e1Id, 'Main prompt 2', 'Main response 2');

	// Side branch off e1
	tree = addExchange(tree, e1Id, 'Side prompt 1', 'Side response 1');

	return { tree, branchParentId: e1Id };
}

function resetState(tree?: ChatTree) {
	const t = tree ?? buildEmptyTree();
	const chat: Chat = {
		id: crypto.randomUUID(),
		name: 'Test Chat',
		rootId: t.rootId,
		exchanges: t.exchanges,
		activeExchangeId: getMainChatTail(t)
	};
	chatState.chats = [chat];
	chatState.activeChatIndex = 0;
	providerState.activeModel = { provider: PROVIDER, modelId: MODEL };
	providerState.contextLength = 128000;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ChatView', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		resetState();
	});

	describe('empty chat', () => {
		it('shows starter text when no exchanges', () => {
			render(ChatView);
			expect(screen.getByText('Start a conversation below.')).toBeInTheDocument();
		});
	});

	describe('displaying messages', () => {
		it('renders prompt and response text for each exchange', () => {
			resetState(buildVisibleTree(2));
			render(ChatView);
			expect(screen.getByText('Prompt 1')).toBeInTheDocument();
			expect(screen.getByText('Response 1')).toBeInTheDocument();
			expect(screen.getByText('Prompt 2')).toBeInTheDocument();
			expect(screen.getByText('Response 2')).toBeInTheDocument();
		});

		it('shows chat name', () => {
			render(ChatView);
			expect(screen.getByText('Test Chat')).toBeInTheDocument();
		});
	});

	describe('submitting messages', () => {
		it('submitting a message adds it to the chat', async () => {
			resetState(buildVisibleTree(1));
			render(ChatView);

			const input = screen.getByRole('textbox');
			await userEvent.type(input, 'New message');
			await userEvent.click(screen.getByRole('button', { name: 'Send message' }));
			await tick();

			expect(screen.getByText('New message')).toBeInTheDocument();
		});

		it('clears input after submit', async () => {
			resetState(buildVisibleTree(1));
			render(ChatView);

			const input = screen.getByRole('textbox');
			await userEvent.type(input, 'Test message');
			await userEvent.click(screen.getByRole('button', { name: 'Send message' }));
			await tick();

			expect(input).toHaveValue('');
		});

		it('send button disabled without a model', () => {
			providerState.activeModel = null;
			render(ChatView);
			expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
			expect(screen.getByText('Select a model first.')).toBeInTheDocument();
		});

		it('calls startStream after submit', async () => {
			const { startStream } = await import('@/state/services/streams');
			resetState(buildVisibleTree(1));
			render(ChatView);

			const input = screen.getByRole('textbox');
			await userEvent.type(input, 'Hello');
			await userEvent.click(screen.getByRole('button', { name: 'Send message' }));
			await tick();

			expect(startStream).toHaveBeenCalledOnce();
		});
	});

	describe('side chat', () => {
		it('clicking branch badge opens side panel', async () => {
			const { tree } = buildTreeWithBranch();
			resetState(tree);
			render(ChatView);

			// e1 has 2 children (main + side), so branch badge shows "1" (sideChildrenCount)
			// The badge button contains the count
			const badge = screen.getByText('1');
			await userEvent.click(badge);
			await tick();

			expect(screen.getByText('Branching from')).toBeInTheDocument();
		});

		it('side panel shows parent exchange context', async () => {
			const { tree } = buildTreeWithBranch();
			resetState(tree);
			render(ChatView);

			await userEvent.click(screen.getByText('1'));
			await tick();

			// The parent exchange text appears in both the main pane and the side panel context
			const matches = screen.getAllByText('Main prompt 1');
			expect(matches.length).toBeGreaterThanOrEqual(2);
		});

		it('side panel shows branch exchanges', async () => {
			const { tree } = buildTreeWithBranch();
			resetState(tree);
			render(ChatView);

			await userEvent.click(screen.getByText('1'));
			await tick();

			expect(screen.getByText('Side prompt 1')).toBeInTheDocument();
			expect(screen.getByText('Side response 1')).toBeInTheDocument();
		});

		it('close button closes side panel', async () => {
			const { tree } = buildTreeWithBranch();
			resetState(tree);
			render(ChatView);

			await userEvent.click(screen.getByText('1'));
			await tick();

			await userEvent.click(screen.getByRole('button', { name: 'Close side panel' }));
			await tick();

			expect(screen.queryByText('Branching from')).not.toBeInTheDocument();
		});

		it('submitting in side panel adds exchange to side branch', async () => {
			const { tree, branchParentId } = buildTreeWithBranch();
			resetState(tree);
			render(ChatView);

			await userEvent.click(screen.getByText('1'));
			await tick();

			const input = screen.getByRole('textbox');
			await userEvent.type(input, 'Side message');
			await userEvent.click(screen.getByRole('button', { name: 'Send message' }));
			await tick();

			const exchanges = getActiveExchanges();
			const branchChildren = getChildExchanges(exchanges, branchParentId);
			expect(branchChildren.length).toBe(2);
		});

		it('new side chat button creates empty branch state', async () => {
			const { tree } = buildTreeWithBranch();
			resetState(tree);
			render(ChatView);

			await userEvent.click(screen.getByText('1'));
			await tick();

			await userEvent.click(screen.getByRole('button', { name: 'New side chat' }));
			await tick();

			expect(screen.getByText('Type a message to start a side chat.')).toBeInTheDocument();
		});
	});

	describe('branch navigation', () => {
		it('shows branch counter in side panel', async () => {
			let tree = buildEmptyTree();
			const root = addExchangeResult(tree, 'unused', 'Root', MODEL, PROVIDER);
			tree = root;
			tree.exchanges[root.id] = {
				...tree.exchanges[root.id],
				response: { text: 'Root resp', tokenCount: 10 }
			};

			// Visible exchange
			tree = addExchange(tree, root.id, 'Main', 'Main resp');
			const e1Id = getMainChatTail(tree)!;

			// Main path continuation
			tree = addExchange(tree, e1Id, 'Main 2', 'Main resp 2');

			// Two side branches
			tree = addExchange(tree, e1Id, 'Side A', 'Side resp A');
			tree = addExchange(tree, e1Id, 'Side B', 'Side resp B');

			resetState(tree);
			render(ChatView);

			// Badge shows "2" for two side children
			await userEvent.click(screen.getByText('2'));
			await tick();

			expect(screen.getByText('2 / 2')).toBeInTheDocument();
		});
	});

	describe('delete workflow', () => {
		it('clicking delete opens confirmation dialog', async () => {
			resetState(buildVisibleTree(2));
			render(ChatView);

			const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
			await userEvent.click(deleteButtons[0]);
			await tick();

			expect(screen.getByText('Delete exchange')).toBeInTheDocument();
			expect(screen.getByText('Confirm delete')).toBeInTheDocument();
		});

		it('confirming delete removes the exchange', async () => {
			resetState(buildVisibleTree(2));
			render(ChatView);

			const beforeCount = Object.keys(getActiveExchanges()).length;

			const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
			await userEvent.click(deleteButtons[0]);
			await tick();

			await userEvent.click(screen.getByText('Confirm delete'));
			await tick();

			const afterCount = Object.keys(getActiveExchanges()).length;
			expect(afterCount).toBeLessThan(beforeCount);
		});

		it('cancel closes delete dialog without removing', async () => {
			resetState(buildVisibleTree(2));
			render(ChatView);

			const beforeCount = Object.keys(getActiveExchanges()).length;

			const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
			await userEvent.click(deleteButtons[0]);
			await tick();

			await userEvent.click(screen.getByText('Cancel'));
			await tick();

			expect(screen.queryByText('Delete exchange')).not.toBeInTheDocument();
			expect(Object.keys(getActiveExchanges()).length).toBe(beforeCount);
		});
	});

	describe('copy', () => {
		it('copy button is available on exchanges', () => {
			resetState(buildVisibleTree(1));
			render(ChatView);
			const copyButtons = screen.getAllByRole('button', { name: 'Copy' });
			expect(copyButtons.length).toBeGreaterThan(0);
		});
	});
});
