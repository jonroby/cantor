// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import ComposerInput from '../ComposerInput.svelte';

function renderComposerInput(overrides: Partial<Parameters<typeof ComposerInput>[1]> = {}) {
	const props = {
		composerValue: '',
		pendingImages: [],
		agentMode: false,
		inputMessage: null,
		submitDisabledReason: null,
		streaming: false,
		activeModelLabel: 'Claude Sonnet 4.5',
		activeProvider: 'claude',
		usedTokens: 0,
		totalTokens: 0,
		contextLength: 128000,
		contextStrategy: 'full' as const,
		onSubmit: vi.fn(),
		onStop: vi.fn(),
		onOpenPalette: vi.fn(),
		onOpenContextPalette: vi.fn(),
		...overrides
	};
	return { ...render(ComposerInput, { props }), props };
}

describe('ComposerInput', () => {
	it('submit fires onSubmit', async () => {
		const { props } = renderComposerInput({ composerValue: 'hello' });
		const sendBtn = screen.getByRole('button', { name: 'Send message' });
		await userEvent.click(sendBtn);
		expect(props.onSubmit).toHaveBeenCalledOnce();
	});

	it('send button disabled when input is empty', () => {
		renderComposerInput({ composerValue: '' });
		const sendBtn = screen.getByRole('button', { name: 'Send message' });
		expect(sendBtn).toBeDisabled();
	});

	it('send button disabled when submitDisabledReason is set', () => {
		renderComposerInput({
			composerValue: 'hello',
			submitDisabledReason: 'Select a model first.'
		});
		const sendBtn = screen.getByRole('button', { name: 'Send message' });
		expect(sendBtn).toBeDisabled();
	});

	it('shows disabled reason hint text', () => {
		renderComposerInput({ submitDisabledReason: 'Select a model first.' });
		expect(screen.getByText('Select a model first.')).toBeInTheDocument();
	});

	it('shows stop button during streaming', () => {
		renderComposerInput({ streaming: true });
		expect(screen.getByRole('button', { name: 'Stop response' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Send message' })).not.toBeInTheDocument();
	});

	it('stop button fires onStop', async () => {
		const { props } = renderComposerInput({ streaming: true });
		await userEvent.click(screen.getByRole('button', { name: 'Stop response' }));
		expect(props.onStop).toHaveBeenCalledOnce();
	});

	it('model chip shows model name', () => {
		renderComposerInput({ activeModelLabel: 'claude-sonnet-4-5' });
		expect(screen.getByText('claude-sonnet-4-5')).toBeInTheDocument();
	});

	it('model chip shows "Connect a model" when no model', () => {
		renderComposerInput({ activeModelLabel: null });
		expect(screen.getByText('Choose model')).toBeInTheDocument();
	});

	it('model chip opens palette', async () => {
		const { props } = renderComposerInput();
		await userEvent.click(screen.getByText('Claude Sonnet 4.5'));
		expect(props.onOpenPalette).toHaveBeenCalledOnce();
	});

	it('shows token count', () => {
		renderComposerInput({ usedTokens: 1500, contextLength: 128000 });
		expect(screen.getByText(/1,500 \/ 128,000/)).toBeInTheDocument();
	});

	it('shows "Context" label', () => {
		renderComposerInput();
		expect(screen.getByText('Context')).toBeInTheDocument();
	});

	it('gear button fires onOpenContextPalette', async () => {
		const { props } = renderComposerInput();
		await userEvent.click(screen.getByTitle('Context settings'));
		expect(props.onOpenContextPalette).toHaveBeenCalledOnce();
	});
});
