<script lang="ts">
	import { Toaster as Sonner, type ToasterProps as SonnerProps } from 'svelte-sonner';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { Loading03Icon } from '@hugeicons/core-free-icons';
	import { CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';
	import { MultiplicationSignCircleIcon } from '@hugeicons/core-free-icons';
	import { InformationCircleIcon } from '@hugeicons/core-free-icons';
	import { Alert02Icon } from '@hugeicons/core-free-icons';

	let { ...restProps }: SonnerProps = $props();
</script>

<Sonner
	theme="light"
	class="toaster group"
	style="--normal-bg: var(--color-popover); --normal-text: var(--color-popover-foreground); --normal-border: var(--color-border);"
	{...restProps}
>
	{#snippet loadingIcon()}
		<HugeiconsIcon icon={Loading03Icon} strokeWidth={2} class="size-4 animate-spin" />
	{/snippet}
	{#snippet successIcon()}
		<HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} class="size-4 sonner-success-icon" />
	{/snippet}
	{#snippet errorIcon()}
		<HugeiconsIcon icon={MultiplicationSignCircleIcon} strokeWidth={2} class="size-4 sonner-error-icon" />
	{/snippet}
	{#snippet infoIcon()}
		<HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} class="size-4" />
	{/snippet}
	{#snippet warningIcon()}
		<HugeiconsIcon icon={Alert02Icon} strokeWidth={2} class="size-4" />
	{/snippet}
</Sonner>

<style>
	:global(.sonner-success-icon) {
		color: hsl(142 71% 45%);
	}

	:global(.sonner-error-icon) {
		color: hsl(0 72% 51%);
	}
</style>
