<script lang="ts">
	import * as AlertDialog from '@/view/primitives/shadcn/ui/alert-dialog';

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
		<AlertDialog.Overlay class="fixed inset-0 z-50 bg-black/50" />
		<AlertDialog.Content
			class="fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-lg"
		>
			<AlertDialog.Header>
				<AlertDialog.Title class="text-lg font-semibold">{title}</AlertDialog.Title>
				<AlertDialog.Description class="mt-2 text-sm text-muted-foreground">
					{description}
				</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer class="mt-6 flex justify-end gap-2">
				<AlertDialog.Cancel class="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
					>Cancel</AlertDialog.Cancel
				>
				<AlertDialog.Action
					class="rounded-lg bg-destructive px-4 py-2 text-sm text-destructive-foreground hover:bg-destructive/90"
					onclick={onConfirm}
				>
					Delete
				</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Portal>
</AlertDialog.Root>
