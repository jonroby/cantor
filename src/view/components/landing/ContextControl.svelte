<script lang="ts">
	import { Settings } from 'lucide-svelte';
	import { PROVIDER_LOGOS } from '../../assets/provider-logos';

	let index = $state(0);
	let strategy = $state<'Full' | 'LRU' | 'BM25' | 'Embedding Similarity'>('Full');

	type Tool = { name: string; desc: string; checked: boolean };
	type Group = { name: string; desc: string; tools: Tool[] };

	let toolGroups = $state<Group[]>([
		{
			name: 'Documents',
			desc: 'Create, inspect, edit, rename, move, and delete files and folders.',
			tools: [
				{ name: 'edit_document',        desc: 'Propose a replacement for the currently active document.',       checked: true },
				{ name: 'create_file',          desc: 'Create a file inside a folder.',                                 checked: true },
				{ name: 'create_folder',        desc: 'Create a folder.',                                               checked: true },
				{ name: 'rename_folder',        desc: 'Rename a folder.',                                               checked: true },
				{ name: 'rename_document',      desc: 'Rename a document inside a folder.',                             checked: true },
				{ name: 'delete_folder',        desc: 'Delete a folder and all its contents.',                          checked: true },
				{ name: 'delete_document',      desc: 'Delete a document from a folder.',                               checked: true },
				{ name: 'move_document',        desc: 'Move a document from one folder to another.',                    checked: true },
				{ name: 'read_document',        desc: 'Read the content of a document by folder_id and file_id.',       checked: true },
				{ name: 'add_document_to_chat', desc: 'Add a document into the active chat as a new exchange.',         checked: true },
				{ name: 'open_document',        desc: 'Open a document in the workspace.',                              checked: true },
				{ name: 'open_folder',          desc: 'Open a folder in the workspace.',                                checked: true },
				{ name: 'list_folders',         desc: 'List all folders and files.',                                    checked: true },
				{ name: 'inspect_folder',       desc: 'Inspect a folder and its immediate contents.',                   checked: true },
			],
		},
		{
			name: 'Chats',
			desc: 'Create, inspect, select, rename, and delete chats.',
			tools: [
				{ name: 'create_chat',           desc: 'Create a new chat conversation.',                               checked: true },
				{ name: 'select_chat',           desc: 'Switch to a different chat.',                                   checked: true },
				{ name: 'rename_chat',           desc: 'Rename a chat.',                                                checked: true },
				{ name: 'delete_chat',           desc: 'Delete a chat.',                                                checked: true },
				{ name: 'list_chats',            desc: 'List all chats.',                                               checked: true },
				{ name: 'inspect_active_chat',   desc: 'Inspect the current active chat.',                              checked: true },
				{ name: 'inspect_child_exchanges', desc: 'Inspect child exchanges off an exchange.',                    checked: true },
				{ name: 'delete_exchange',       desc: 'Delete an exchange from the active chat.',                      checked: true },
				{ name: 'promote_exchange',      desc: 'Promote a side-chat exchange into the main chat path.',         checked: true },
			],
		},
		{
			name: 'Workspace',
			desc: 'Inspect workspace context and perform safe workspace actions.',
			tools: [
				{ name: 'inspect_active_document',  desc: 'Inspect the current active document context.',               checked: true },
				{ name: 'inspect_open_documents',   desc: 'Inspect all currently open documents.',                      checked: true },
				{ name: 'inspect_provider_state',   desc: 'Inspect the currently selected model and provider state.',   checked: true },
				{ name: 'inspect_workspace',        desc: 'Inspect high-level workspace context.',                      checked: true },
				{ name: 'inspect_exchange',         desc: 'Inspect an exchange in the active chat by id.',              checked: true },
				{ name: 'select_exchange',          desc: 'Select an exchange in the active chat by id.',               checked: true },
				{ name: 'copy_chat_path',           desc: 'Copy the path to an exchange into a new chat.',              checked: true },
				{ name: 'toggle_sidebar',           desc: 'Toggle the workspace sidebar.',                              checked: true },
				{ name: 'close_panel',              desc: 'Close a workspace panel by index.',                          checked: true },
			],
		},
	]);

	const allChecked = $derived(toolGroups.every(g => g.tools.every(t => t.checked)));

	function toggleAll() {
		const next = !allChecked;
		toolGroups = toolGroups.map(g => ({ ...g, tools: g.tools.map(t => ({ ...t, checked: next })) }));
	}

	function toggleGroup(gi: number) {
		const allOn = toolGroups[gi].tools.every(t => t.checked);
		toolGroups = toolGroups.map((g, i) => i !== gi ? g : {
			...g, tools: g.tools.map(t => ({ ...t, checked: !allOn }))
		});
	}

	function toggleTool(gi: number, ti: number) {
		toolGroups = toolGroups.map((g, i) => i !== gi ? g : {
			...g, tools: g.tools.map((t, j) => j !== ti ? t : { ...t, checked: !t.checked })
		});
	}

	const groupState = $derived(toolGroups.map(g => {
		const on = g.tools.filter(t => t.checked).length;
		return on === 0 ? 'none' : on === g.tools.length ? 'all' : 'partial';
	}));

	const strategyTokens: Record<string, { next: string; total: string }> = {
		'Full':                { next: '84,312', total: '121,847' },
		'LRU':                 { next: '12,640', total: '121,847' },
		'BM25':                { next:  '6,918', total: '121,847' },
		'Embedding Similarity':{ next:  '5,204', total: '121,847' },
	};

	const slides = [
		{
			label: 'Token Monitor',
			desc: 'See exactly how much context you\'re using, live in the composer.',
			hint: '',
		},
		{
			label: 'Context Strategy',
			desc: 'Choose between full history, recency, keyword, or semantic — and watch your estimated context window shrink.',
			hint: '',
		},
		{
			label: 'Agent Tools',
			desc: 'Grant agents only the tools they need — nothing more.',
			hint: '',
		},
	];
