// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import OllamaTab from './OllamaTab.svelte';
import type * as domain from '@/domain';

function renderTab(overrides: Partial<Parameters<typeof OllamaTab>[1]> = {}) {
	const props = {
		activeModel: null as domain.models.ActiveModel | null,
		ollamaUrl: 'http://localhost:11434',
		ollamaStatus: 'disconnected' as domain.models.OllamaStatus,
		ollamaModels: [] as string[],
		onConnectOllama: vi.fn(),
		onSelectModel: vi.fn(),
		...overrides
	};
	return { ...render(OllamaTab, { props }), props };
}

describe('OllamaTab', () => {
	describe('connection', () => {
		it('shows Connect button when disconnected', () => {
			renderTab();
			expect(screen.getByText('Connect')).toBeInTheDocument();
		});

		it('shows Reconnect button when already connected', () => {
			renderTab({ ollamaStatus: 'connected' });
			expect(screen.getByText('Reconnect')).toBeInTheDocument();
		});

		it('shows Connecting... and disables button while connecting', () => {
			renderTab({ ollamaStatus: 'connecting' });
			const btn = screen.getByText('Connecting...');
			expect(btn).toBeInTheDocument();
			expect(btn.closest('button')).toBeDisabled();
		});

		it('shows Failed when status is error', () => {
			renderTab({ ollamaStatus: 'error' });
			expect(screen.getByText('Failed')).toBeInTheDocument();
		});

		it('calls onConnectOllama with url when Connect is clicked', async () => {
			const { props } = renderTab({ ollamaUrl: 'http://my-server:11434' });
			await userEvent.click(screen.getByText('Connect'));
			expect(props.onConnectOllama).toHaveBeenCalledWith('http://my-server:11434');
		});
	});

	describe('model list', () => {
		it('shows "No models found." when connected with no models', () => {
			renderTab({ ollamaStatus: 'connected', ollamaModels: [] });
			expect(screen.getByText('No models found.')).toBeInTheDocument();
		});

		it('lists available models when connected', () => {
			renderTab({
				ollamaStatus: 'connected',
				ollamaModels: ['llama3.2:3b', 'codellama:7b']
			});
			expect(screen.getByText('llama3.2:3b')).toBeInTheDocument();
			expect(screen.getByText('codellama:7b')).toBeInTheDocument();
		});

		it('does not show models when disconnected', () => {
			renderTab({
				ollamaStatus: 'disconnected',
				ollamaModels: ['llama3.2:3b']
			});
			expect(screen.queryByText('llama3.2:3b')).not.toBeInTheDocument();
		});

		it('clicking a model calls onSelectModel with ollama provider', async () => {
			const { props } = renderTab({
				ollamaStatus: 'connected',
				ollamaModels: ['llama3.2:3b', 'codellama:7b']
			});
			await userEvent.click(screen.getByText('codellama:7b'));
			expect(props.onSelectModel).toHaveBeenCalledWith({
				provider: 'ollama',
				modelId: 'codellama:7b'
			});
		});

		it('highlights the active model', () => {
			renderTab({
				ollamaStatus: 'connected',
				ollamaModels: ['llama3.2:3b', 'codellama:7b'],
				activeModel: { provider: 'ollama', modelId: 'codellama:7b' }
			});
			const btn = screen.getByText('codellama:7b').closest('button');
			expect(btn?.classList.contains('active')).toBe(true);

			const otherBtn = screen.getByText('llama3.2:3b').closest('button');
			expect(otherBtn?.classList.contains('active')).toBe(false);
		});
	});
});
