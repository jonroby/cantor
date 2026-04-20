<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { Zap, Bot, Sliders, FlaskConical, ArrowRight } from 'lucide-svelte';
	import githubLogo from '@/view/assets/github.svg';
	import { navigate } from '@/view/routes/router.svelte';
	import ChapterSideChats from './flows/ChapterSideChats.svelte';
	import ChapterAutoAsk from './flows/ChapterAutoAsk.svelte';
	import ChapterDeleteExchanges from './flows/ChapterDeleteExchanges.svelte';
	import ChapterForkChats from './flows/ChapterForkChats.svelte';
	import ModelSelection from './ModelSelection.svelte';
	import ContextControl from './ContextControl.svelte';
	import Experimental from './Experimental.svelte';
	import AgentMode from './AgentMode.svelte';

	function goToApp() {
		navigate('chat');
	}

	const powerToolsFlows = [
		{ before: 'Branch ', green: 'side chats', after: ' off any message.', feature: 'Side Chats' },
		// { before: 'Stream ', green: 'multiple responses',   after: ' at once.',                     feature: 'Simultaneous Streams' },
		{
			before: 'Ask anything with ',
			green: 'Quick Ask',
			after: ' — no context switch.',
			feature: 'Quick Ask'
		},
		{
			before: 'Delete any exchange, ',
			green: 'clean and instant',
			after: '.',
			feature: 'Delete Exchanges'
		},
		{ before: 'Fork any conversation ', green: 'from any point', after: '.', feature: 'Fork Chats' }
	];

	const sections = [
		{
			label: 'Model Selection',
			icon: Zap,
			desc: 'Access frontier models, run locally, or connect any Ollama model.'
		},
		{
			label: 'Agent Mode',
			icon: Bot,
			desc: 'Let an agent work with your documents and data.'
		},
		{
			label: 'Context Control',
			icon: Sliders,
			desc: 'Token monitor, context window visibility, tool selection, and strategy.'
		},
		{
			label: 'Experimental',
			icon: FlaskConical,
			desc: 'Try out the Chat Tree and other features in early development.'
		}
	];

	const flowComponents = [
		ChapterSideChats,
		ChapterAutoAsk,
		ChapterDeleteExchanges,
		ChapterForkChats
	] as const;

	let flowIndex = $state(0);
	let key = $state(0);
	let showVideo = $state(false);
	let flowRunId = $state(0);
	let activeTabStyle = $state('opacity: 0;');
	const ActiveFlow = $derived(flowComponents[flowIndex]);
	const CHAPTER_TRANSITION_DELAY_MS = 1250;

	let initialTaglineTimeout: number | null = null;
	let pendingFlowAdvanceTimeout: number | null = null;
	let tabPillEl: HTMLElement;

	function clearPendingFlowAdvance() {
		if (pendingFlowAdvanceTimeout === null) return;
		window.clearTimeout(pendingFlowAdvanceTimeout);
		pendingFlowAdvanceTimeout = null;
	}

	async function updateActiveTabIndicator() {
		await tick();
		const activeTab = tabPillEl?.querySelector<HTMLElement>(`[data-flow-index="${flowIndex}"]`);
		if (!tabPillEl || !activeTab) {
			activeTabStyle = 'opacity: 0;';
			return;
		}

		activeTabStyle = `width: ${activeTab.offsetWidth}px; transform: translateX(${activeTab.offsetLeft}px); opacity: 1;`;
	}

	function switchFlow(i: number) {
		clearPendingFlowAdvance();
		if (i === flowIndex) return;
		flowIndex = i;
		key++;
		flowRunId++;
		void updateActiveTabIndicator();
	}

	function handleFlowComplete(runId: number) {
		if (runId !== flowRunId) return;
		clearPendingFlowAdvance();
		pendingFlowAdvanceTimeout = window.setTimeout(() => {
			pendingFlowAdvanceTimeout = null;
			if (runId !== flowRunId) return;
			switchFlow((flowIndex + 1) % powerToolsFlows.length);
		}, CHAPTER_TRANSITION_DELAY_MS);
	}

	onMount(() => {
		showVideo = true;
		void updateActiveTabIndicator();

		const resizeObserver = new ResizeObserver(() => {
			void updateActiveTabIndicator();
		});
		if (tabPillEl) resizeObserver.observe(tabPillEl);

		initialTaglineTimeout = window.setTimeout(() => {
			initialTaglineTimeout = null;
		}, 2000);
		return () => {
			if (initialTaglineTimeout !== null) window.clearTimeout(initialTaglineTimeout);
			clearPendingFlowAdvance();
			resizeObserver.disconnect();
		};
	});
</script>

