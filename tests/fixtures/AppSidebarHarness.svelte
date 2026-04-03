<script lang="ts">
	import * as Sidebar from '@/view/primitives/shadcn/ui/sidebar/index.js';
	import AppSidebar from '@/view/components/sidebar/AppSidebar.svelte';

	let props = $props();
</script>

<Sidebar.Provider>
	<AppSidebar {...props} />
</Sidebar.Provider>
