<script lang="ts">
	interface Props {
		visible: boolean;
		chatName: string;
	}

	let { visible, chatName }: Props = $props();
</script>

<div class="chat-header" class:chat-header-hidden={!visible}>
	<div class="chat-header-label">
		{chatName}
	</div>
</div>
