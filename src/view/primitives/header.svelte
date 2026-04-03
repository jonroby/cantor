<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		class?: string;
		children: Snippet;
	}

	let { class: cls = '', children }: Props = $props();
</script>

<div class="pane-header {cls}">
	{@render children()}
</div>
