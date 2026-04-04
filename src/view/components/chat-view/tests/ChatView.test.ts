// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import ChatView from '../ChatView.svelte';
import ChatViewTestWrapper from './ChatViewTestWrapper.svelte';
import * as state from '@/state';
import * as domain from '@/domain';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/external', async () => {
	const { createExternalMock } = await import('@tests/mocks/external');
	return createExternalMock({
		providers: {
			webllm: {
				getWebLLMModels: vi.fn(async () => [])
			},
			vault: {
				storedProviders: vi.fn(() => [])
			}
		},
		persistence: {
			getPersistedLayout: vi.fn(() => ({}))
		}
	});
});

vi.mock('@/view/lib/katex', () => ({
	renderRichText: (text: string) => text,
	renderMarkdownKatexBlocks: (text: string) => (text ? [{ source: text, html: text }] : [])
}));

vi.mock('katex', () => ({
	default: { renderToString: (tex: string) => tex }
}));

vi.mock('marked', () => ({
	Marked: class {
		lexer(md: string) {
			return md ? [{ type: 'paragraph', raw: md }] : [];
		}
		parser(tokens: Array<{ raw: string }>) {
			return tokens.map((token) => token.raw).join('');
		}
		parse(md: string) {
			return md;
		}
	}
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

const MODEL = 'claude-sonnet-4-5';
const PROVIDER: domain.models.Provider = 'claude';

function addExchange(
	tree: domain.tree.ChatTree,
	parentId: string,
	prompt: string,
	response: string
): domain.tree.ChatTree {
	const result = domain.tree.addExchange(tree, parentId, prompt, MODEL, PROVIDER);
	result.tree.exchanges[result.id] = {
		...result.tree.exchanges[result.id],
		response: { text: response, tokenCount: 10 }
	};
	return result.tree;
}

/**
 * Builds a tree with visible exchanges.
 * Root is visible. N additional exchanges appear in the main path.
 */
function buildVisibleTree(n: number): domain.tree.ChatTree {
	let tree = domain.tree.buildEmptyTree();
	const root = domain.tree.addExchange(tree, 'unused', 'Root prompt', MODEL, PROVIDER);
	tree = root.tree;
	tree.exchanges[root.id] = {
		...tree.exchanges[root.id],
		response: { text: 'Root response', tokenCount: 10 }
	};

	let parentId = root.id;
	for (let i = 0; i < n; i++) {
		tree = addExchange(tree, parentId, `Prompt ${i + 1}`, `Response ${i + 1}`);
		parentId = domain.tree.getMainChatTail(tree)!;
	}
	return tree;
}

/**
 * Builds a tree with a side chat off a visible exchange.
 * Structure: root (visible) → e1 (visible) → e2 (visible, main)
 *                                           → side1 (visible, side chat)
 */
function buildTreeWithSideChat(): { tree: domain.tree.ChatTree; sideChatParentId: string } {
	let tree = domain.tree.buildEmptyTree();
	// Root (hidden)
	const root = domain.tree.addExchange(tree, 'unused', 'Root prompt', MODEL, PROVIDER);
	tree = root.tree;
	tree.exchanges[root.id] = {
		...tree.exchanges[root.id],
		response: { text: 'Root response', tokenCount: 10 }
	};

	// First visible exchange (side-chat parent)
	tree = addExchange(tree, root.id, 'Main prompt 1', 'Main response 1');
	const e1Id = domain.tree.getMainChatTail(tree)!;

	// Main path child
	tree = addExchange(tree, e1Id, 'Main prompt 2', 'Main response 2');

	// Side chat off e1
	tree = addExchange(tree, e1Id, 'Side prompt 1', 'Side response 1');

	return { tree, sideChatParentId: e1Id };
}

function resetState(tree?: domain.tree.ChatTree) {
	const t = tree ?? domain.tree.buildEmptyTree();
	const chat: state.chats.ChatRecord = {
		id: crypto.randomUUID(),
		name: 'Test Chat',
		rootId: t.rootId,
		exchanges: t.exchanges,
		activeExchangeId: domain.tree.getMainChatTail(t),
		contextStrategy: 'full',
		mode: 'chat'
	};
	state.chats.chatState.chats = [chat];
	state.chats.chatState.activeChatIndex = 0;
	state.providers.providerState.activeModel = { provider: PROVIDER, modelId: MODEL };
	state.providers.providerState.contextLength = 128000;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ChatView', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		Object.defineProperty(globalThis, 'localStorage', {
			value: {
				getItem: vi.fn(() => null),
				setItem: vi.fn(),
				removeItem: vi.fn()
			},
			configurable: true
		});
		resetState();
		state.documents.documentState.folders = [];
		state.documents.documentState.openDocuments = [];
	});

	describe('empty chat', () => {
		it('shows starter text when no exchanges', () => {
			render(ChatView);
			expect(screen.getByText(/How can I help you\?|Select a model/)).toBeInTheDocument();
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

		it.skip('renders activity for the main exchange and for a side-chat exchange in the side pane', async () => {
			const { tree } = buildTreeWithSideChat();
			resetState(tree);
			const mainTailId = domain.tree.getMainChatTail(tree)!;
			const sideExchangeId = Object.values(tree.exchanges).find(
				(exchange) => exchange.prompt.text === 'Side prompt 1'
			)!.id;
			state.agent.agentState.thinkingByExchangeId = {
				[mainTailId]: [
					{
						id: 'main-note',
						exchangeId: mainTailId,
						type: 'note',
						text: 'Main agent step',
						createdAt: Date.now()
					}
				],
				[sideExchangeId]: [
					{
						id: 'side-call',
						exchangeId: sideExchangeId,
						type: 'tool_call',
						text: 'inspect_workspace({})',
						createdAt: Date.now()
					}
				]
			};
			state.agent.agentState.expandedByExchangeId = {
				[mainTailId]: true,
				[sideExchangeId]: true
			};

			render(ChatView);
			expect(screen.getAllByText('Main agent step').length).toBeGreaterThan(0);

			await userEvent.click(screen.getByText('1'));
			await tick();

			expect(screen.getAllByText('inspect_workspace({})').length).toBeGreaterThan(0);
		});
	});

	describe('submitting messages', () => {
		it('submitting a message adds it to the chat', async () => {
			resetState(buildVisibleTree(1));
			render(ChatViewTestWrapper);

			const input = screen.getByRole('textbox');
			await userEvent.type(input, 'New message');
			await userEvent.click(screen.getByRole('button', { name: 'Send message' }));
			await tick();

			expect(screen.getByText('New message')).toBeInTheDocument();
		});

		it('clears input after submit', async () => {
			resetState(buildVisibleTree(1));
			render(ChatViewTestWrapper);

			const input = screen.getByRole('textbox');
			await userEvent.type(input, 'Test message');
			await userEvent.click(screen.getByRole('button', { name: 'Send message' }));
			await tick();

			expect(input).toHaveValue('');
		});

		it('send button disabled without a model', () => {
			state.providers.providerState.activeModel = null;
			render(ChatViewTestWrapper);
			expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
		});

		it('calls startStream after submit', async () => {
			const { streams } = await import('@/external');
			resetState(buildVisibleTree(1));
			render(ChatViewTestWrapper);

			const input = screen.getByRole('textbox');
			await userEvent.type(input, 'Hello');
			await userEvent.click(screen.getByRole('button', { name: 'Send message' }));
			await tick();

			expect(streams.startStream).toHaveBeenCalledOnce();
		});
	});

	describe('side chat', () => {
		it('clicking side chat badge opens side panel via workspace', async () => {
			const { tree, sideChatParentId } = buildTreeWithSideChat();
			resetState(tree);
			render(ChatView);

			// e1 has 2 children (main + side), so the side chat badge shows "1".
			const badge = screen.getByText('1');
			await userEvent.click(badge);
			await tick();

			const panels = state.workspace.workspaceState.panels;
			expect(panels.some((p) => p.type === 'side-chat')).toBe(true);
			const sideChatPanel = panels.find((p) => p.type === 'side-chat');
			expect(sideChatPanel).toMatchObject({
				type: 'side-chat',
				parentExchangeId: sideChatParentId
			});
		});

		it('revealExchange opens the side panel via workspace for a side-chat exchange', async () => {
			const { tree, sideChatParentId } = buildTreeWithSideChat();
			resetState(tree);
			const view = render(ChatView);

			const sideExchangeId = Object.values(tree.exchanges).find(
				(exchange) => exchange.prompt.text === 'Side prompt 1'
			)!.id;

			await view.component.revealExchange(sideExchangeId);
			await tick();

			const panels = state.workspace.workspaceState.panels;
			expect(panels.some((p) => p.type === 'side-chat')).toBe(true);
			const sideChatPanel = panels.find((p) => p.type === 'side-chat');
			expect(sideChatPanel).toMatchObject({
				type: 'side-chat',
				parentExchangeId: sideChatParentId
			});
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

			const beforeCount = Object.keys(state.chats.getActiveTree().exchanges).length;

			const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
			await userEvent.click(deleteButtons[0]);
			await tick();

			await userEvent.click(screen.getByText('Confirm delete'));
			await tick();

			const afterCount = Object.keys(state.chats.getActiveTree().exchanges).length;
			expect(afterCount).toBeLessThan(beforeCount);
		});

		it('cancel closes delete dialog without removing', async () => {
			resetState(buildVisibleTree(2));
			render(ChatView);

			const beforeCount = Object.keys(state.chats.getActiveTree().exchanges).length;

			const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
			await userEvent.click(deleteButtons[0]);
			await tick();

			await userEvent.click(screen.getByText('Cancel'));
			await tick();

			expect(screen.queryByText('Delete exchange')).not.toBeInTheDocument();
			expect(Object.keys(state.chats.getActiveTree().exchanges).length).toBe(beforeCount);
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

	describe('document panel', () => {
		function setupDocumentPanel() {
			state.documents.documentState.folders = [
				{
					id: 'folder-1',
					name: 'Docs',
					files: [{ id: 'file-1', name: 'notes.md', content: '# My Notes' }]
				}
			];
			state.documents.documentState.openDocuments = [
				{
					id: 'doc-1',
					content: '# My Notes',
					documentKey: { folderId: 'folder-1', fileId: 'file-1' }
				}
			];
		}

		it('opens a document panel via exported method', async () => {
			resetState(buildVisibleTree(1));
			setupDocumentPanel();
			const { component } = render(ChatView);

			component.showDocument('folder-1', 'file-1');
			await tick();

			// The side panel becomes open (chatview-side-open class applied)
			expect(document.querySelector('.chatview-side-open')).toBeInTheDocument();
		});

		it('closes doc panel via resetUIState', async () => {
			resetState(buildVisibleTree(1));
			setupDocumentPanel();
			const { component } = render(ChatView);

			component.showDocument('folder-1', 'file-1');
			await tick();

			expect(document.querySelector('.chatview-side-open')).toBeInTheDocument();

			component.resetUIState();
			await tick();

			expect(document.querySelector('.chatview-side-open')).not.toBeInTheDocument();
		});
	});
});
