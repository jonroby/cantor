// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import ModelPalette from './ModelPalette.svelte';
import type { ActiveModel } from '@/domain/models';
import type { WebLLMContextSize } from '@/external/providers/webllm';

vi.mock('@/domain/models/logos', () => ({
	PROVIDER_LOGOS: {}
}));

const CONTEXT_OPTIONS: ReadonlyArray<{ label: string; value: WebLLMContextSize }> = [
	{ label: '4K', value: 4_096 },
	{ label: '8K', value: 8_192 },
	{ label: '16K', value: 16_384 }
];

function renderPalette(overrides: Partial<Parameters<typeof ModelPalette>[1]> = {}) {
	const props = {
		open: true,
		onClose: vi.fn(),
		activeModel: null as ActiveModel | null,
		onSelectModel: vi.fn(),
		ollamaUrl: 'http://localhost:11434',
		ollamaStatus: 'disconnected' as const,
		ollamaModels: [] as string[],
		onConnectOllama: vi.fn(),
		apiKeys: {} as Record<string, string>,
		vaultProviders: [] as string[],
		onUnlockKeys: vi.fn(),
		onSaveKey: vi.fn(),
		onForgetKey: vi.fn(),
		webllmStatus: 'idle' as const,
		webllmProgress: 0,
		webllmProgressText: '',
		webllmModels: [],
		webllmError: null,
		webllmContextSize: 4_096 as WebLLMContextSize,
		webllmContextOptions: CONTEXT_OPTIONS,
		onWebLLMContextSizeChange: vi.fn(),
		onLoadWebLLMModel: vi.fn(),
		onDeleteWebLLMCache: vi.fn(),
		onDeleteAllWebLLMCaches: vi.fn(),
		...overrides
	};
	return { ...render(ModelPalette, { props }), props };
}

describe('ModelPalette', () => {
	describe('visibility', () => {
		it('renders nothing when closed', () => {
			const { container } = renderPalette({ open: false });
			expect(container.querySelector('.palette-panel')).toBeNull();
		});

		it('renders panel when open', () => {
			const { container } = renderPalette({ open: true });
			expect(container.querySelector('.palette-panel')).not.toBeNull();
		});
	});

	describe('current model indicator', () => {
		it('shows "No model selected" when no active model', () => {
			renderPalette({ activeModel: null });
			expect(screen.getByText('No model selected')).toBeInTheDocument();
		});

		it('shows Claude model label for frontier model', () => {
			const { container } = renderPalette({
				activeModel: { provider: 'claude', modelId: 'claude-sonnet-4-6' }
			});
			const currentName = container.querySelector('.palette-current-name');
			expect(currentName?.textContent).toBe('Claude Sonnet 4.6');
			const currentProvider = container.querySelector('.palette-current-provider');
			expect(currentProvider?.textContent).toBe('Frontier');
		});

		it('shows model ID for ollama model', () => {
			renderPalette({
				activeModel: { provider: 'ollama', modelId: 'llama3.2:3b' }
			});
			const indicator = screen.getByText('Ollama', { selector: '.palette-current-provider' });
			const currentName = indicator
				.closest('.palette-current-model')
				?.querySelector('.palette-current-name');
			expect(currentName?.textContent).toBe('llama3.2:3b');
		});
	});

	describe('tabs', () => {
		it('renders all three tabs', () => {
			renderPalette();
			expect(screen.getByText('Ollama')).toBeInTheDocument();
			expect(screen.getByText('Frontier')).toBeInTheDocument();
			expect(screen.getByText('WebLLM')).toBeInTheDocument();
		});

		it('defaults to Frontier tab when no model is active', () => {
			renderPalette({ activeModel: null });
			// Frontier tab content includes Claude models
			expect(screen.getByText('Claude Opus 4.6')).toBeInTheDocument();
		});

		it('defaults to Ollama tab when active model is ollama', () => {
			renderPalette({
				activeModel: { provider: 'ollama', modelId: 'llama3:8b' },
				ollamaStatus: 'connected',
				ollamaModels: ['llama3:8b']
			});
			// Ollama tab is active — shows Reconnect button (only visible in ollama tab)
			expect(screen.getByText('Reconnect')).toBeInTheDocument();
		});

		it('switching to WebLLM tab shows WebLLM content', async () => {
			renderPalette();
			await userEvent.click(screen.getByText('WebLLM'));
			await tick();
			expect(screen.getByText('Context window:')).toBeInTheDocument();
		});

		it('switching to Ollama tab shows Ollama content', async () => {
			renderPalette();
			await userEvent.click(screen.getByText('Ollama'));
			await tick();
			expect(screen.getByText('Connect')).toBeInTheDocument();
		});
	});

	describe('closing', () => {
		it('clicking scrim calls onClose', async () => {
			const { props } = renderPalette();
			await userEvent.click(screen.getByLabelText('Close model palette'));
			expect(props.onClose).toHaveBeenCalledOnce();
		});
	});

	describe('frontier model selection triggers key flow', () => {
		it('selects model directly when key is already decrypted', async () => {
			const { props } = renderPalette({ apiKeys: { claude: 'sk-ant-xxx' } });
			await userEvent.click(screen.getByText('Claude Sonnet 4.6'));
			expect(props.onSelectModel).toHaveBeenCalledWith({
				provider: 'claude',
				modelId: 'claude-sonnet-4-6'
			});
			expect(props.onClose).toHaveBeenCalled();
		});

		it('shows unlock flow when vault exists but key not decrypted', async () => {
			renderPalette({ apiKeys: {}, vaultProviders: ['claude'] });
			await userEvent.click(screen.getByText('Claude Sonnet 4.6'));
			await tick();
			expect(screen.getByText('Unlock API Keys')).toBeInTheDocument();
		});

		it('shows setup flow when no vault exists', async () => {
			renderPalette({ apiKeys: {}, vaultProviders: [] });
			await userEvent.click(screen.getByText('Claude Sonnet 4.6'));
			await tick();
			expect(screen.getByText(/Add.*API Key/)).toBeInTheDocument();
		});
	});
});
