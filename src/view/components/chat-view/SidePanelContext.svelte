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
