<script lang="ts">
	import { Button } from '@/view/primitives';
	import type * as app from '@/app';

	interface Props {
		targetId: string | null;
		deleteMode: app.chat.DeleteMode;
		hasSideChats: boolean;
		onChangeMode: (mode: app.chat.DeleteMode) => void;
		onConfirm: () => void;
		onCancel: () => void;
	}

	let { targetId, deleteMode, hasSideChats, onChangeMode, onConfirm, onCancel }: Props = $props();
</script>

{#if targetId}
	<button class="modal-scrim" type="button" aria-label="Close delete dialog" onclick={onCancel}
	></button>
	<div class="modal-panel delete-panel">
		<div class="modal-header">
			<h2>Delete exchange</h2>
			<Button class="ghost-button" variant="ghost" size="sm" onclick={onCancel}>Close</Button>
		</div>
		<div class="modal-section">
			<p class="field-label">Choose what should be removed with this exchange.</p>
			<label class="delete-option">
				<input
					type="radio"
					checked={deleteMode === 'exchange'}
					disabled={hasSideChats}
					onchange={() => onChangeMode('exchange')}
				/>
				<span>Delete this exchange only</span>
			</label>
			<label class="delete-option">
				<input
					type="radio"
					checked={deleteMode === 'exchangeAndMainChat'}
					onchange={() => onChangeMode('exchangeAndMainChat')}
				/>
				<span>Delete this exchange and main chat</span>
			</label>
			{#if hasSideChats}
				<label class="delete-option">
					<input
						type="radio"
						checked={deleteMode === 'exchangeAndSideChats'}
						onchange={() => onChangeMode('exchangeAndSideChats')}
					/>
					<span>Delete this exchange and side chats</span>
				</label>
			{/if}
			<div class="modal-actions">
				<Button class="ghost-button" variant="ghost" size="sm" onclick={onCancel}>Cancel</Button>
				<Button class="primary-button" variant="destructive" onclick={onConfirm}
					>Confirm delete</Button
				>
			</div>
		</div>
	</div>
{/if}
