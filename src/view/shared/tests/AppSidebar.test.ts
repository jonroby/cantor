// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import AppSidebarHarness from '../../../../tests/fixtures/AppSidebarHarness.svelte';
import AppSidebarStateHarness from '../../../../tests/fixtures/AppSidebarStateHarness.svelte';
import { toast } from 'svelte-sonner';
import * as state from '@/state';

vi.mock('svelte-sonner', () => ({
	toast: {
		error: vi.fn(),
		success: vi.fn(),
		warning: vi.fn()
	}
}));

function renderSidebar() {
	const props = {
		chats: [
			{
				id: 'chat-1',
				name: 'Chat 1',
				rootId: null,
				exchanges: {},
				activeExchangeId: null,
				contextStrategy: 'full'
			}
		],
		activeChatIndex: 0,
		onSelectChat: vi.fn(),
		onNewChat: vi.fn(() => 0),
		onDeleteChat: vi.fn(),
		onRenameChat: vi.fn(() => 'Chat 1'),
		onDownloadChat: vi.fn(),
		onUploadChat: vi.fn(),
		folders: [],
		onNewFolder: vi.fn(() => 'folder-1'),
		onDeleteFolder: vi.fn(),
		onDownloadFolder: vi.fn(),
		onRenameFolder: vi.fn(() => 'Folder 1'),
		onUploadDocument: vi.fn(),
		onUploadFolder: vi.fn(),
		onUploadNewFolder: vi.fn(),
		onSelectDocument: vi.fn(),
		onDeleteDocument: vi.fn(),
		onRenameDocument: vi.fn(() => 'Document 1.md'),
		onMoveDocument: vi.fn(() => true)
	};
	return { ...render(AppSidebarHarness, { props }), props };
}

function getRowActionsButton(label: string): HTMLButtonElement {
	const row = screen.getByText(label).closest('li');
	if (!row) throw new Error(`Row not found for ${label}`);
	const buttons = row.querySelectorAll('button');
	const button = buttons[buttons.length - 1];
	if (!(button instanceof HTMLButtonElement))
		throw new Error(`Actions button not found for ${label}`);
	return button;
}

