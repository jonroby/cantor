<script lang="ts">
	import type * as app from '@/app';

	interface Props {
		exchange: app.chat.Exchange;
	}

	let { exchange }: Props = $props();
</script>

<div class="mx-3 mt-3 rounded-lg border border-primary/25 bg-primary/[0.06] px-4 py-3">
	<div class="mb-[0.35rem] text-xs font-semibold tracking-[0.08em] text-primary/60 uppercase">
		From this message
	</div>
	<div class="text-base leading-[1.4] font-medium text-foreground">{exchange.prompt.text}</div>
	{#if exchange.response}
		<div class="mt-[0.3rem] text-base leading-[1.4] text-muted-foreground">
			{exchange.response.text.slice(0, 150)}{exchange.response.text.length > 150 ? '…' : ''}
		</div>
	{/if}
</div>