<div class="page">
	<!-- Sticky nav -->
	<nav class="nav">
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
			<!-- <button class="btn-ghost">Request a Key</button> -->
			<a
				class="github-link"
				href="https://github.com/jonroby/cantor"
				target="_blank"
				rel="noopener noreferrer"
				aria-label="View Cantor on GitHub"
			>
				<img src={githubLogo} alt="" class="github-logo" />
			</a>
			<button class="btn-dark" onclick={goToApp}>
				Get Started
				<span class="btn-arrow"><ArrowRight size={12} /></span>
			</button>
		</div>
	</nav>

	<!-- ── Hero section (viewport height) ───────────────────── -->
	<section class="hero-section">
		<div class="hero-text">
			<h1 class="tagline">An AI Assistant for <span class="tagline-accent">Power Users</span></h1>
		</div>

		<div class="viewport-wrap">
			<div class="viewport">
				{#if showVideo}
					{#key key}
						<ActiveFlow onComplete={() => handleFlowComplete(flowRunId)} />
					{/key}
				{:else}
					<div class="viewport-placeholder"></div>
				{/if}
			</div>
		</div>

		<!-- Tab bar showing Power Tools subsections -->
		<div class="tab-bar">
			<div class="tab-pill" bind:this={tabPillEl}>
				<span class="tab-active-pill" style={activeTabStyle}></span>
				{#each powerToolsFlows as f, i (f.feature)}
					{#if i > 0}<span class="tab-divider" class:hidden={flowIndex === i || flowIndex === i - 1}
						></span>{/if}
					<div class="tab" class:active={flowIndex === i} data-flow-index={i}>
						<span class="tab-label">{f.feature}</span>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- ── Feature sections (scroll) ─────────────────────────── -->
	{#each sections as { label, icon, desc }, i (label)}
		{#if label === 'Context Control'}
			<ContextControl />
		{:else if label === 'Model Selection'}
			<ModelSelection />
		{:else if label === 'Agent Mode'}
			<AgentMode />
		{:else if label === 'Experimental'}
			<Experimental />
		{:else}
			<section class="feature-section" class:feature-section-alt={i % 2 === 1}>
				<div class="feature-section-inner">
					<div class="feature-section-label">
						<div class="feature-section-icon">
							<svelte:component this={icon} size={20} />
						</div>
						<h2 class="feature-section-title">{label}</h2>
						<p class="feature-section-desc">{desc}</p>
					</div>
					<div class="feature-section-media">
						<div class="media-placeholder">
							<span class="media-placeholder-text">{label}</span>
						</div>
					</div>
				</div>
			</section>
		{/if}
	{/each}

	<!-- Footer -->
	<footer class="footer">
		<span class="footer-text">© 2026 Cantor</span>
	</footer>
</div>

<style>
	.page {
		height: 100vh;
		overflow-y: scroll;
		overflow-x: clip;
		scroll-snap-type: y mandatory;
		background: white;
		display: flex;
		flex-direction: column;
		font-family: Inter, system-ui, sans-serif;
	}

	/* ── Nav ──────────────────────────────────────────────── */
	.nav {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 100;
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 56px;
		padding: 0 24px;
		background: white;
		border-bottom: none;
	}

	.logo-area {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.logo-name {
		font-size: 20px;
		font-weight: 600;
		color: rgba(23, 23, 23, 0.88);
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

	.nav-btns {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.btn-ghost {
		padding: 7px 14px;
		background: transparent;
		color: rgba(23, 23, 23, 0.6);
		border: none;
		border-radius: 999px;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		font-family: inherit;
	}

	.btn-ghost:hover {
		color: rgba(23, 23, 23, 0.9);
	}

	.github-link {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 999px;
		opacity: 0.82;
		transition:
			opacity 0.15s,
			background 0.15s;
	}

	.github-link:hover {
		opacity: 1;
		background: rgba(23, 23, 23, 0.06);
	}

	.github-logo {
		width: 28px;
		height: 28px;
		display: block;
	}

	.btn-dark {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 7px 8px 7px 16px;
		background: hsl(0 0% 11%);
		color: white;
		border: none;
		border-radius: 999px;
		font-size: 13px;
		font-weight: 400;
		cursor: pointer;
		font-family: inherit;
		transition: opacity 0.15s;
	}

	.btn-dark:hover {
		opacity: 0.85;
	}

	.btn-arrow {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: hsl(0 0% 11%);
		border: 1px solid white;
		color: white;
		flex-shrink: 0;
	}

	.btn-arrow :global(svg) {
		stroke: white;
	}

	/* ── Hero section ─────────────────────────────────────── */
	.hero-section {
		display: flex;
		flex-direction: column;
		align-items: center;
		height: 100vh;
		padding: calc(56px + 48px) 48px 0;
		box-sizing: border-box;
		scroll-snap-align: start;
		flex-shrink: 0;
	}

	.hero-text {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.tagline {
		font-size: 56px;
		font-weight: 800;
		color: rgba(23, 23, 23, 0.92);
		margin: 0;
		letter-spacing: -0.06em;
		line-height: 1.1;
		text-align: center;
	}

	.tagline-accent {
		background: linear-gradient(90deg, hsl(156 78% 42%), hsl(177 82% 40%));
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		padding-right: 0.1em;
		margin-right: -0.1em;
	}

	/* ── Viewport ─────────────────────────────────────────── */
	.viewport-wrap {
		width: 100%;
		max-width: 1100px;
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding-bottom: 8px;
	}

	.viewport {
		width: 100%;
		aspect-ratio: 16 / 9;
		border-radius: 12px;
		overflow: hidden;
		box-shadow:
			0 0 0 1px rgba(23, 23, 23, 0.08),
			0 8px 24px rgba(0, 0, 0, 0.1);
	}

	.viewport-placeholder {
		width: 100%;
		height: 100%;
		background: hsl(0 0% 98%);
	}

	/* ── Tab bar ──────────────────────────────────────────── */
	.tab-bar {
		display: flex;
		justify-content: center;
		padding: 20px 0 28px;
		flex-shrink: 0;
		width: 100%;
	}

	.tab-pill {
		position: relative;
		display: flex;
		align-items: center;
		background: white;
		border-radius: 999px;
		padding: 5px;
		box-shadow:
			0 0 0 1px rgba(23, 23, 23, 0.08),
			0 2px 8px rgba(23, 23, 23, 0.06);
	}

	.tab-active-pill {
		position: absolute;
		top: 5px;
		left: 0;
		bottom: 5px;
		border-radius: 999px;
		background: linear-gradient(90deg, hsl(158 85% 28%), hsl(175 85% 28%));
		box-shadow: 0 0 0 1px hsl(158 75% 42% / 0.4);
		pointer-events: none;
		transition:
			transform 0.3s cubic-bezier(0.22, 1, 0.36, 1),
			width 0.3s cubic-bezier(0.22, 1, 0.36, 1),
			opacity 0.15s ease;
	}

	.tab {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 7px 18px;
		border-radius: 999px;
		background: transparent;
		color: rgba(23, 23, 23, 0.45);
		font-size: 13px;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		transition: color 0.15s;
	}

	.tab.active {
		color: hsl(162 80% 88%);
	}

	.tab-label {
		position: relative;
	}

	.tab-divider {
		width: 1px;
		height: 16px;
		background: rgba(23, 23, 23, 0.1);
		flex-shrink: 0;
		transition: opacity 0.15s;
	}

	.tab-divider.hidden {
		opacity: 0;
	}

	/* ── Feature sections ─────────────────────────────────── */
	.feature-section {
		height: 100vh;
		padding: 0 48px;
		border-top: 1px solid rgba(23, 23, 23, 0.06);
		display: flex;
		align-items: center;
		scroll-snap-align: start;
		flex-shrink: 0;
		box-sizing: border-box;
	}

	.feature-section-alt {
		background: hsl(0 0% 98.5%);
	}

	.feature-section-inner {
		max-width: 1100px;
		margin: 0 auto;
		display: flex;
		align-items: center;
		gap: 64px;
	}

	.feature-section-label {
		flex: 0 0 280px;
	}

	.feature-section-icon {
		width: 40px;
		height: 40px;
		border-radius: 10px;
		background: hsl(158 60% 94%);
		color: hsl(158 75% 35%);
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 16px;
	}

	.feature-section-title {
		font-size: 26px;
		font-weight: 700;
		color: rgba(23, 23, 23, 0.9);
		letter-spacing: -0.5px;
		margin: 0 0 12px;
	}

	.feature-section-desc {
		font-size: 15px;
		color: rgba(23, 23, 23, 0.5);
		line-height: 1.6;
		margin: 0;
	}

	.feature-section-media {
		flex: 1;
		min-width: 0;
	}

	.media-component {
		width: 100%;
		aspect-ratio: 16 / 9;
		border-radius: 12px;
		overflow: hidden;
		box-shadow:
			0 0 0 1px rgba(23, 23, 23, 0.08),
			0 4px 16px rgba(0, 0, 0, 0.07);
	}

	.media-placeholder {
		width: 100%;
		aspect-ratio: 16 / 9;
		border-radius: 12px;
		background: hsl(0 0% 95%);
		border: 1px dashed rgba(23, 23, 23, 0.15);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.media-placeholder-text {
		font-size: 14px;
		color: rgba(23, 23, 23, 0.25);
		font-weight: 500;
	}

	/* ── Footer ───────────────────────────────────────────── */
	.footer {
		padding: 24px 48px;
		border-top: 1px solid rgba(23, 23, 23, 0.06);
		display: flex;
		align-items: center;
		flex-shrink: 0;
		box-sizing: border-box;
	}

	.footer-text {
		font-size: 13px;
		color: rgba(23, 23, 23, 0.35);
	}
</style>
