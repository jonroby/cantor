// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import ModelPalette from '../ModelPalette.svelte';
import type * as app from '@/app';

function renderPalette(overrides: Partial<Parameters<typeof ModelPalette>[1]> = {}) {
	const state: app.providers.State = {
		activeModel: null,
		contextLength: null,
		providers: [
			{
				id: 'claude',
				name: 'Claude',
				kind: 'remote',
				credentialState: 'missing',
				models: [
					{ id: 'claude-opus-4-6', label: 'Claude Opus 4.6', enabled: true },
					{ id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', enabled: true }
				]
			},
			{
				id: 'ollama',
				name: 'Ollama',
				kind: 'local',
				connection: {
					status: 'disconnected',
					value: 'http://localhost:11434',
					label: 'Server URL'
				},
				models: []
			},
			{
				id: 'webllm',
				name: 'WebLLM',
				kind: 'embedded',
				loadState: {
					status: 'idle',
					progress: 0,
					text: '',
					error: null
				},
				context: {
					value: 4_096,
					options: [
						{ label: '4K', value: 4_096 },
						{ label: '8K', value: 8_192 },
						{ label: '16K', value: 16_384 }
					]
				},
				models: [{ id: 'Llama-3', label: 'Llama-3', enabled: true, meta: '1.0GB' }]
			}
		]
	};

	const props = {
		open: true,
		onClose: vi.fn(),
		state,
		onConnect: vi.fn(),
		onSelectModel: vi.fn(),
		onUnlockCredentials: vi.fn(),
		onSaveCredential: vi.fn(),
		onClearCredential: vi.fn(),
		onSetContextSize: vi.fn(),
		onRemoveCachedModel: vi.fn(),
		onClearCachedModels: vi.fn(),
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
			renderPalette();
			expect(screen.getByText('No model selected')).toBeInTheDocument();
		});

		it('shows active model label from provider state', () => {
			const { container } = renderPalette({
				state: {
					activeModel: { provider: 'claude', modelId: 'claude-sonnet-4-6' },
					contextLength: 1_000_000,
					providers: [
						{
							id: 'claude',
							name: 'Claude',
							kind: 'remote',
							credentialState: 'ready',
							models: [{ id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', enabled: true }]
						}
					]
				}
			});
			const currentName = container.querySelector('.palette-current-name');
			expect(currentName?.textContent).toBe('Claude Sonnet 4.6');
		});
	});

	describe('provider groups', () => {
		it('renders providers from app state', () => {
			renderPalette();
			expect(screen.getByText('Ollama')).toBeInTheDocument();
			expect(screen.getByText('Claude')).toBeInTheDocument();
			expect(screen.getByText('WebLLM')).toBeInTheDocument();
		});

		it('shows provider-specific sections based on generic capabilities', async () => {
			renderPalette();
			await userEvent.click(screen.getByText('Ollama'));
			await tick();
			expect(screen.getByPlaceholderText('localhost:11434')).toBeInTheDocument();
			expect(screen.getByText('Connect')).toBeInTheDocument();
			await userEvent.click(screen.getByText('WebLLM'));
			await tick();
			expect(screen.getByText('Context window:')).toBeInTheDocument();
		});
	});

	describe('closing', () => {
		it('clicking scrim calls onClose', async () => {
			const { props } = renderPalette();
			await userEvent.click(screen.getByLabelText('Close model palette'));
			expect(props.onClose).toHaveBeenCalledOnce();
		});
	});

	describe('generic actions', () => {
		it('selects a model directly when provider is ready', async () => {
			const { props } = renderPalette({
				state: {
					activeModel: null,
					contextLength: null,
					providers: [
						{
							id: 'claude',
							name: 'Claude',
							kind: 'remote',
							credentialState: 'ready',
							models: [{ id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', enabled: true }]
						}
					]
				}
			});
			await userEvent.click(screen.getByText('Claude Sonnet 4.6'));
			expect(props.onSelectModel).toHaveBeenCalledWith({
				provider: 'claude',
				modelId: 'claude-sonnet-4-6'
			});
			expect(props.onClose).toHaveBeenCalled();
		});

		it('shows unlock flow when provider is locked', async () => {
			renderPalette({
				state: {
					activeModel: null,
					contextLength: null,
					providers: [
						{
							id: 'claude',
							name: 'Claude',
							kind: 'remote',
							credentialState: 'locked',
							models: [{ id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', enabled: true }]
						}
					]
				}
			});
			await userEvent.click(screen.getByText('Claude Sonnet 4.6'));
			await tick();
			expect(screen.getByText('Unlock credentials')).toBeInTheDocument();
		});

		it('shows save credential flow when provider is missing credentials', async () => {
			renderPalette({
				state: {
					activeModel: null,
					contextLength: null,
					providers: [
						{
							id: 'claude',
							name: 'Claude',
							kind: 'remote',
							credentialState: 'missing',
							models: [{ id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', enabled: true }]
						}
					]
				}
			});
			await userEvent.click(screen.getByText('Claude Sonnet 4.6'));
			await tick();
			expect(screen.getByText(/Save credential for Claude/)).toBeInTheDocument();
		});

		it('connects a provider through the generic connect action', async () => {
			const { props } = renderPalette();
			await userEvent.click(screen.getByText('Ollama'));
			await userEvent.click(screen.getByText('Connect'));
			expect(props.onConnect).toHaveBeenCalledWith('ollama', 'http://localhost:11434');
		});

		it('updates context size through the generic context action', async () => {
			const { props } = renderPalette();
			await userEvent.click(screen.getByText('WebLLM'));
			await userEvent.click(screen.getByText('16K'));
			expect(props.onSetContextSize).toHaveBeenCalledWith(16_384);
		});
	});
});
