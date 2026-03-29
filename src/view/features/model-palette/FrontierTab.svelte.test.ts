// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import FrontierTab from './FrontierTab.svelte';
import type { ActiveModel } from '@/domain';

vi.mock('@/domain', async (importOriginal) => ({
	...(await importOriginal<typeof import('@/domain')>()),
	PROVIDER_LOGOS: {}
}));

function renderTab(overrides: Partial<Parameters<typeof FrontierTab>[1]> = {}) {
	const props = {
		activeModel: null as ActiveModel | null,
		apiKeys: {} as Record<string, string>,
		vaultProviders: [] as string[],
		onSelectProvider: vi.fn(),
		onForgetKey: vi.fn(),
		...overrides
	};
	return { ...render(FrontierTab, { props }), props };
}

describe('FrontierTab', () => {
	describe('Claude models', () => {
		it('renders all Claude model labels', () => {
			renderTab();
			expect(screen.getByText('Claude Opus 4.6')).toBeInTheDocument();
			expect(screen.getByText('Claude Sonnet 4.6')).toBeInTheDocument();
			expect(screen.getByText('Claude Haiku 4.5')).toBeInTheDocument();
		});

		it('clicking a Claude model calls onSelectProvider', async () => {
			const { props } = renderTab();
			await userEvent.click(screen.getByText('Claude Sonnet 4.6'));
			expect(props.onSelectProvider).toHaveBeenCalledWith('claude', 'claude-sonnet-4-6');
		});

		it('highlights the active Claude model', () => {
			renderTab({
				activeModel: { provider: 'claude', modelId: 'claude-opus-4-6' }
			});
			const btn = screen.getByText('Claude Opus 4.6').closest('button');
			expect(btn?.classList.contains('active')).toBe(true);
		});
	});

	describe('badges', () => {
		it('shows "add key" badge when no vault and no key', () => {
			renderTab({ apiKeys: {}, vaultProviders: [] });
			const badges = screen.getAllByText('add key');
			expect(badges.length).toBeGreaterThan(0);
		});

		it('shows "locked" badge when vault exists but key not decrypted', () => {
			renderTab({ apiKeys: {}, vaultProviders: ['claude'] });
			const badges = screen.getAllByText('locked');
			expect(badges.length).toBeGreaterThan(0);
		});

		it('shows no badge when key is already decrypted', () => {
			renderTab({ apiKeys: { claude: 'sk-ant-xxx' }, vaultProviders: ['claude'] });
			// Claude models should not have "add key" or "locked" badges
			const claudeSection = screen.getByText('Claude').closest('.palette-provider-group');
			expect(claudeSection?.querySelector('.palette-badge')).toBeNull();
		});
	});

	describe('forget key', () => {
		it('shows "Forget saved key" when Claude key is decrypted', () => {
			renderTab({ apiKeys: { claude: 'sk-ant-xxx' } });
			expect(screen.getByText('Forget saved key')).toBeInTheDocument();
		});

		it('does not show "Forget saved key" when no Claude key', () => {
			renderTab({ apiKeys: {} });
			expect(screen.queryByText('Forget saved key')).not.toBeInTheDocument();
		});

		it('clicking "Forget saved key" calls onForgetKey with claude', async () => {
			const { props } = renderTab({ apiKeys: { claude: 'sk-ant-xxx' } });
			await userEvent.click(screen.getByText('Forget saved key'));
			expect(props.onForgetKey).toHaveBeenCalledWith('claude');
		});
	});

	describe('non-Claude providers', () => {
		it('shows "soon" badge for non-Claude providers', () => {
			renderTab();
			const badges = screen.getAllByText('soon');
			// All non-Claude key-based providers should show "soon"
			expect(badges.length).toBe(7);
		});

		it('non-Claude model buttons are disabled', () => {
			renderTab();
			// GPT-4o is an OpenAI model and should be disabled
			const gpt4o = screen.getByText('GPT-4o').closest('button');
			expect(gpt4o).toBeDisabled();
		});
	});
});
