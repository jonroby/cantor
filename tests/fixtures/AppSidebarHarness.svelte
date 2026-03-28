<script lang="ts">
	import * as Sidebar from '@/view/components/shadcn/ui/sidebar/index.js';
	import AppSidebar from '@/view/shared/AppSidebar.svelte';

	let props = $props();
</script>

<Sidebar.Provider>
	<AppSidebar {...props} />
</Sidebar.Provider>
