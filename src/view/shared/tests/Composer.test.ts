// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import Composer from '../Composer.svelte';

function renderComposer(overrides: Partial<Parameters<typeof Composer>[1]> = {}) {
	const props = {
		composerValue: '',
		agentMode: false,
		inputMessage: null,
		submitDisabledReason: null,
		streaming: false,
		activeModelLabel: 'Claude Sonnet 4.5',
		activeProvider: 'claude',
		usedTokens: 0,
		contextLength: 128000,
		onSubmit: vi.fn(),
		onStop: vi.fn(),
		onOpenPalette: vi.fn(),
		...overrides
	};
	return { ...render(Composer, { props }), props };
}

describe('Composer', () => {
	it('submit fires onSubmit', async () => {
		const { props } = renderComposer({ composerValue: 'hello' });
		const sendBtn = screen.getByRole('button', { name: 'Send message' });
		await userEvent.click(sendBtn);
		expect(props.onSubmit).toHaveBeenCalledOnce();
	});

	it('send button disabled when input is empty', () => {
		renderComposer({ composerValue: '' });
		const sendBtn = screen.getByRole('button', { name: 'Send message' });
		expect(sendBtn).toBeDisabled();
	});

	it('send button disabled when submitDisabledReason is set', () => {
		renderComposer({
			composerValue: 'hello',
			submitDisabledReason: 'Select a model first.'
		});
		const sendBtn = screen.getByRole('button', { name: 'Send message' });
		expect(sendBtn).toBeDisabled();
	});

	it('shows disabled reason hint text', () => {
		renderComposer({ submitDisabledReason: 'Select a model first.' });
		expect(screen.getByText('Select a model first.')).toBeInTheDocument();
	});

	it('shows stop button during streaming', () => {
		renderComposer({ streaming: true });
		expect(screen.getByRole('button', { name: 'Stop response' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Send message' })).not.toBeInTheDocument();
	});

	it('stop button fires onStop', async () => {
		const { props } = renderComposer({ streaming: true });
		await userEvent.click(screen.getByRole('button', { name: 'Stop response' }));
		expect(props.onStop).toHaveBeenCalledOnce();
	});

	it('model chip shows model name', () => {
		renderComposer({ activeModelLabel: 'claude-sonnet-4-5' });
		expect(screen.getByText('claude-sonnet-4-5')).toBeInTheDocument();
	});

	it('model chip shows "Connect a model" when no model', () => {
		renderComposer({ activeModelLabel: null });
		expect(screen.getByText('Connect a model')).toBeInTheDocument();
	});

	it('model chip opens palette', async () => {
		const { props } = renderComposer();
		await userEvent.click(screen.getByText('claude-sonnet-4-5'));
		expect(props.onOpenPalette).toHaveBeenCalledOnce();
	});

	it('shows token count', () => {
		renderComposer({ usedTokens: 1500, contextLength: 128000 });
		expect(screen.getByText(/1,500 \/ 128,000/)).toBeInTheDocument();
	});
});
