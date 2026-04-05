<script lang="ts">
	import { onMount } from 'svelte';
	import { MessageSquare, Layers, Bot, FileText, Plug } from 'lucide-svelte';
	import FlowChat from './flows/FlowChat.svelte';

	function goToApp() {
		window.location.hash = '#/';
	}

	const tabs = [
		{ label: 'Side Chats', icon: MessageSquare },
		{ label: 'Context',    icon: Layers },
		{ label: 'Agents',     icon: Bot },
		{ label: 'Documents',  icon: FileText },
		{ label: 'Providers',  icon: Plug },
	];

	const features = [
		'Side Chats',
		'Multi Streaming',
		'Quick Ask',
		'Delete Nodes',
		'Fork Chats',
	];

	// Duration of each flow in ms — will tighten later
	const FLOW_DURATION = 18000;

	let activeIndex = $state(0);
	let key = $state(0);
	let progress = $state(0); // 0–1

	let rafId: number;
	let startTime: number;

	function startProgress() {
		cancelAnimationFrame(rafId);
		progress = 0;
		startTime = performance.now();
		function tick() {
			const elapsed = performance.now() - startTime;
			progress = Math.min(elapsed / FLOW_DURATION, 1);
			if (progress < 1) rafId = requestAnimationFrame(tick);
		}
		rafId = requestAnimationFrame(tick);
	}

	function advance() {
		activeIndex = (activeIndex + 1) % tabs.length;
		key++;
		startProgress();
	}

	function selectTab(i: number) {
		activeIndex = i;
		key++;
		startProgress();
	}

	onMount(() => {
		startProgress();
		return () => cancelAnimationFrame(rafId);
	});
</script>

