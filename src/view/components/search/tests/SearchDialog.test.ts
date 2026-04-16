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
		},
		contextStrategy: 'full',
		mode: 'chat'
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

		expect(onSelect).toHaveBeenCalledWith(
			expect.objectContaining({
				exchangeId: 'exchange-1',
				chatIndex: 0,
				prompt: 'Find this exchange'
			})
		);
		expect(onClose).toHaveBeenCalledOnce();
	});

	it('highlights a fuzzy match in the response with a visible snippet', async () => {
		const chats: app.chat.Chat[] = [
			{
				id: 'chat-euc',
				name: 'Manifold Learning',
				rootId: 'exchange-euc',
				activeExchangeId: 'exchange-euc',
				exchanges: {
					'exchange-euc': {
						id: 'exchange-euc',
						parentId: '',
						childIds: [],
						createdAt: 0,
						model: 'claude-sonnet-4-6',
						provider: 'claude',
						label: undefined,
						prompt: { text: 'Please give an illustrative example.', tokenCount: 0 },
						response: {
							text: 'Manifolds are locally euclidean spaces — think of a sphere.',
							tokenCount: 0
						}
					}
				},
				contextStrategy: 'full',
				mode: 'chat'
			}
		];

		render(SearchDialog, {
			props: {
				searchQuery: 'euclidean',
				searchAllChats: true,
				chats,
				activeChatIndex: 0,
				onClose: vi.fn(),
				onSelect: vi.fn()
			}
		});

		// The match is in the response, so the snippet should show the response prefix
		// and highlight "euclidean" (or close to it) via <mark>.
		const button = screen.getByRole('button', { name: /illustrative example/i });
		const marks = button.querySelectorAll('mark');
		expect(marks.length).toBeGreaterThan(0);
		const highlightedText = Array.from(marks)
			.map((mark) => mark.textContent)
			.join('');
		expect(highlightedText.toLowerCase()).toContain('euclidean');
	});

	it('does not surface noise matches for a typo on unrelated text', () => {
		const chats: app.chat.Chat[] = [
			{
				id: 'chat-noise',
				name: 'Other',
				rootId: 'ex-noise',
				activeExchangeId: 'ex-noise',
				exchanges: {
					'ex-noise': {
						id: 'ex-noise',
						parentId: '',
						childIds: [],
						createdAt: 0,
						model: 'claude-sonnet-4-6',
						provider: 'claude',
						label: undefined,
						prompt: { text: 'Please give an illustrative example.', tokenCount: 0 },
						response: { text: 'Certainly, here is one.', tokenCount: 0 }
					}
				},
				contextStrategy: 'full',
				mode: 'chat'
			}
		];

		render(SearchDialog, {
			props: {
				searchQuery: 'eucdean',
				searchAllChats: true,
				chats,
				activeChatIndex: 0,
				onClose: vi.fn(),
				onSelect: vi.fn()
			}
		});

		expect(screen.getByText('No results found.')).toBeInTheDocument();
	});
});
