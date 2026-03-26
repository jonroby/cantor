<script lang="ts">
	import { PROVIDER_CONFIG } from '$lib/chat/models';
	import type { ActiveModel, Provider } from '$lib/chat/models';
	import Button from '$lib/components/ui/button.svelte';
	import Input from '$lib/components/ui/input.svelte';

	interface Props {
		flow: { provider: string; mode: 'unlock' | 'setup' };
		onUnlockKeys: (password: string) => Promise<void>;
		onSaveKey: (provider: string, apiKey: string, password: string) => Promise<void>;
		onSelectModel: (model: ActiveModel) => void;
		pendingModel: ActiveModel | null;
		onBack: () => void;
		onDone: () => void;
	}

	let { flow, onUnlockKeys, onSaveKey, onSelectModel, pendingModel, onBack, onDone }: Props =
		$props();

	let apiKeyInput = $state('');
	let passwordInput = $state('');
	let confirmPasswordInput = $state('');
	let keyError: string | null = $state(null);
	let isSubmitting = $state(false);

	function providerDisplayName(provider: string): string {
		return PROVIDER_CONFIG[provider as Exclude<Provider, 'ollama' | 'webllm'>]?.name ?? provider;
	}

	function keyPlaceholder(provider: string): string {
		return (
			PROVIDER_CONFIG[provider as Exclude<Provider, 'ollama' | 'webllm'>]?.keyPlaceholder ??
			'sk-...'
		);
	}

	async function handleUnlock() {
		isSubmitting = true;
		keyError = null;
		try {
			await onUnlockKeys(passwordInput);
			if (pendingModel) {
				onSelectModel(pendingModel);
			}
			onDone();
		} catch (err) {
			keyError = err instanceof Error ? err.message : 'Failed to unlock.';
		} finally {
			isSubmitting = false;
		}
	}

	async function handleSaveKey() {
		if (passwordInput !== confirmPasswordInput) {
			keyError = 'Passwords do not match.';
			return;
		}
		if (passwordInput.length < 8) {
			keyError = 'Password must be at least 8 characters.';
			return;
		}
		isSubmitting = true;
		keyError = null;
		try {
			await onSaveKey(flow.provider, apiKeyInput.trim(), passwordInput);
			if (pendingModel) {
				onSelectModel(pendingModel);
			}
			onDone();
		} catch (err) {
			keyError = err instanceof Error ? err.message : 'Failed to save key.';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<div class="palette-key-flow">
	<div>
		<h2 class="palette-heading">
			{flow.mode === 'unlock'
				? 'Unlock API Keys'
				: `Add ${providerDisplayName(flow.provider)} API Key`}
		</h2>
	</div>

	{#if flow.mode === 'setup'}
		<div class="palette-field">
			<label class="palette-label">API Key</label>
			<Input
				type="password"
				placeholder={keyPlaceholder(flow.provider)}
				bind:value={apiKeyInput}
				autofocus
			/>
			<p class="palette-hint">
				Your key is encrypted with your password and stored locally. It never leaves your device.
			</p>
		</div>
	{/if}

	<div class="palette-field">
		<label class="palette-label">
			{flow.mode === 'unlock' ? 'Password' : 'Master Password'}
		</label>
		<Input
			type="password"
			placeholder={flow.mode === 'unlock' ? 'Enter your password' : 'Choose a password'}
			bind:value={passwordInput}
			autofocus={flow.mode === 'unlock'}
			onkeydown={(e) => {
				if (e.key === 'Enter' && flow.mode === 'unlock') handleUnlock();
			}}
		/>
	</div>

	{#if flow.mode === 'setup'}
		<div class="palette-field">
			<label class="palette-label">Confirm Password</label>
			<Input
				type="password"
				placeholder="Confirm your password"
				bind:value={confirmPasswordInput}
				onkeydown={(e) => {
					if (e.key === 'Enter') handleSaveKey();
				}}
			/>
		</div>
	{/if}

	{#if keyError}
		<p class="palette-error">{keyError}</p>
	{/if}

	<div class="palette-actions">
		<Button variant="ghost" onclick={onBack} disabled={isSubmitting}>Back</Button>
		<Button
			onclick={flow.mode === 'unlock' ? handleUnlock : handleSaveKey}
			disabled={isSubmitting ||
				!passwordInput ||
				(flow.mode === 'setup' && (!apiKeyInput || !confirmPasswordInput))}
		>
			{isSubmitting ? '...' : flow.mode === 'unlock' ? 'Unlock' : 'Save & Use'}
		</Button>
	</div>
</div>
