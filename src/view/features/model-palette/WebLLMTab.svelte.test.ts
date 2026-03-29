// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import WebLLMTab from './WebLLMTab.svelte';
import type * as domain from '@/domain';
import type * as external from '@/external';

const CONTEXT_OPTIONS: ReadonlyArray<{
	label: string;
	value: external.providers.webllm.WebLLMContextSize;
}> = [
	{ label: '4K', value: 4_096 },
	{ label: '8K', value: 8_192 },
	{ label: '16K', value: 16_384 }
];

function makeModels(n: number): external.providers.webllm.WebLLMModelEntry[] {
	return Array.from({ length: n }, (_, i) => ({
		id: `model-${i}`,
		label: `model-${i}`,
		vramMB: (i + 1) * 256
	}));
}

function renderTab(overrides: Partial<Parameters<typeof WebLLMTab>[1]> = {}) {
	const props = {
		activeModel: null as domain.models.ActiveModel | null,
		webllmStatus: 'idle' as const,
		webllmProgress: 0,
		webllmProgressText: '',
		webllmModels: makeModels(5),
		webllmError: null as string | null,
		webllmContextSize: 4_096 as external.providers.webllm.WebLLMContextSize,
		webllmContextOptions: CONTEXT_OPTIONS,
		onWebLLMContextSizeChange: vi.fn(),
		onLoadWebLLMModel: vi.fn(),
		onDeleteWebLLMCache: vi.fn(),
		onDeleteAllWebLLMCaches: vi.fn(),
		...overrides
	};
	return { ...render(WebLLMTab, { props }), props };
}

