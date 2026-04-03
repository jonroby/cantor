<script lang="ts">
	import * as Sidebar from '@/view/primitives/sidebar';
	import AppSidebar from '@/view/components/sidebar/AppSidebar.svelte';

	let props = $props();
</script>

<Sidebar.Provider>
	<AppSidebar {...props} />
</Sidebar.Provider>
