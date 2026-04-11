<script lang="ts">
	import * as AlertDialog from '@/view/primitives/alert-dialog';

	interface Props {
		open: boolean;
		title: string;
		description: string;
		onConfirm: () => void;
		onCancel: () => void;
	}

	let { open, title, description, onConfirm, onCancel }: Props = $props();
</script>

<AlertDialog.Root
	{open}
	onOpenChange={(o) => {
		if (!o) onCancel();
	}}
>
	<AlertDialog.Portal>
		<AlertDialog.Overlay class="confirm-delete-overlay" />
		<AlertDialog.Content class="confirm-delete-content">
			<AlertDialog.Header>
				<AlertDialog.Title class="confirm-delete-title">{title}</AlertDialog.Title>
				<AlertDialog.Description class="confirm-delete-description">
					{description}
				</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer class="confirm-delete-footer">
				<AlertDialog.Cancel class="confirm-delete-cancel">Cancel</AlertDialog.Cancel>
				<AlertDialog.Action class="confirm-delete-action" onclick={onConfirm}>
					Delete
				</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Portal>
</AlertDialog.Root>

<style>
	:global(.confirm-delete-overlay) {
		position: fixed;
		inset: 0;
		z-index: 50;
		background: var(--surface-overlay-strong);
		backdrop-filter: blur(var(--surface-overlay-blur));
	}

	:global(.confirm-delete-content) {
		position: fixed;
		top: 50%;
		left: 50%;
		z-index: 50;
		width: min(100%, 28rem);
		padding: 1.5rem;
		border: 1px solid var(--border-color);
		border-radius: 0.75rem;
		background: var(--surface-floating);
		box-shadow: var(--surface-floating-shadow);
		transform: translate(-50%, -50%);
	}

	:global(.confirm-delete-title) {
		font-weight: var(--font-weight-semibold);
	}

	:global(.confirm-delete-description) {
		margin-top: 0.5rem;
		color: hsl(var(--muted-foreground));
	}

	:global(.confirm-delete-footer) {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 1.5rem;
	}

	:global(.confirm-delete-cancel),
	:global(.confirm-delete-action) {
		padding: 0.5rem 1rem;
		border: 1px solid transparent;
		border-radius: 0.5rem;
		outline: none;
	}

	:global(.confirm-delete-cancel) {
		border: 1px solid var(--border-color);
		background: hsl(var(--background));
		color: hsl(var(--foreground));
	}

	:global(.confirm-delete-cancel:hover) {
		background: var(--surface-tint);
	}

	:global(.confirm-delete-action) {
		background: hsl(var(--destructive));
		color: hsl(var(--destructive-foreground));
	}

	:global(.confirm-delete-action:hover) {
		background: hsl(var(--destructive) / 0.92);
	}

	:global(.confirm-delete-cancel:focus-visible),
	:global(.confirm-delete-action:focus-visible) {
		box-shadow: 0 0 0 2px var(--focus-ring-color);
	}
</style>
