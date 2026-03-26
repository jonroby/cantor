<script lang="ts">
	import Button from '@/components/custom/button.svelte';
	import * as Tooltip from '@/components/shadcn/ui/tooltip/index.js';

	interface Props {
		onSearch: () => void;
		onFitView: () => void;
		onGoToTop: () => void;
		onGoToActive: () => void;
		onDownload: () => void;
	}

	let { onSearch, onFitView, onGoToTop, onGoToActive, onDownload }: Props = $props();
</script>

<div class="floating-actions">
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					class="floating-button"
					variant="outline"
					size="icon"
					onclick={onSearch}
					ariaLabel="Search"
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						><circle cx="6.5" cy="6.5" r="4" /><path
							d="M11 11l2.5 2.5"
							stroke-linecap="round"
						/></svg
					>
				</Button>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content side="left" class="bg-neutral-900 text-white text-xs border-none"
			>Search</Tooltip.Content
		>
	</Tooltip.Root>
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					class="floating-button"
					variant="outline"
					size="icon"
					onclick={onFitView}
					ariaLabel="Fit view"
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						><rect x="3" y="3" width="10" height="10" rx="1.5" /><path
							d="M6 6h4M6 8h4M6 10h2"
							stroke-linecap="round"
						/></svg
					>
				</Button>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content side="left" class="bg-neutral-900 text-white text-xs border-none"
			>Fit view</Tooltip.Content
		>
	</Tooltip.Root>
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					class="floating-button"
					variant="outline"
					size="icon"
					onclick={onGoToTop}
					ariaLabel="Go to top"
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						><path
							d="M8 12V4M8 4 5.5 6.5M8 4l2.5 2.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						/></svg
					>
				</Button>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content side="left" class="bg-neutral-900 text-white text-xs border-none"
			>Go to top</Tooltip.Content
		>
	</Tooltip.Root>
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					class="floating-button"
					variant="outline"
					size="icon"
					onclick={onGoToActive}
					ariaLabel="Go to active"
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						><circle cx="8" cy="8" r="5" /><circle
							cx="8"
							cy="8"
							r="1.5"
							fill="currentColor"
							stroke="none"
						/></svg
					>
				</Button>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content side="left" class="bg-neutral-900 text-white text-xs border-none"
			>Go to active</Tooltip.Content
		>
	</Tooltip.Root>
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					class="floating-button"
					variant="outline"
					size="icon"
					onclick={onDownload}
					ariaLabel="Download chat"
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						><path
							d="M3 13h10M8 3v7M5 7l3 3 3-3"
							stroke-linecap="round"
							stroke-linejoin="round"
						/></svg
					>
				</Button>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content side="left" class="bg-neutral-900 text-white text-xs border-none"
			>Download chat</Tooltip.Content
		>
	</Tooltip.Root>
</div>