describe('WebLLMTab', () => {
	describe('context window selector', () => {
		it('renders all context size options', () => {
			renderTab();
			expect(screen.getByText('4K')).toBeInTheDocument();
			expect(screen.getByText('8K')).toBeInTheDocument();
			expect(screen.getByText('16K')).toBeInTheDocument();
		});

		it('highlights the active context size', () => {
			renderTab({ webllmContextSize: 8_192 });
			const btn = screen.getByText('8K').closest('button');
			expect(btn?.classList.contains('active')).toBe(true);
		});

		it('clicking a context option calls onWebLLMContextSizeChange', async () => {
			const { props } = renderTab();
			await userEvent.click(screen.getByText('16K'));
			expect(props.onWebLLMContextSizeChange).toHaveBeenCalledWith(16_384);
		});

		it('context buttons are disabled while loading', () => {
			renderTab({ webllmStatus: 'loading' });
			const btn = screen.getByText('8K').closest('button');
			expect(btn).toBeDisabled();
		});

		it('shows memory hint for low context', () => {
			renderTab({ webllmContextSize: 4_096 });
			expect(screen.getByText('Low memory')).toBeInTheDocument();
		});

		it('shows memory hint for high context', () => {
			renderTab({ webllmContextSize: 16_384 });
			expect(screen.getByText('More memory')).toBeInTheDocument();
		});
	});

	describe('model list', () => {
		it('renders model IDs', () => {
			renderTab({ webllmModels: makeModels(3) });
			expect(screen.getByText('model-0')).toBeInTheDocument();
			expect(screen.getByText('model-1')).toBeInTheDocument();
			expect(screen.getByText('model-2')).toBeInTheDocument();
		});

		it('shows VRAM in MB for small models', () => {
			renderTab({ webllmModels: [{ id: 'small-model', label: 'small-model', vramMB: 512 }] });
			expect(screen.getByText('512MB')).toBeInTheDocument();
		});

		it('shows VRAM in GB for large models', () => {
			renderTab({ webllmModels: [{ id: 'big-model', label: 'big-model', vramMB: 2048 }] });
			expect(screen.getByText('2.0GB')).toBeInTheDocument();
		});

		it('clicking a model calls onLoadWebLLMModel', async () => {
			const { props } = renderTab({ webllmModels: makeModels(3) });
			await userEvent.click(screen.getByText('model-1'));
			expect(props.onLoadWebLLMModel).toHaveBeenCalledWith('model-1');
		});

		it('model buttons are disabled while loading', () => {
			renderTab({ webllmStatus: 'loading', webllmModels: makeModels(1) });
			const btn = screen.getByText('model-0').closest('button');
			expect(btn).toBeDisabled();
		});

		it('highlights the loaded model', () => {
			renderTab({
				webllmModels: makeModels(3),
				activeModel: { provider: 'webllm', modelId: 'model-1' }
			});
			const btn = screen.getByText('model-1').closest('button');
			expect(btn?.classList.contains('active')).toBe(true);
		});

		it('only shows first 20 models by default', () => {
			renderTab({ webllmModels: makeModels(30) });
			expect(screen.getByText('model-0')).toBeInTheDocument();
			expect(screen.getByText('model-19')).toBeInTheDocument();
			expect(screen.queryByText('model-20')).not.toBeInTheDocument();
		});

		it('shows total model count hint', () => {
			renderTab({ webllmModels: makeModels(50) });
			expect(screen.getByText('50 models available. Search to find more.')).toBeInTheDocument();
		});
	});

	describe('search', () => {
		it('filters models by search query', async () => {
			const models: external.providers.webllm.WebLLMModelEntry[] = [
				{ id: 'Llama-3-8B', label: 'Llama-3-8B', vramMB: 512 },
				{ id: 'Phi-3-mini', label: 'Phi-3-mini', vramMB: 256 },
				{ id: 'Llama-2-7B', label: 'Llama-2-7B', vramMB: 1024 }
			];
			renderTab({ webllmModels: models });

			await userEvent.type(screen.getByPlaceholderText(/Search models/), 'Llama');
			expect(screen.getByText('Llama-3-8B')).toBeInTheDocument();
			expect(screen.getByText('Llama-2-7B')).toBeInTheDocument();
			expect(screen.queryByText('Phi-3-mini')).not.toBeInTheDocument();
		});

		it('shows "No models match" when search has no results', async () => {
			renderTab({ webllmModels: makeModels(3) });
			await userEvent.type(screen.getByPlaceholderText(/Search models/), 'nonexistent');
			expect(screen.getByText(/No models match "nonexistent"/)).toBeInTheDocument();
		});
	});

	describe('loading state', () => {
		it('shows progress bar while loading', () => {
			const { container } = renderTab({
				webllmStatus: 'loading',
				webllmProgress: 0.5,
				webllmProgressText: 'Downloading 234MB'
			});
			expect(screen.getByText('Downloading 234MB')).toBeInTheDocument();
			const fill = container.querySelector('.palette-webllm-progress-fill') as HTMLElement;
			expect(fill?.style.width).toBe('50%');
		});

		it('shows fallback progress text when progressText is empty', () => {
			renderTab({
				webllmStatus: 'loading',
				webllmProgress: 0.75,
				webllmProgressText: ''
			});
			expect(screen.getByText('Loading... 75%')).toBeInTheDocument();
		});
	});

	describe('error state', () => {
		it('shows error message', () => {
			renderTab({ webllmError: 'WebGPU not supported' });
			expect(screen.getByText('WebGPU not supported')).toBeInTheDocument();
		});
	});

	describe('cache management', () => {
		it('shows "Clear all cached models" button', () => {
			renderTab();
			expect(screen.getByText('Clear all cached models')).toBeInTheDocument();
		});

		it('clicking "Clear all" calls onDeleteAllWebLLMCaches', async () => {
			const { props } = renderTab();
			await userEvent.click(screen.getByText('Clear all cached models'));
			expect(props.onDeleteAllWebLLMCaches).toHaveBeenCalledOnce();
		});

		it('shows "Remove cached model" only when a webllm model is active', () => {
			renderTab({ activeModel: { provider: 'webllm', modelId: 'model-0' } });
			expect(screen.getByText(/Remove cached model/)).toBeInTheDocument();
		});

		it('does not show "Remove cached model" when no webllm model is active', () => {
			renderTab({ activeModel: null });
			expect(screen.queryByText(/Remove cached model/)).not.toBeInTheDocument();
		});

		it('clicking "Remove cached model" calls onDeleteWebLLMCache with model id', async () => {
			const { props } = renderTab({
				activeModel: { provider: 'webllm', modelId: 'model-0' },
				webllmModels: makeModels(3)
			});
			await userEvent.click(screen.getByText(/Remove cached model/));
			expect(props.onDeleteWebLLMCache).toHaveBeenCalledWith('model-0');
		});
	});
});
