// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';

vi.mock('@/view/components/shadcn/ui/sonner/sonner.svelte', async () => ({
	default: (await import('../../tests/fixtures/PassthroughWrapper.svelte')).default
}));

vi.mock('@/view/shared', async () => ({
	AppSidebar: (await import('../../tests/fixtures/AppSidebarMock.svelte')).default,
	SearchDialog: (await import('../../tests/fixtures/SearchDialogMock.svelte')).default
}));

vi.mock('@/view/classic', async () => ({
	ChatView: (await import('../../tests/fixtures/ChatViewMock.svelte')).default
}));

vi.mock('@/view/canvas', async () => ({
	CanvasView: (await import('../../tests/fixtures/CanvasViewMock.svelte')).default
}));

vi.mock('@/view/routes/LandingPage.svelte', async () => ({
	default: (await import('../../tests/fixtures/LandingPageMock.svelte')).default
}));

vi.mock('@/view/components/shadcn/ui/sidebar/index.js', async () => ({
	Provider: (await import('../../tests/fixtures/PassthroughWrapper.svelte')).default,
	Inset: (await import('../../tests/fixtures/PassthroughWrapper.svelte')).default
}));

vi.mock('@/app', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@/app')>();
	return {
		...actual,
		runtime: {
			...actual.runtime,
			loadFromStorage: vi.fn(),
			saveToStorage: vi.fn(),
			cancelStreamsForChat: vi.fn()
		},
		providers: {
			...actual.providers,
			init: vi.fn(),
			autoConnectOllama: vi.fn()
		},
		files: {
			...actual.files,
			downloadChat: vi.fn(),
			uploadChat: vi.fn(),
			downloadFolder: vi.fn(),
			uploadDocToFolder: vi.fn(),
			uploadFolder: vi.fn(),
			uploadFolderToFolder: vi.fn()
		},
		documents: {
			...actual.documents,
			performAddFolderDocumentToChat: vi.fn(),
			performCreateDocument: vi.fn(() => null),
			performOpenDocument: vi.fn(() => false),
			restoreOpenDocument: vi.fn(() => null)
		}
	};
});

vi.mock('@/view/routes/router.svelte', () => ({
	routerState: { route: 'chat' as 'chat' | 'canvas' | 'landing' }
}));

import { toast } from 'svelte-sonner';
import App from './App.svelte';
import * as app from '@/app';
import { routerState } from '@/view/routes/router.svelte';

describe('App', () => {
	beforeEach(() => {
		vi.resetAllMocks();
		vi.restoreAllMocks();
		app.runtime.chatState.chats = [
			{
				id: 'chat-1',
				name: 'Chat 1',
				rootId: null,
				exchanges: {},
				activeExchangeId: null
			}
		];
		app.runtime.chatState.activeChatIndex = 0;
		app.runtime.docState.folders = [];
		routerState.route = 'chat';
	});

	it('loads persisted state and initializes providers on mount', () => {
		render(App);

		expect(app.runtime.loadFromStorage).toHaveBeenCalledOnce();
		expect(app.providers.init).toHaveBeenCalledOnce();
		expect(app.providers.autoConnectOllama).toHaveBeenCalledOnce();
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
			vi.mocked(app.runtime.loadFromStorage).mockImplementation(() => {
				app.runtime.chatState.chats = [
					{ id: '1', name: 'Foo', rootId: null, exchanges: {}, activeExchangeId: null },
					{ id: '2', name: 'Foo', rootId: null, exchanges: {}, activeExchangeId: null }
				];
				throw new Error('Duplicate chat name "Foo"');
			});
			const warningSpy = vi.spyOn(toast, 'warning');

			render(App);

			expect(app.runtime.chatState.chats[0].name).toBe('Foo');
			expect(app.runtime.chatState.chats[1].name).toBe('Foo (2)');
			expect(warningSpy).toHaveBeenCalled();
			expect(app.runtime.saveToStorage).toHaveBeenCalledOnce();
		});

		it('renames duplicate folder names', () => {
			vi.mocked(app.runtime.loadFromStorage).mockImplementation(() => {
				app.runtime.docState.folders = [
					{ id: 'f1', name: 'Docs' },
					{ id: 'f2', name: 'Docs' }
				];
				throw new Error('Duplicate folder name "Docs"');
			});
			const warningSpy = vi.spyOn(toast, 'warning');

			render(App);

			expect(app.runtime.docState.folders[0].name).toBe('Docs');
			expect(app.runtime.docState.folders[1].name).toBe('Docs (2)');
			expect(warningSpy).toHaveBeenCalled();
			expect(app.runtime.saveToStorage).toHaveBeenCalledOnce();
		});

		it('renames duplicate file names within a folder', () => {
			vi.mocked(app.runtime.loadFromStorage).mockImplementation(() => {
				app.runtime.docState.folders = [
					{
						id: 'f1',
						name: 'Docs',
						files: [
							{ id: 'd1', name: 'readme.md', content: '' },
							{ id: 'd2', name: 'readme.md', content: '' }
						]
					}
				];
				throw new Error('Duplicate file name "readme.md"');
			});
			const warningSpy = vi.spyOn(toast, 'warning');

			render(App);

			expect(app.runtime.docState.folders[0].files![0].name).toBe('readme.md');
			expect(app.runtime.docState.folders[0].files![1].name).toBe('readme.md (2)');
			expect(warningSpy).toHaveBeenCalled();
			expect(app.runtime.saveToStorage).toHaveBeenCalledOnce();
		});

		it('does not show a toast when no duplicates exist', () => {
			const warningSpy = vi.spyOn(toast, 'warning');

			render(App);

			expect(warningSpy).not.toHaveBeenCalled();
		});
	});
});
