<script lang="ts">
	let { chats, onNewChat } = $props();
</script>

<div data-testid="app-sidebar-mock">
	<span>{chats.length}</span>
	<button onclick={onNewChat}>Mock new chat</button>
</div>