<div class="page">

	<!-- Nav — white background, outside dark card -->
	<div class="nav">
		<div class="logo-area">
			<svg width="28" height="32" viewBox="0 0 140 160" xmlns="http://www.w3.org/2000/svg">
				<circle cx="70" cy="25" r="8.5" fill="rgba(23,23,23,0.9)" />
				<circle cx="30" cy="60" r="8.5" fill="rgba(23,23,23,0.55)" />
				<circle cx="70" cy="60" r="8.5" fill="rgba(23,23,23,0.55)" />
				<circle cx="110" cy="60" r="8.5" fill="rgba(23,23,23,0.55)" />
				<circle cx="30" cy="95" r="8.5" fill="rgba(23,23,23,0.25)" />
				<circle cx="70" cy="95" r="8.5" fill="rgba(23,23,23,0.25)" />
				<circle cx="110" cy="95" r="8.5" fill="rgba(23,23,23,0.25)" />
				<circle cx="70" cy="130" r="8.5" fill="rgba(23,23,23,0.1)" />
			</svg>
			<span class="logo-name">Cantor</span>
			<span class="alpha-badge">Alpha</span>
		</div>
		<div class="nav-btns">
			<button class="hero-key-btn">Request a Key</button>
			<button class="hero-start-btn" onclick={goToApp}>
				Get Started
			</button>
		</div>
	</div>

	<!-- Dark card -->
	<div class="dark-card">
		<div class="bg-dots"></div>

		<!-- Hero -->
		<div class="hero">
			<h1 class="tagline">LLMs for <span class="tagline-accent">Power Users</span></h1>
		</div>

		<!-- Content row -->
		<div class="content-row">

			<!-- Left: feature list -->
			<div class="feature-col">
				<p class="feature-label">Power Tools</p>
				<ul class="feature-list">
					{#each features as f, i}
						<li class="feature-item" class:feature-item-active={i === activeIndex % features.length}>{f}</li>
					{/each}
				</ul>
			</div>

	
			<!-- Right: viewport + tabs -->
			<div class="viewport-wrap">
				<div class="viewport">
					{#key key}
						<div style="display:contents; height:100%">
							<FlowChat onComplete={advance} />
						</div>
					{/key}
				</div>

				<!-- Tab bar -->
				<div class="tab-bar">
					<div class="tab-pill">
						{#each tabs as { label, icon }, i}
							{#if i > 0}<span class="tab-divider" class:hidden={activeIndex === i || activeIndex === i - 1}></span>{/if}
							<button
								class="tab"
								class:active={activeIndex === i}
								onclick={() => selectTab(i)}
							>
								{#if activeIndex === i}
									<span class="tab-fill" style="width: {progress * 100}%"></span>
								{/if}
								<span class="tab-icon"><svelte:component this={icon} size={14} /></span>
								<span class="tab-label">{label}</span>
							</button>
						{/each}
					</div>
				</div>
			</div>

			<!-- Right spacer to balance left col -->
			<div class="feature-col"></div>

		</div>
	</div>

</div>

<style>
	.page {
		height: 100vh;
		background: white;
		display: flex;
		flex-direction: column;
		font-family: Inter, system-ui, sans-serif;
		padding: 0;
		box-sizing: border-box;
		overflow: hidden;
	}

	/* ── Nav ──────────────────────────────────────────────── */
	.nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 56px;
		flex-shrink: 0;
		padding: 0 24px;
	}

	.nav-btns {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.logo-area {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.logo-name {
		font-size: 20px;
		font-weight: 600;
		color: rgba(23,23,23,0.88);
		letter-spacing: -0.3px;
	}

	.alpha-badge {
		display: inline-flex;
		align-items: center;
		border: 1px solid hsl(158 75% 42%);
		border-radius: 9999px;
		background: hsl(158 70% 90%);
		padding: 0.1rem 0.45rem;
		font-size: 11px;
		color: hsl(158 80% 25%);
		margin-top: 1px;
	}

	.nav-actions {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.key-btn {
		height: 36px;
		padding: 0 16px;
		background: transparent;
		color: rgba(23,23,23,0.55);
		border: 1px solid rgba(23,23,23,0.15);
		border-radius: 8px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
	}

	.start-btn {
		height: 36px;
		padding: 0 16px;
		background: rgba(23,23,23,0.9);
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
	}

	/* ── Dark card ────────────────────────────────────────── */
	.dark-card {
		position: relative;
		flex: 1;
		background: white;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		padding-top: 50px;
	}

	.bg-dots { display: none; }

	/* ── Hero ─────────────────────────────────────────────── */
	.hero {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding-top: 20px;
		padding-bottom: 12px;
		flex-shrink: 0;
	}

	.tagline {
		font-size: 44px;
		font-weight: 700;
		color: rgba(23,23,23,0.92);
		margin: 0 0 20px;
		letter-spacing: -2px;
		line-height: 1.08;
	}

	.tagline-accent {
		background: linear-gradient(90deg, hsl(158 85% 40%), hsl(175 90% 38%));
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.subline {
		font-size: 15px;
		color: rgba(23,23,23,0.45);
		margin: 0 0 20px;
		font-weight: 400;
	}

	.btn-row {
		display: flex;
		align-items: center;
		gap: 20px;
	}

	.hero-start-btn {
		display: flex;
		align-items: center;
		padding: 7px 16px;
		background: hsl(0 0% 11%);
		color: white;
		border: none;
		border-radius: 999px;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: opacity 0.15s;
		letter-spacing: -0.1px;
	}

	.hero-start-btn:hover { opacity: 0.85; }

	.hero-key-btn {
		display: flex;
		align-items: center;
		padding: 7px 14px;
		background: transparent;
		color: rgba(23,23,23,0.6);
		border: none;
		border-radius: 999px;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
	}

	.hero-key-btn:hover { color: rgba(23,23,23,0.9); }

	/* ── Content row ──────────────────────────────────────── */
	.content-row {
		display: flex;
		flex: 1;
		min-height: 0;
		align-items: center;
		justify-content: center;
		padding: 0 48px 24px;
		gap: 32px;
	}

	/* ── Feature col ──────────────────────────────────────── */
	.feature-col {
		width: 160px;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding-bottom: 80px;
	}

	.feature-label {
		font-size: 11px;
		font-weight: 600;
		color: rgba(23,23,23,0.35);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		margin: 0 0 12px;
	}

	.feature-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.feature-item {
		font-size: 14px;
		font-weight: 500;
		color: rgba(23,23,23,0.25);
		transition: color 0.3s;
	}

	.feature-item-active {
		background: linear-gradient(90deg, hsl(158 85% 40%), hsl(175 90% 38%));
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		font-weight: 600;
	}

	/* ── Viewport ─────────────────────────────────────────── */
	.viewport-wrap {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 0;
		flex: 1;
		max-width: 1150px;
	}

	.viewport {
		width: 100%;
		aspect-ratio: 16 / 9;
		border-radius: 12px;
		overflow: hidden;
		box-shadow:
			0 0 0 1px rgba(23,23,23,0.08),
			0 8px 24px rgba(0,0,0,0.1);
		display: flex;
		flex-direction: column;
	}

	/* ── Tab bar ──────────────────────────────────────────── */
	.tab-bar {
		display: flex;
		justify-content: center;
		padding: 28px 0 28px;
		flex-shrink: 0;
		width: 100%;
	}

	.tab-pill {
		display: flex;
		align-items: center;
		background: white;
		border-radius: 999px;
		padding: 5px;
		gap: 0;
		box-shadow: 0 0 0 1px rgba(23,23,23,0.08), 0 2px 8px rgba(23,23,23,0.06);
	}

	.tab {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
		width: 140px;
		padding: 8px 0;
		border: none;
		border-radius: 999px;
		background: transparent;
		color: rgba(23,23,23,0.45);
		font-size: 13.5px;
		font-weight: 500;
		cursor: pointer;
		white-space: nowrap;
		font-family: inherit;
		overflow: hidden;
		transition: color 0.15s;
	}

	.tab:hover { color: rgba(23,23,23,0.75); }

	.tab.active {
		background: linear-gradient(90deg, hsl(158 85% 28%), hsl(175 85% 28%));
		color: hsl(162 80% 88%);
		box-shadow: 0 0 0 1px hsl(158 75% 42% / 0.4);
	}

	/* Progress fill that sweeps left→right inside active tab */
	.tab-fill {
		position: absolute;
		inset: 0;
		left: 0;
		background: linear-gradient(90deg, hsl(158 85% 36%), hsl(175 85% 36%));
		border-radius: inherit;
		pointer-events: none;
		transition: none;
	}

	.tab-icon {
		position: relative;
		font-size: 14px;
		line-height: 1;
	}

	.tab-label {
		position: relative;
	}

	.tab-divider {
		width: 1px;
		height: 16px;
		background: rgba(23,23,23,0.1);
		flex-shrink: 0;
		transition: opacity 0.15s;
	}

	.tab-divider.hidden {
		opacity: 0;
	}
</style>
