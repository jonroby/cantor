// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';

vi.mock('@/view/primitives/shadcn/ui/sonner/sonner.svelte', async () => ({
	default: (await import('../../../../../tests/fixtures/PassthroughWrapper.svelte')).default
}));

vi.mock('@/view/components/sidebar', async () => ({
	AppSidebar: (await import('../../../../../tests/fixtures/AppSidebarMock.svelte')).default
}));

vi.mock('@/view/components/search', async () => ({
	SearchDialog: (await import('../../../../../tests/fixtures/SearchDialogMock.svelte')).default
}));

vi.mock('@/view/components/composer', async () => ({
	Composer: (await import('../../../../../tests/fixtures/PassthroughWrapper.svelte')).default
}));

vi.mock('@/view/components/chat-view', async () => ({
	ChatView: (await import('../../../../../tests/fixtures/ChatViewMock.svelte')).default
}));

vi.mock('@/view/components/document-view', async () => ({
	DocumentView: (await import('../../../../../tests/fixtures/PassthroughWrapper.svelte')).default
}));

vi.mock('@/view/components/folder-document-view', async () => ({
	FolderDocumentView: (await import('../../../../../tests/fixtures/PassthroughWrapper.svelte'))
		.default
}));

vi.mock('@/view/components/landing', async () => ({
	LandingPage: (await import('../../../../../tests/fixtures/LandingPageMock.svelte')).default
}));

vi.mock('@/view/primitives/shadcn/ui/sidebar/index.js', async () => ({
	Provider: (await import('../../../../../tests/fixtures/PassthroughWrapper.svelte')).default,
	Inset: (await import('../../../../../tests/fixtures/PassthroughWrapper.svelte')).default
}));

vi.mock('@/app', async () => {
	const { createAppMock } = await import('@/tests/mocks/app');
	const chatState = {
		chats: [] as {
			id: string;
			name: string;
			rootId: string | null;
			exchanges: Record<string, unknown>;
			activeExchangeId: string | null;
		}[],
		activeChatIndex: 0
	};
	const documentState = { folders: [], openDocuments: [] };
	return createAppMock({
		bootstrap: {
			deleteTrashItem: vi.fn(async () => {}),
			emptyTrash: vi.fn(async () => {}),
			initialize: vi.fn(async () => ({
				restoredDocument: null,
				hadDuplicateRenames: false
			})),
			loadTrash: vi.fn(async () => []),
			restoreChat: vi.fn(async () => false),
			restoreDocument: vi.fn(async () => false),
			restoreFolder: vi.fn(async () => false),
			save: vi.fn(async () => {})
		},
		chat: {
			createChat: vi.fn(),
			exportChat: vi.fn(),
			getChats: vi.fn(() => chatState.chats),
			getActiveChatIndex: vi.fn(() => chatState.activeChatIndex),
			importChat: vi.fn(),
			removeChat: vi.fn(),
			selectExchange: vi.fn(),
			stopChatStreams: vi.fn()
		},
		documents: {
			addDocumentToChat: vi.fn(),
			closeDocument: vi.fn(),
			createDocument: vi.fn(() => null),
			createFolder: vi.fn(),
			deleteDocument: vi.fn(),
			exportFolder: vi.fn(),
			getDocument: vi.fn(),
			getState: vi.fn(() => documentState),
			importDocument: vi.fn(),
			importFolder: vi.fn(),
			importFolderIntoFolder: vi.fn(),
			moveDocument: vi.fn(),
			openDocument: vi.fn(() => false),
			renameDocument: vi.fn(),
			updateDocumentContent: vi.fn()
		},
		workspace: {
			clearOpenDocument: vi.fn(),
			getState: vi.fn(() => ({
				panels: [{ type: 'chat' as const }],
				expandedFolders: {},
				sidebarOpen: true
			})),
			rememberOpenDocument: vi.fn(),
			setExpandedFolders: vi.fn(),
			setPanels: vi.fn(),
			setSidebarOpen: vi.fn()
		}
	});
});

vi.mock('@/view/routes/router.svelte', () => ({
	routerState: { route: 'chat' as 'chat' | 'landing' }
}));

import { toast } from 'svelte-sonner';
import App from '../App.svelte';
import * as app from '@/app';
import { routerState } from '@/view/routes/router.svelte';

