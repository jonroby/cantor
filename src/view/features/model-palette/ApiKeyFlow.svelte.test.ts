// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import ApiKeyFlow from './ApiKeyFlow.svelte';
import type { ActiveModel } from '@/domain/models';

function renderFlow(overrides: Partial<Parameters<typeof ApiKeyFlow>[1]> = {}) {
	const props = {
		flow: { provider: 'claude', mode: 'setup' as const },
		onUnlockKeys: vi.fn(),
		onSaveKey: vi.fn(),
		onSelectModel: vi.fn(),
		pendingModel: { provider: 'claude', modelId: 'claude-sonnet-4-6' } as ActiveModel | null,
		onBack: vi.fn(),
		onDone: vi.fn(),
		...overrides
	};
	return { ...render(ApiKeyFlow, { props }), props };
}

describe('ApiKeyFlow', () => {
	describe('setup mode', () => {
		it('shows "Add Claude API Key" heading', () => {
			renderFlow();
			expect(screen.getByText(/Add.*Claude.*API Key/)).toBeInTheDocument();
		});

		it('shows API key input, password, and confirm password fields', () => {
			renderFlow();
			expect(screen.getByLabelText('API Key')).toBeInTheDocument();
			expect(screen.getByLabelText('Master Password')).toBeInTheDocument();
			expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
		});

		it('Save & Use button is disabled when fields are empty', () => {
			renderFlow();
			expect(screen.getByText('Save & Use')).toBeDisabled();
		});

		it('Save & Use button enables when all fields are filled', async () => {
			renderFlow();
			await userEvent.type(screen.getByLabelText('API Key'), 'sk-ant-xxx');
			await userEvent.type(screen.getByLabelText('Master Password'), 'password123');
			await userEvent.type(screen.getByLabelText('Confirm Password'), 'password123');
			expect(screen.getByText('Save & Use')).not.toBeDisabled();
		});

		it('shows error when passwords do not match', async () => {
			renderFlow();
			await userEvent.type(screen.getByLabelText('API Key'), 'sk-ant-xxx');
			await userEvent.type(screen.getByLabelText('Master Password'), 'password123');
			await userEvent.type(screen.getByLabelText('Confirm Password'), 'different');
			await userEvent.click(screen.getByText('Save & Use'));
			await tick();
			expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
		});

		it('shows error when password is too short', async () => {
			renderFlow();
			await userEvent.type(screen.getByLabelText('API Key'), 'sk-ant-xxx');
			await userEvent.type(screen.getByLabelText('Master Password'), 'short');
			await userEvent.type(screen.getByLabelText('Confirm Password'), 'short');
			await userEvent.click(screen.getByText('Save & Use'));
			await tick();
			expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument();
		});

		it('calls onSaveKey and onSelectModel on successful save', async () => {
			const { props } = renderFlow();
			await userEvent.type(screen.getByLabelText('API Key'), 'sk-ant-xxx');
			await userEvent.type(screen.getByLabelText('Master Password'), 'password123');
			await userEvent.type(screen.getByLabelText('Confirm Password'), 'password123');
			await userEvent.click(screen.getByText('Save & Use'));
			await tick();

			expect(props.onSaveKey).toHaveBeenCalledWith('claude', 'sk-ant-xxx', 'password123');
			expect(props.onSelectModel).toHaveBeenCalledWith({
				provider: 'claude',
				modelId: 'claude-sonnet-4-6'
			});
			expect(props.onDone).toHaveBeenCalled();
		});

		it('shows error when onSaveKey rejects', async () => {
			const { props } = renderFlow();
			vi.mocked(props.onSaveKey).mockRejectedValueOnce(new Error('Storage full'));

			await userEvent.type(screen.getByLabelText('API Key'), 'sk-ant-xxx');
			await userEvent.type(screen.getByLabelText('Master Password'), 'password123');
			await userEvent.type(screen.getByLabelText('Confirm Password'), 'password123');
			await userEvent.click(screen.getByText('Save & Use'));
			await tick();

			expect(screen.getByText('Storage full')).toBeInTheDocument();
			expect(props.onSelectModel).not.toHaveBeenCalled();
		});
	});

	describe('unlock mode', () => {
		it('shows "Unlock API Keys" heading', () => {
			renderFlow({ flow: { provider: 'claude', mode: 'unlock' } });
			expect(screen.getByText('Unlock API Keys')).toBeInTheDocument();
		});

		it('does not show API key or confirm password fields', () => {
			renderFlow({ flow: { provider: 'claude', mode: 'unlock' } });
			expect(screen.queryByLabelText('API Key')).not.toBeInTheDocument();
			expect(screen.queryByLabelText('Confirm Password')).not.toBeInTheDocument();
		});

		it('shows password field', () => {
			renderFlow({ flow: { provider: 'claude', mode: 'unlock' } });
			expect(screen.getByLabelText('Password')).toBeInTheDocument();
		});

		it('Unlock button is disabled when password is empty', () => {
			renderFlow({ flow: { provider: 'claude', mode: 'unlock' } });
			expect(screen.getByText('Unlock')).toBeDisabled();
		});

		it('calls onUnlockKeys and onSelectModel on successful unlock', async () => {
			const { props } = renderFlow({ flow: { provider: 'claude', mode: 'unlock' } });
			await userEvent.type(screen.getByLabelText('Password'), 'password123');
			await userEvent.click(screen.getByText('Unlock'));
			await tick();

			expect(props.onUnlockKeys).toHaveBeenCalledWith('password123');
			expect(props.onSelectModel).toHaveBeenCalledWith({
				provider: 'claude',
				modelId: 'claude-sonnet-4-6'
			});
			expect(props.onDone).toHaveBeenCalled();
		});

		it('shows error when unlock fails', async () => {
			const { props } = renderFlow({ flow: { provider: 'claude', mode: 'unlock' } });
			vi.mocked(props.onUnlockKeys).mockRejectedValueOnce(new Error('Incorrect password'));

			await userEvent.type(screen.getByLabelText('Password'), 'wrong');
			await userEvent.click(screen.getByText('Unlock'));
			await tick();

			expect(screen.getByText('Incorrect password')).toBeInTheDocument();
			expect(props.onSelectModel).not.toHaveBeenCalled();
		});
	});

	describe('navigation', () => {
		it('Back button calls onBack', async () => {
			const { props } = renderFlow();
			await userEvent.click(screen.getByText('Back'));
			expect(props.onBack).toHaveBeenCalledOnce();
		});
	});
});
