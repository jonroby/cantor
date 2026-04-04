<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		class?: string;
		children: Snippet;
	}

	let { class: cls = '', children }: Props = $props();
</script>

<div class="header {cls}">
	<div class="header-inner">
		{@render children()}
	</div>
</div>

<style>
	.header {
		height: 52px;
		box-sizing: border-box;
		padding: 0 var(--pane-padding-h);
		flex-shrink: 0;
		background: hsl(var(--background) / 0.97);
		font-size: var(--text-sm);
		font-weight: var(--font-weight-normal);
		color: hsl(var(--muted-foreground));
		letter-spacing: 0.02em;
	}

	.header-inner {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 100%;
		max-width: var(--pane-content-width);
		margin: 0 auto;
		border-bottom: 1px solid var(--border-color);
	}
</style>
