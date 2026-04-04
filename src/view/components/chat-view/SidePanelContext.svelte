<script lang="ts">
	import type * as app from '@/app';

	interface Props {
		exchange: app.chat.Exchange;
	}

	let { exchange }: Props = $props();
</script>

<div class="side-context">
	<div class="side-context-label">From this message</div>
	<div class="side-context-prompt">{exchange.prompt.text}</div>
	{#if exchange.response}
		<div class="side-context-response">
			{exchange.response.text.slice(0, 150)}{exchange.response.text.length > 150 ? '…' : ''}
		</div>
	{/if}
</div>

<style>
	.side-context {
		margin: 0.75rem;
		border-radius: 0.5rem;
		border: 1px solid hsl(var(--primary) / 0.25);
		background: hsl(var(--primary) / 0.06);
		padding: 0.75rem 1rem;
	}

	.side-context-label {
		margin-bottom: 0.35rem;
		font-weight: var(--font-weight-semibold);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: hsl(var(--primary) / 0.6);
	}

	.side-context-prompt {
		line-height: 1.4;
		font-weight: var(--font-weight-medium);
		color: hsl(var(--foreground));
	}

	.side-context-response {
		margin-top: 0.3rem;
		line-height: 1.4;
		color: hsl(var(--muted-foreground));
	}
</style>
