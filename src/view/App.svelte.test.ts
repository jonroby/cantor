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

vi.mock('@/state/services/database.svelte', () => ({
	loadFromStorage: vi.fn(),
	saveToStorage: vi.fn()
}));

vi.mock('@/app/providers', () => ({
	init: vi.fn(),
	autoConnectOllama: vi.fn()
}));

vi.mock('@/state/services/io.svelte', () => ({
	downloadChat: vi.fn(),
	uploadChat: vi.fn(),
	downloadFolder: vi.fn(),
	uploadDocToFolder: vi.fn(),
	uploadFolder: vi.fn(),
	uploadFolderToFolder: vi.fn()
}));

vi.mock('@/view/routes/router.svelte', () => ({
	routerState: { route: 'chat' as 'chat' | 'canvas' | 'landing' }
}));

import App from './App.svelte';
import { chatState } from '@/state/chats.svelte';
import { loadFromStorage } from '@/state/services/database.svelte';
import { autoConnectOllama, init } from '@/app/providers';
import { routerState } from '@/view/routes/router.svelte';

describe('App', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		chatState.chats = [
			{
				id: 'chat-1',
				name: 'Chat 1',
				rootId: null,
				exchanges: {},
				activeExchangeId: null
			}
		];
		chatState.activeChatIndex = 0;
		routerState.route = 'chat';
	});

	it('loads persisted state and initializes providers on mount', () => {
		render(App);

		expect(loadFromStorage).toHaveBeenCalledOnce();
		expect(init).toHaveBeenCalledOnce();
		expect(autoConnectOllama).toHaveBeenCalledOnce();
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
});
