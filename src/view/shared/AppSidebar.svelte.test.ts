// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import AppSidebarHarness from '../../../tests/fixtures/AppSidebarHarness.svelte';

vi.mock('svelte-sonner', () => ({
	toast: {
		error: vi.fn(),
		success: vi.fn()
	}
}));

function renderSidebar() {
	const props = {
		chats: [{ id: 'chat-1', name: 'Chat 1', rootId: null, exchanges: {}, activeExchangeId: null }],
		activeChatIndex: 0,
		onSelectChat: vi.fn(),
		onNewChat: vi.fn(() => 0),
		onDeleteChat: vi.fn(),
		onRenameChat: vi.fn(),
		onDownloadChat: vi.fn(),
		onUploadChat: vi.fn(),
		folders: [],
		onNewFolder: vi.fn(() => 'folder-1'),
		onDeleteFolder: vi.fn(),
		onDownloadFolder: vi.fn(),
		onRenameFolder: vi.fn(() => true),
		onUploadDoc: vi.fn(),
		onUploadFolder: vi.fn(),
		onUploadNewFolder: vi.fn(),
		onSelectDoc: vi.fn(),
		onDeleteDoc: vi.fn(),
		onRenameDoc: vi.fn(() => true),
		onMoveDoc: vi.fn(() => true)
	};
	return { ...render(AppSidebarHarness, { props }), props };
}

describe('AppSidebar', () => {
	beforeEach(() => {
		document.documentElement.className = 'dark';
		const storage = new Map<string, string>();
		vi.stubGlobal('localStorage', {
			getItem: vi.fn((key: string) => storage.get(key) ?? null),
			setItem: vi.fn((key: string, value: string) => {
				storage.set(key, value);
			}),
			removeItem: vi.fn((key: string) => {
				storage.delete(key);
			})
		});
		vi.stubGlobal(
			'matchMedia',
			vi.fn().mockImplementation(() => ({
				matches: false,
				media: '',
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				addListener: vi.fn(),
				removeListener: vi.fn(),
				dispatchEvent: vi.fn()
			}))
		);
		vi.stubGlobal(
			'ResizeObserver',
			class {
				observe() {}
				unobserve() {}
				disconnect() {}
			}
		);
	});

	it('creates a new chat when the button is clicked', async () => {
		const { props } = renderSidebar();

		await userEvent.click(screen.getByText('New chat'));

		expect(props.onNewChat).toHaveBeenCalledOnce();
	});

	it('creates a new folder when the button is clicked', async () => {
		const { props } = renderSidebar();

		await userEvent.click(screen.getByText('New folder'));

		expect(props.onNewFolder).toHaveBeenCalledOnce();
	});

	it('toggles the theme and persists the choice', async () => {
		renderSidebar();

		await userEvent.click(screen.getByLabelText('Switch to light mode'));

		expect(document.documentElement.classList.contains('dark')).toBe(false);
		expect(localStorage.getItem('theme')).toBe('light');
		expect(screen.getByLabelText('Switch to dark mode')).toBeInTheDocument();
	});
});