describe('App', () => {
	beforeEach(() => {
		vi.resetAllMocks();
		vi.restoreAllMocks();
		const chats = app.chat.getChats();
		chats.length = 0;
		chats.push({
			id: 'chat-1',
			name: 'Chat 1',
			rootId: null,
			exchanges: {},
			activeExchangeId: null,
			contextStrategy: 'full',
			mode: 'chat'
		});
		const folders = app.documents.getState().folders;
		folders.length = 0;
		routerState.route = 'chat';
	});

	it('loads persisted state and initializes providers on mount', async () => {
		render(App);

		expect(app.bootstrap.initialize).toHaveBeenCalledOnce();
		await waitFor(() => {
			expect(screen.getByTestId('chat-view-mock')).toBeInTheDocument();
		});
	});

	it('opens search dialog from the keyboard shortcut', async () => {
		render(App);

		await fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

		expect(screen.getByTestId('search-dialog-mock')).toBeInTheDocument();
	});

	it('renders the landing page when the router is on landing', () => {
		routerState.route = 'landing';

		render(App);

		expect(screen.getByTestId('landing-page-mock')).toBeInTheDocument();
	});

	describe('gracefully renames duplicates on load', () => {
		it('renames duplicate chat names', async () => {
			vi.mocked(app.bootstrap.initialize).mockImplementation(async () => {
				const chats = app.chat.getChats();
				chats.length = 0;
				chats.push(
					{
						id: '1',
						name: 'Foo',
						rootId: null,
						exchanges: {},
						activeExchangeId: null,
						contextStrategy: 'full',
						mode: 'chat'
					},
					{
						id: '2',
						name: 'Foo (2)',
						rootId: null,
						exchanges: {},
						activeExchangeId: null,
						contextStrategy: 'full',
						mode: 'chat'
					}
				);
				return {
					restoredDocument: null,
					hadDuplicateRenames: true
				};
			});
			const warningSpy = vi.spyOn(toast, 'warning');

			render(App);

			await waitFor(() => {
				expect(warningSpy).toHaveBeenCalled();
			});
			expect(app.chat.getChats()[0].name).toBe('Foo');
			expect(app.chat.getChats()[1].name).toBe('Foo (2)');
			expect(app.bootstrap.save).toHaveBeenCalledOnce();
		});

		it('renames duplicate folder names', async () => {
			vi.mocked(app.bootstrap.initialize).mockImplementation(async () => {
				const folders = app.documents.getState().folders;
				folders.length = 0;
				folders.push({ id: 'f1', name: 'Docs' }, { id: 'f2', name: 'Docs (2)' });
				return {
					restoredDocument: null,
					hadDuplicateRenames: true
				};
			});
			const warningSpy = vi.spyOn(toast, 'warning');

			render(App);

			await waitFor(() => {
				expect(warningSpy).toHaveBeenCalled();
			});
			expect(app.documents.getState().folders[0].name).toBe('Docs');
			expect(app.documents.getState().folders[1].name).toBe('Docs (2)');
			expect(app.bootstrap.save).toHaveBeenCalledOnce();
		});

		it('renames duplicate file names within a folder', async () => {
			vi.mocked(app.bootstrap.initialize).mockImplementation(async () => {
				const folders = app.documents.getState().folders;
				folders.length = 0;
				folders.push({
					id: 'f1',
					name: 'Docs',
					files: [
						{ id: 'd1', name: 'readme.md', content: '' },
						{ id: 'd2', name: 'readme.md (2)', content: '' }
					]
				});
				return {
					restoredDocument: null,
					hadDuplicateRenames: true
				};
			});
			const warningSpy = vi.spyOn(toast, 'warning');

			render(App);

			await waitFor(() => {
				expect(warningSpy).toHaveBeenCalled();
			});
			expect(app.documents.getState().folders[0].files![0].name).toBe('readme.md');
			expect(app.documents.getState().folders[0].files![1].name).toBe('readme.md (2)');
			expect(app.bootstrap.save).toHaveBeenCalledOnce();
		});

		it('does not show a toast when no duplicates exist', () => {
			const warningSpy = vi.spyOn(toast, 'warning');

			render(App);

			expect(warningSpy).not.toHaveBeenCalled();
		});
	});
});
