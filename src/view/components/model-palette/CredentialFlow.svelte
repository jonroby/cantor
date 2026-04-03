<script lang="ts">
	import { Button, Input } from '@/view/primitives';
	import type * as app from '@/app';

	interface Props {
		mode: 'unlock' | 'save';
		providerName: string;
		vaultState: app.providers.VaultState;
		credentialInput: string;
		passwordInput: string;
		confirmPasswordInput: string;
		credentialError: string | null;
		isSubmitting: boolean;
		onSubmit: () => void;
		onBack: () => void;
		onForgetKey: () => void;
	}

	let {
		mode,
		providerName,
		vaultState,
		credentialInput = $bindable(),
		passwordInput = $bindable(),
		confirmPasswordInput = $bindable(),
		credentialError,
		isSubmitting,
		onSubmit,
		onBack,
		onForgetKey
	}: Props = $props();
</script>

<div class="palette-key-flow">
	<div>
		<h2 class="palette-heading">
			{mode === 'unlock' ? 'Unlock credentials' : `Save credential for ${providerName}`}
		</h2>
	</div>

	{#if mode === 'save'}
		<div class="palette-field">
			<label class="palette-label" for="credential-input">API Key</label>
			<Input id="credential-input" type="password" bind:value={credentialInput} />
		</div>
	{/if}

	<div class="palette-field">
		<label class="palette-label" for="password-input">
			{mode === 'unlock' ? 'Password' : 'Master Password'}
		</label>
		<Input id="password-input" type="password" bind:value={passwordInput} />
	</div>

	{#if mode === 'save' && vaultState === 'empty'}
		<div class="palette-field">
			<label class="palette-label" for="confirm-password-input">Confirm Password</label>
			<Input id="confirm-password-input" type="password" bind:value={confirmPasswordInput} />
		</div>
	{/if}

	{#if credentialError}
		<p class="palette-error">{credentialError}</p>
	{/if}

	<div class="palette-actions">
		<Button variant="ghost" onclick={onBack} disabled={isSubmitting}>Back</Button>
		<Button onclick={onSubmit} disabled={isSubmitting || !passwordInput}>
			{#if isSubmitting}
				Validating...
			{:else}
				{mode === 'unlock' ? 'Unlock' : 'Save'}
			{/if}
		</Button>
	</div>

	{#if mode === 'unlock'}
		<button class="palette-forget-key" onclick={onForgetKey}>Forget saved key</button>
	{/if}
</div>
