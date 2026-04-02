// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';

vi.mock('@/view/components/shadcn/ui/sonner/sonner.svelte', async () => ({
	default: (await import('../../../tests/fixtures/PassthroughWrapper.svelte')).default
}));

vi.mock('@/view/shared', async () => ({
	AppSidebar: (await import('../../../tests/fixtures/AppSidebarMock.svelte')).default,
	SearchDialog: (await import('../../../tests/fixtures/SearchDialogMock.svelte')).default,
	Composer: (await import('../../../tests/fixtures/PassthroughWrapper.svelte')).default
}));

vi.mock('@/view/classic', async () => ({
	ChatView: (await import('../../../tests/fixtures/ChatViewMock.svelte')).default,
	DocumentView: (await import('../../../tests/fixtures/PassthroughWrapper.svelte')).default
}));

vi.mock('@/view/routes/LandingPage.svelte', async () => ({
	default: (await import('../../../tests/fixtures/LandingPageMock.svelte')).default
}));

vi.mock('@/view/components/shadcn/ui/sidebar/index.js', async () => ({
	Provider: (await import('../../../tests/fixtures/PassthroughWrapper.svelte')).default,
	Inset: (await import('../../../tests/fixtures/PassthroughWrapper.svelte')).default
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
			clearOpenDocument: vi.fn(),
			initialize: vi.fn(() => ({ restoredDocument: null, chatPanelOpen: undefined, hadDuplicateRenames: false })),
			rememberOpenDocument: vi.fn(),
			save: vi.fn(),
			setChatPanelOpen: vi.fn()
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
			contextStrategy: 'full'
		});
		const folders = app.documents.getState().folders;
		folders.length = 0;
		routerState.route = 'chat';
	});

	it('loads persisted state and initializes providers on mount', () => {
		render(App);

		expect(app.bootstrap.initialize).toHaveBeenCalledOnce();
		expect(screen.getByTestId('chat-view-mock')).toBeInTheDocument();
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
		it('renames duplicate chat names', () => {
			vi.mocked(app.bootstrap.initialize).mockImplementation(() => {
				const chats = app.chat.getChats();
				chats.length = 0;
				chats.push(
					{
						id: '1',
						name: 'Foo',
						rootId: null,
						exchanges: {},
						activeExchangeId: null,
						contextStrategy: 'full'
					},
					{
						id: '2',
						name: 'Foo (2)',
						rootId: null,
						exchanges: {},
						activeExchangeId: null,
						contextStrategy: 'full'
					}
				);
				return { restoredDocument: null, chatPanelOpen: undefined, hadDuplicateRenames: true };
			});
			const warningSpy = vi.spyOn(toast, 'warning');

			render(App);

			expect(app.chat.getChats()[0].name).toBe('Foo');
			expect(app.chat.getChats()[1].name).toBe('Foo (2)');
			expect(warningSpy).toHaveBeenCalled();
			expect(app.bootstrap.save).toHaveBeenCalledOnce();
		});

		it('renames duplicate folder names', () => {
			vi.mocked(app.bootstrap.initialize).mockImplementation(() => {
				const folders = app.documents.getState().folders;
				folders.length = 0;
				folders.push({ id: 'f1', name: 'Docs' }, { id: 'f2', name: 'Docs (2)' });
				return { restoredDocument: null, chatPanelOpen: undefined, hadDuplicateRenames: true };
			});
			const warningSpy = vi.spyOn(toast, 'warning');

			render(App);

			expect(app.documents.getState().folders[0].name).toBe('Docs');
			expect(app.documents.getState().folders[1].name).toBe('Docs (2)');
			expect(warningSpy).toHaveBeenCalled();
			expect(app.bootstrap.save).toHaveBeenCalledOnce();
		});

		it('renames duplicate file names within a folder', () => {
			vi.mocked(app.bootstrap.initialize).mockImplementation(() => {
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
				return { restoredDocument: null, chatPanelOpen: undefined, hadDuplicateRenames: true };
			});
			const warningSpy = vi.spyOn(toast, 'warning');

			render(App);

			expect(app.documents.getState().folders[0].files![0].name).toBe('readme.md');
			expect(app.documents.getState().folders[0].files![1].name).toBe('readme.md (2)');
			expect(warningSpy).toHaveBeenCalled();
			expect(app.bootstrap.save).toHaveBeenCalledOnce();
		});

		it('does not show a toast when no duplicates exist', () => {
			const warningSpy = vi.spyOn(toast, 'warning');

			render(App);

			expect(warningSpy).not.toHaveBeenCalled();
		});
	});
});
