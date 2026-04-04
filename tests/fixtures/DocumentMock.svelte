<script lang="ts">
	let { children: _children } = $props();

	export function isEditing() {
		return false;
	}

	export function isDirty() {
		return false;
	}

	export function getScrollEl() {
		return null;
	}

	export function enterEditMode() {}
	export function cancelEdit() {}
	export function revertToSaved() {}
	export function saveEdit() {}
	export function downloadMarkdown() {}
</script>
