// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import SearchDialog from '../SearchDialog.svelte';
import type * as app from '@/app';

const CHATS: app.chat.Chat[] = [
	{
		id: 'chat-1',
		name: 'Chat 1',
		rootId: 'exchange-1',
		activeExchangeId: 'exchange-1',
		exchanges: {
			'exchange-1': {
				id: 'exchange-1',
				parentId: '',
				childIds: [],
				createdAt: 0,
				model: 'claude-sonnet-4-6',
				provider: 'claude',
				label: undefined,
				prompt: { text: 'Find this exchange', tokenCount: 0 },
				response: { text: 'matching snippet here', tokenCount: 0 }
			}
		}
	}
];

describe('SearchDialog', () => {
	it('shows an empty message when there are no results', () => {
		render(SearchDialog, {
			props: {
				searchQuery: 'missing',
				searchAllChats: true,
				chats: [],
				activeChatIndex: 0,
				onClose: vi.fn(),
				onSelect: vi.fn()
			}
		});

		expect(screen.getByText('No results found.')).toBeInTheDocument();
	});

	it('selects a result and closes the dialog', async () => {
		const onSelect = vi.fn();
		const onClose = vi.fn();

		render(SearchDialog, {
			props: {
				searchQuery: 'find',
				searchAllChats: true,
				chats: CHATS,
				activeChatIndex: 0,
				onClose,
				onSelect
			}
		});

		await userEvent.click(screen.getByRole('button', { name: /find this exchange/i }));

		expect(onSelect).toHaveBeenCalledWith({
			exchangeId: 'exchange-1',
			chatIndex: 0,
			prompt: 'Find this exchange',
			snippets: [{ text: 'Find this exchange', matchStart: 0, matchEnd: 4 }]
		});
		expect(onClose).toHaveBeenCalledOnce();
	});
});