</script>

<section class="panel">

	<!-- Title -->
	<div class="title-block">
		<h2 class="heading">Context <span class="accent">Control</span></h2>
		<p class="title-desc">{slides[index].desc}</p>
	</div>

	<!-- Demo -->
	<div class="demo">

		{#if index === 0}
			<div class="composers">
				{#each [
					{ fill: 17,  color: 'hsl(0 0% 20%)',   used: '21,504',  total: '128,000' },
					{ fill: 55,  color: 'hsl(33 95% 48%)', used: '70,401',  total: '128,000' },
					{ fill: 88,  color: 'hsl(4 85% 52%)',  used: '112,691', total: '128,000' },
				] as c}
					<div class="composer">
						<div class="composer-top composer-top-slim">
							<div class="c-plus">+</div>
							<span class="c-placeholder">Chat...</span>
							<div class="c-send">↑</div>
						</div>
						<div class="composer-bottom">
							<div class="c-model-pill">
								<img src={PROVIDER_LOGOS['deepseek']} alt="DeepSeek" class="c-model-logo" />
								<span class="c-model-name">DeepSeek V3</span>
							</div>
							<div class="c-mode-pill">Chat</div>
							<div class="c-divider"></div>
							<div class="c-ctx-row">
								<Settings size={14} />
								<span class="c-ctx-label">Context</span>
								<div class="c-bar-track">
									<div class="c-bar-fill" style="width: {c.fill}%; background: {c.color}"></div>
								</div>
								<span class="c-ctx-nums">{c.used} / {c.total}</span>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		{#if index === 1}
			<div class="strategy-card">
				<div class="sc-header">CONTEXT STRATEGY</div>
				{#each (['Full', 'LRU', 'BM25', 'Embedding Similarity'] as const) as s}
					<button class="sc-item" class:sc-active={strategy === s} onclick={() => strategy = s}>
						<span class="sc-name">{s} {#if strategy === s}<span class="sc-dot">•</span>{/if}</span>
						<span class="sc-desc">
							{#if s === 'Full'}Send the entire conversation history on every request. Most accurate, highest token cost.
							{:else if s === 'LRU'}Keep the most recent exchanges that fit in the context window. Drops older history when the window fills up.
							{:else if s === 'BM25'}Select exchanges most relevant to your current prompt using keyword matching. Useful for long sessions.
							{:else}Use embedding similarity to find the semantically closest exchanges to your current prompt.{/if}
						</span>
					</button>
				{/each}
				<div class="sc-divider"></div>
				<div class="sc-sub">TOKEN USAGE</div>
				<div class="sc-token-row">
					<span>Estimated next context window</span>
					<span class="sc-token-val">{strategyTokens[strategy].next}</span>
				</div>
				<div class="sc-token-row">
					<span>Total session cost</span>
					<span class="sc-token-val">{strategyTokens[strategy].total}</span>
				</div>
			</div>
		{/if}

		{#if index === 2}
			<div class="tools-card">
				<div class="tc-header">
					<span class="tc-title">AGENT TOOLS</span>
					<label class="tc-enable-all">
						<input type="checkbox" checked={allChecked} onchange={toggleAll} />
						<span>Enable all</span>
					</label>
				</div>
				{#each toolGroups as group, gi}
					<div class="tc-group">
						<div class="tc-group-header">
							<input
								type="checkbox"
								checked={groupState[gi] !== 'none'}
								class:tc-partial={groupState[gi] === 'partial'}
								onchange={() => toggleGroup(gi)}
							/>
							<span class="tc-group-name">{group.name}</span>
						</div>
						<p class="tc-group-desc">{group.desc}</p>
						{#each group.tools as t, ti}
							<div class="tc-tool-row">
								<input type="checkbox" checked={t.checked} onchange={() => toggleTool(gi, ti)} />
								<div>
									<span class="tc-tool-name">{t.name}</span>
									<span class="tc-tool-desc">{t.desc}</span>
								</div>
							</div>
						{/each}
					</div>
				{/each}
			</div>
		{/if}

	</div>

	<!-- Tab bar -->
	<div class="tab-bar">
		<div class="tab-pill">
			{#each slides as slide, i}
				{#if i > 0}<span class="tab-sep" class:tab-sep-hidden={index === i || index === i - 1}></span>{/if}
				<button class="tab" class:tab-active={index === i} onclick={() => index = i}>
					<span class="tab-label">{slide.label}</span>
				</button>
			{/each}
		</div>
	</div>

</section>

<style>
	.panel {
		height: 100vh;
		flex-shrink: 0;
		scroll-snap-align: start;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		padding: 80px 48px 48px;
		box-sizing: border-box;
		font-family: Inter, system-ui, sans-serif;
		border-top: 1px solid rgba(23,23,23,0.06);
	}

	/* ── Title ────────────────────────────────────────────── */
	.heading {
		font-size: clamp(36px, 4.5vw, 56px);
		font-weight: 800;
		letter-spacing: -2px;
		color: rgba(23,23,23,0.92);
		margin: 0 0 10px;
		text-align: center;
	}

	.title-block {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.title-desc {
		font-size: 16px;
		color: rgba(23,23,23,0.45);
		margin: 0;
		text-align: center;
		max-width: 560px;
		line-height: 1.6;
	}

	.accent {
		background: linear-gradient(90deg, hsl(158 85% 40%), hsl(175 90% 38%));
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	/* ── Demo area ────────────────────────────────────────── */
	.demo {
		flex: 1;
		width: 100%;
		max-width: 680px;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 0;
		padding: 32px 0;
	}

	/* ── Composers stack ─────────────────────────────────── */
	.composers {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 64px;
	}

	/* ── Composer ─────────────────────────────────────────── */
	.composer {
		width: 100%;
		border: 1px solid hsl(0 0% 88%);
		border-radius: 16px;
		overflow: hidden;
		box-shadow: 0 4px 24px rgba(0,0,0,0.06);
	}

	.composer-top {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 20px;
		border-bottom: 1px solid hsl(0 0% 91%);
	}

	.composer-top-slim {
		padding: 14px 16px;
	}

	.c-plus {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: 1px solid hsl(0 0% 82%);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 18px;
		color: rgba(23,23,23,0.45);
		flex-shrink: 0;
	}

	.c-placeholder { flex: 1; font-size: 16px; color: rgba(23,23,23,0.28); }

	.c-send {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: hsl(0 0% 20%);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 16px;
		flex-shrink: 0;
	}

	.composer-bottom {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 14px 16px;
		background: hsl(0 0% 99%);
	}

	.c-model-pill {
		display: flex;
		align-items: center;
		gap: 5px;
		border: 1px solid hsl(0 0% 85%);
		border-radius: 999px;
		padding: 6px 13px;
		flex-shrink: 0;
	}

	.c-model-logo { width: 14px; height: 14px; object-fit: contain; flex-shrink: 0; }
	.c-model-name { font-size: 13px; color: rgba(23,23,23,0.65); }

	.c-mode-pill {
		border: 1px solid hsl(0 0% 85%);
		border-radius: 999px;
		padding: 6px 14px;
		font-size: 13px;
		font-weight: 600;
		color: rgba(23,23,23,0.75);
		flex-shrink: 0;
	}

	.c-divider { width: 1px; height: 18px; background: hsl(0 0% 87%); flex-shrink: 0; }

	.c-ctx-row {
		display: flex;
		align-items: center;
		gap: 7px;
		flex: 1;
		min-width: 0;
		color: rgba(23,23,23,0.4);
	}

	.c-ctx-label { font-size: 13px; color: rgba(23,23,23,0.4); flex-shrink: 0; }

	.c-bar-track {
		flex: 1;
		height: 3px;
		background: hsl(0 0% 88%);
		border-radius: 999px;
		overflow: hidden;
	}

	.c-bar-fill { height: 100%; background: hsl(0 0% 26%); border-radius: 999px; }

	.c-ctx-nums { font-size: 13px; color: rgba(23,23,23,0.4); white-space: nowrap; flex-shrink: 0; }

	/* ── Strategy card ────────────────────────────────────── */
	.strategy-card {
		width: 100%;
		border: 1px solid hsl(0 0% 88%);
		border-radius: 14px;
		overflow: hidden;
		box-shadow: 0 4px 24px rgba(0,0,0,0.06);
	}

	.sc-header {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.07em;
		color: rgba(23,23,23,0.45);
		padding: 16px 20px 14px;
		border-bottom: 1px solid hsl(0 0% 91%);
	}

	.sc-sub {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.07em;
		color: rgba(23,23,23,0.35);
		padding: 14px 20px 6px;
	}

	.sc-item {
		width: 100%;
		height: 72px;
		padding: 0 20px;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 3px;
		border-bottom: 1px solid hsl(0 0% 94%);
		background: transparent;
		border-left: none;
		border-right: none;
		border-top: none;
		text-align: left;
		cursor: pointer;
		font-family: inherit;
		transition: background 0.12s;
	}

	.sc-item:hover { background: hsl(0 0% 97%); }

	.sc-active { background: hsl(0 0% 96%) !important; }
	.sc-name { font-size: 14px; font-weight: 600; color: rgba(23,23,23,0.85); }
	.sc-dot { color: rgba(23,23,23,0.35); }
	.sc-desc { font-size: 13px; color: rgba(23,23,23,0.48); line-height: 1.5; }
	.sc-divider { height: 1px; background: hsl(0 0% 91%); }

	.sc-token-row {
		display: flex;
		justify-content: space-between;
		padding: 12px 20px;
		font-size: 13px;
		color: rgba(23,23,23,0.48);
	}

	.sc-token-val { font-weight: 600; color: rgba(23,23,23,0.78); }

	/* ── Tools card ───────────────────────────────────────── */
	.tools-card input[type="checkbox"] {
		accent-color: hsl(0 0% 10%);
	}

	.tools-card {
		width: 100%;
		border: 1px solid hsl(0 0% 88%);
		border-radius: 14px;
		overflow-y: auto;
		max-height: 60vh;
		box-shadow: 0 4px 24px rgba(0,0,0,0.06);
	}

	.tc-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px 14px;
		border-bottom: 1px solid hsl(0 0% 91%);
		position: sticky;
		top: 0;
		background: white;
	}

	.tc-title { font-size: 11px; font-weight: 700; letter-spacing: 0.07em; color: rgba(23,23,23,0.45); }

	.tc-enable-all {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		color: rgba(23,23,23,0.45);
		cursor: pointer;
	}

	.tc-group { border-bottom: 1px solid hsl(0 0% 91%); padding: 14px 20px; }

	.tc-group-header { display: flex; align-items: center; gap: 9px; margin-bottom: 3px; }

	.tc-group-name { font-size: 14px; font-weight: 600; color: rgba(23,23,23,0.85); }

	.tc-group-desc { margin: 0 0 10px 25px; font-size: 13px; color: rgba(23,23,23,0.42); line-height: 1.5; }

	.tc-tool-row { display: flex; align-items: flex-start; gap: 9px; padding: 5px 0; }
	.tc-tool-row input { margin-top: 2px; flex-shrink: 0; }

	.tc-tool-name {
		display: block;
		font-size: 13px;
		font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
		color: rgba(23,23,23,0.72);
	}

	.tc-tool-desc { display: block; font-size: 12px; color: rgba(23,23,23,0.38); line-height: 1.4; }

	/* ── Tab bar ──────────────────────────────────────────── */
	.tab-bar {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		padding: 32px 0 8px;
		flex-shrink: 0;
		width: 100%;
	}

	.tab-pill {
		display: flex;
		align-items: center;
		background: white;
		border-radius: 999px;
		padding: 5px;
		box-shadow: 0 0 0 1px rgba(23,23,23,0.08), 0 2px 8px rgba(23,23,23,0.06);
	}

	.tab {
		position: relative;
		padding: 7px 18px;
		border: none;
		border-radius: 999px;
		background: transparent;
		color: rgba(23,23,23,0.45);
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		white-space: nowrap;
		font-family: inherit;
		transition: color 0.15s;
	}

	.tab:hover { color: rgba(23,23,23,0.75); }

	.tab-active {
		background: linear-gradient(90deg, hsl(158 85% 28%), hsl(175 85% 28%));
		color: hsl(162 80% 88%);
		box-shadow: 0 0 0 1px hsl(158 75% 42% / 0.4);
	}

	.tab-sep {
		width: 1px;
		height: 16px;
		background: rgba(23,23,23,0.1);
		flex-shrink: 0;
		transition: opacity 0.15s;
	}

	.tab-sep-hidden { opacity: 0; }

</style>
