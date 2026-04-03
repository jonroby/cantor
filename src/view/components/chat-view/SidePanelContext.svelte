<script lang="ts">
	import type * as app from '@/app';

	interface Props {
		exchange: app.chat.Exchange;
	}

	let { exchange }: Props = $props();
</script>

<div class="chatview-side-context">
	<div class="chatview-side-context-label">From this message</div>
	<div class="chatview-side-context-prompt">{exchange.prompt.text}</div>
	{#if exchange.response}
		<div class="chatview-side-context-response">
			{exchange.response.text.slice(0, 150)}{exchange.response.text.length > 150 ? '…' : ''}
		</div>
	{/if}
</div>

<style>
	.chatview-side-context {
		padding: 0.75rem 1rem;
		margin: 0.75rem 0.75rem 0;
		border: 1px solid hsl(var(--primary) / 0.25);
		border-radius: 0.5rem;
		background: hsl(var(--primary) / 0.06);
	}

	.chatview-side-context-label {
		font-size: var(--text-xs);
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: hsl(var(--primary) / 0.6);
		margin-bottom: 0.35rem;
	}

	.chatview-side-context-prompt {
		font-size: var(--text-base);
		font-weight: 500;
		color: hsl(var(--foreground));
		line-height: 1.4;
	}

	.chatview-side-context-response {
		margin-top: 0.3rem;
		font-size: var(--text-base);
		color: hsl(var(--muted-foreground));
		line-height: 1.4;
	}
</style>
