<script lang="ts">
	import * as AlertDialog from '@/components/ui/alert-dialog/index.js';

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
		<AlertDialog.Overlay class="inset-0 bg-black/50 fixed z-50" />
		<AlertDialog.Content
			class="max-w-md rounded-xl bg-background p-6 shadow-lg fixed top-1/2 left-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2 border"
		>
			<AlertDialog.Header>
				<AlertDialog.Title class="text-lg font-semibold">{title}</AlertDialog.Title>
				<AlertDialog.Description class="text-sm text-muted-foreground mt-2">
					{description}
				</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer class="mt-6 gap-2 flex justify-end">
				<AlertDialog.Cancel class="rounded-lg px-4 py-2 text-sm hover:bg-muted border"
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
