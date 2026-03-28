// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import SearchDialog from './SearchDialog.svelte';
import type { SearchResult } from '@/domain/search';

const ITEMS: SearchResult[] = [
	{
		exchangeId: 'exchange-1',
		chatIndex: 0,
		prompt: 'Find this exchange',
		snippets: [{ text: 'matching snippet', matchStart: 0, matchEnd: 8 }]
	}
];

describe('SearchDialog', () => {
	it('shows an empty message when there are no results', () => {
		render(SearchDialog, {
			props: {
				searchQuery: 'missing',
				searchAllChats: true,
				searchItems: [],
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
				searchItems: ITEMS,
				onClose,
				onSelect
			}
		});

		await userEvent.click(screen.getByText('Find this exchange'));

		expect(onSelect).toHaveBeenCalledWith(ITEMS[0]);
		expect(onClose).toHaveBeenCalledOnce();
	});
});