describe('AppSidebar', () => {
	beforeEach(() => {
		document.documentElement.className = 'dark';
		state.chats.chatState.chats = [
			{
				id: 'chat-1',
				name: 'Chat 1',
				rootId: null,
				exchanges: {},
				activeExchangeId: null,
				contextStrategy: 'full'
			}
		];
		state.chats.chatState.activeChatIndex = 0;
		state.documents.documentState.folders = [];
		state.documents.documentState.openDocuments = [];
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

	it('creates chats with unique names through the sidebar', async () => {
		const user = userEvent.setup();
		render(AppSidebarStateHarness);

		await user.click(screen.getByText('New chat'));
		await user.click(screen.getByText('New chat'));

		expect(screen.getByText('Chat 1')).toBeInTheDocument();
		expect(screen.getByText('Chat (1)')).toBeInTheDocument();
		expect(screen.getByText('Chat (2)')).toBeInTheDocument();
	});

	it('creates a new folder when the button is clicked', async () => {
		const { props } = renderSidebar();

		await userEvent.click(screen.getByText('New folder'));

		expect(props.onNewFolder).toHaveBeenCalledOnce();
	});

	it('creates folders with unique names through the sidebar', async () => {
		const user = userEvent.setup();
		render(AppSidebarStateHarness);

		await user.click(screen.getByText('New folder'));
		await user.click(screen.getByText('New folder'));

		expect(
			state.documents.documentState.folders.map((folder: { name: string }) => folder.name)
		).toEqual(['New Folder', 'New Folder 2']);
		expect(
			new Set(state.documents.documentState.folders.map((folder: { name: string }) => folder.name))
				.size
		).toBe(state.documents.documentState.folders.length);
	});

	it('toggles the theme and persists the choice', async () => {
		renderSidebar();

		await userEvent.click(screen.getByLabelText('Switch to light mode'));

		expect(document.documentElement.classList.contains('dark')).toBe(false);
		expect(localStorage.getItem('theme')).toBe('light');
		expect(screen.getByLabelText('Switch to dark mode')).toBeInTheDocument();
	});

	it('shows the adjusted folder name returned by the app rename flow', async () => {
		const user = userEvent.setup();
		const props = {
			chats: [
				{
					id: 'chat-1',
					name: 'Chat 1',
					rootId: null,
					exchanges: {},
					activeExchangeId: null,
					contextStrategy: 'full'
				}
			],
			activeChatIndex: 0,
			onSelectChat: vi.fn(),
			onNewChat: vi.fn(() => 0),
			onDeleteChat: vi.fn(),
			onRenameChat: vi.fn(() => 'Chat 1'),
			onDownloadChat: vi.fn(),
			onUploadChat: vi.fn(),
			folders: [
				{ id: 'folder-1', name: 'Docs', files: [] },
				{ id: 'folder-2', name: 'Notes', files: [] }
			],
			onNewFolder: vi.fn(() => 'folder-3'),
			onDeleteFolder: vi.fn(),
			onDownloadFolder: vi.fn(),
			onRenameFolder: vi.fn(() => 'Docs (1)'),
			onUploadDocument: vi.fn(),
			onUploadFolder: vi.fn(),
			onUploadNewFolder: vi.fn(),
			onSelectDocument: vi.fn(),
			onDeleteDocument: vi.fn(),
			onRenameDocument: vi.fn(() => 'Document 1.md'),
			onMoveDocument: vi.fn(() => true)
		};
		render(AppSidebarHarness, { props });

		await user.dblClick(screen.getByText('Notes'));
		const input = screen.getByDisplayValue('Notes');
		await user.clear(input);
		await user.type(input, 'Docs');
		await user.tab();

		expect(props.onRenameFolder).toHaveBeenCalledOnce();
		expect(props.onRenameFolder).toHaveBeenCalledWith('folder-2', 'Docs');
		expect(toast.warning).toHaveBeenCalledWith('Renamed to "Docs (1)" to avoid duplicate');
	});

	it('shows the adjusted chat name returned by the app rename flow', async () => {
		const user = userEvent.setup();
		const props = {
			chats: [
				{ id: 'chat-1', name: 'Alpha', rootId: null, exchanges: {}, activeExchangeId: null },
				{ id: 'chat-2', name: 'Beta', rootId: null, exchanges: {}, activeExchangeId: null }
			],
			activeChatIndex: 0,
			onSelectChat: vi.fn(),
			onNewChat: vi.fn(() => 0),
			onDeleteChat: vi.fn(),
			onRenameChat: vi.fn(() => 'Alpha (1)'),
			onDownloadChat: vi.fn(),
			onUploadChat: vi.fn(),
			folders: [],
			onNewFolder: vi.fn(() => 'folder-1'),
			onDeleteFolder: vi.fn(),
			onDownloadFolder: vi.fn(),
			onRenameFolder: vi.fn(() => 'Folder 1'),
			onUploadDocument: vi.fn(),
			onUploadFolder: vi.fn(),
			onUploadNewFolder: vi.fn(),
			onSelectDocument: vi.fn(),
			onDeleteDocument: vi.fn(),
			onRenameDocument: vi.fn(() => 'Document 1.md'),
			onMoveDocument: vi.fn(() => true)
		};
		render(AppSidebarHarness, { props });

		await user.click(getRowActionsButton('Beta'));
		await user.click(screen.getByText('Rename'));
		const input = screen.getByDisplayValue('Beta');
		await fireEvent.input(input, { target: { value: 'Alpha' } });
		await fireEvent.blur(input);

		expect(props.onRenameChat).toHaveBeenCalledOnce();
		expect(props.onRenameChat).toHaveBeenCalledWith(1, 'Alpha');
		expect(toast.warning).toHaveBeenCalledWith('Renamed to "Alpha (1)" to avoid duplicate');
	});

	it('shows the adjusted document name returned by the app rename flow', async () => {
		const user = userEvent.setup();
		const props = {
			chats: [
				{
					id: 'chat-1',
					name: 'Chat 1',
					rootId: null,
					exchanges: {},
					activeExchangeId: null,
					contextStrategy: 'full'
				}
			],
			activeChatIndex: 0,
			onSelectChat: vi.fn(),
			onNewChat: vi.fn(() => 0),
			onDeleteChat: vi.fn(),
			onRenameChat: vi.fn(() => 'Chat 1'),
			onDownloadChat: vi.fn(),
			onUploadChat: vi.fn(),
			folders: [
				{
					id: 'folder-1',
					name: 'Docs',
					files: [
						{ id: 'doc-1', name: 'a.md', content: '' },
						{ id: 'doc-2', name: 'b.md', content: '' }
					]
				}
			],
			onNewFolder: vi.fn(() => 'folder-2'),
			onDeleteFolder: vi.fn(),
			onDownloadFolder: vi.fn(),
			onRenameFolder: vi.fn(() => 'Folder 1'),
			onUploadDocument: vi.fn(),
			onUploadFolder: vi.fn(),
			onUploadNewFolder: vi.fn(),
			onSelectDocument: vi.fn(),
			onDeleteDocument: vi.fn(),
			onRenameDocument: vi.fn(() => 'a.md (1)'),
			onMoveDocument: vi.fn(() => true)
		};
		render(AppSidebarHarness, { props });

		await user.click(screen.getByText('Docs'));
		await user.click(getRowActionsButton('b.md'));
		await user.click(screen.getByText('Rename'));
		const input = screen.getByDisplayValue('b.md');
		await fireEvent.input(input, { target: { value: 'a.md' } });
		await fireEvent.blur(input);

		expect(props.onRenameDocument).toHaveBeenCalledOnce();
		expect(props.onRenameDocument).toHaveBeenCalledWith('folder-1', 'doc-2', 'a.md');
		expect(toast.warning).toHaveBeenCalledWith('Renamed to "a.md (1)" to avoid duplicate');
	});
});
