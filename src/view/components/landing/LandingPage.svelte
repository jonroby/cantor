<script lang="ts">
	import { onMount } from 'svelte';
	import { gsap } from 'gsap';
	import { MessageSquare, Zap, Bot, Sliders, FlaskConical } from 'lucide-svelte';
	import FlowChat from './flows/FlowChat.svelte';
	import ModelSelection from './ModelSelection.svelte';
	import ContextControl from './ContextControl.svelte';

	function goToApp() {
		window.location.hash = '#/';
	}

	const powerToolsFlows = [
		{ before: 'Branch ', green: 'side chats',          after: ' off any message.',             feature: 'Side Chats' },
		{ before: 'Stream ', green: 'multiple responses',   after: ' at once.',                     feature: 'Simultaneous Streams' },
		{ before: 'Ask anything with ', green: 'Auto Ask',  after: ' — no context switch.',         feature: 'Auto Ask' },
		{ before: 'Delete any exchange, ', green: 'clean and instant', after: '.',                  feature: 'Delete Exchanges' },
		{ before: 'Fork any conversation ', green: 'from any point',   after: '.',                  feature: 'Fork Chats' },
	];

	const sections = [
		{ label: 'Model Selection',  icon: Zap,          desc: 'Access frontier models, run locally, or connect any Ollama model.' },
		{ label: 'Agent Mode',       icon: Bot,          desc: 'Full agent control, document authoring, and inline visualizations.' },
		{ label: 'Context Control',  icon: Sliders,      desc: 'Token monitor, context window visibility, tool selection, and strategy.' },
		{ label: 'Experimental',     icon: FlaskConical, desc: 'Chat Tree and other features in early development.' },
	];

	const FLOW_DURATION = 18000;

	let typedBefore = $state('LLMs for ');
	let typedGreen  = $state('Power Users');
	let typedAfter  = $state('');
	let flowIndex   = $state(0);
	let key         = $state(0);
	let progress    = $state(0);
	let showVideo   = $state(false);

	let flowChatRef: { pause: () => void; resume: () => void } | null = $state(null);
	let startChapter = $state(0);

	let rafId: number;
	let startTime: number;
	let currentTl: gsap.core.Timeline | null = null;

	function startProgress() {
		cancelAnimationFrame(rafId);
		progress = 0;
		startTime = performance.now();
		function frame() {
			const elapsed = performance.now() - startTime;
			progress = Math.min(elapsed / FLOW_DURATION, 1);
			if (progress < 1) rafId = requestAnimationFrame(frame);
		}
		rafId = requestAnimationFrame(frame);
	}

	function playFlow(before: string, green: string, after: string) {
		if (currentTl) currentTl.kill();
		typedBefore = '';
		typedGreen  = '';
		typedAfter  = '';

		const tl = gsap.timeline();
		currentTl = tl;

		const full = before + green + after;
		const greenStart = before.length;
		const greenEnd   = before.length + green.length;

		tl.to({}, {
			duration: full.length * 0.034,
			ease: 'none',
			onUpdate() {
				const n = Math.floor(this.progress() * full.length);
				typedBefore = full.slice(0, Math.min(n, greenStart));
				typedGreen  = n > greenStart ? full.slice(greenStart, Math.min(n, greenEnd)) : '';
				typedAfter  = n > greenEnd   ? full.slice(greenEnd, n) : '';
			},
			onComplete() {
				typedBefore = before;
				typedGreen  = green;
				typedAfter  = after;
			}
		});

		tl.to({}, { duration: 0.8 });
		tl.set({}, { onComplete: () => { flowChatRef?.resume(); startProgress(); } });
	}

	// Tab index → FlowChat chapter mapping
	const flowChapters = [0, 1, 1, 1, 1];

	function switchFlow(i: number) {
		if (i === flowIndex) return;
		flowChatRef?.pause();
		flowIndex = i;
		startChapter = flowChapters[i];
		key++;
		const f = powerToolsFlows[i];
		playFlow(f.before, f.green, f.after);
	}

	function onVideoComplete() {
		const nextFlow = flowIndex + 1;
		if (nextFlow < powerToolsFlows.length) {
			flowIndex = nextFlow;
			const f = powerToolsFlows[nextFlow];
			playFlow(f.before, f.green, f.after);
		} else {
			flowIndex = 0;
			key++;
			playFlow(powerToolsFlows[0].before, powerToolsFlows[0].green, powerToolsFlows[0].after);
		}
	}

	onMount(() => {
		showVideo = true;
		setTimeout(() => {
			playFlow(powerToolsFlows[0].before, powerToolsFlows[0].green, powerToolsFlows[0].after);
		}, 2000);
		return () => {
			currentTl?.kill();
			cancelAnimationFrame(rafId);
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
			<button class="btn-ghost">Request a Key</button>
			<button class="btn-dark" onclick={goToApp}>Get Started</button>
		</div>
	</nav>

	<!-- ── Hero section (viewport height) ───────────────────── -->
	<section class="hero-section">

		<div class="hero-text">
			<h1 class="tagline">{typedBefore}<span class="tagline-accent">{typedGreen}</span>{typedAfter}</h1>
		</div>

		<div class="viewport-wrap">
			<div class="viewport">
				{#if showVideo}
					{#key key}
						<FlowChat bind:this={flowChatRef} onComplete={onVideoComplete} startChapter={startChapter} />
					{/key}
				{:else}
					<div class="viewport-placeholder"></div>
				{/if}
			</div>
		</div>

		<!-- Tab bar showing Power Tools subsections -->
		<div class="tab-bar">
			<div class="tab-pill">
				{#each powerToolsFlows as f, i}
					{#if i > 0}<span class="tab-divider" class:hidden={flowIndex === i || flowIndex === i - 1}></span>{/if}
					<button class="tab" class:active={flowIndex === i} onclick={() => switchFlow(i)}>
						{#if flowIndex === i}
							<span class="tab-fill" style="width: {progress * 100}%"></span>
						{/if}
						<span class="tab-label">{f.feature}</span>
					</button>
				{/each}
			</div>
		</div>

	</section>

	<!-- ── Feature sections (scroll) ─────────────────────────── -->
	{#each sections as { label, icon, desc }, i}
		{#if label === 'Context Control'}
			<ContextControl />
		{:else if label === 'Model Selection'}
			<ModelSelection />
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

	.nav-btns {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.btn-ghost {
		padding: 7px 14px;
		background: transparent;
		color: rgba(23,23,23,0.6);
		border: none;
		border-radius: 999px;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		font-family: inherit;
	}

	.btn-ghost:hover { color: rgba(23,23,23,0.9); }

	.btn-dark {
		padding: 7px 16px;
		background: hsl(0 0% 11%);
		color: white;
		border: none;
		border-radius: 999px;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		font-family: inherit;
		transition: opacity 0.15s;
	}

	.btn-dark:hover { opacity: 0.85; }

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
		height: 80px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.tagline {
		font-size: 44px;
		font-weight: 700;
		color: rgba(23,23,23,0.92);
		margin: 0;
		letter-spacing: -2px;
		line-height: 1.08;
		text-align: center;
	}

	.tagline-accent {
		background: linear-gradient(90deg, hsl(158 85% 40%), hsl(175 90% 38%));
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
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
			0 0 0 1px rgba(23,23,23,0.08),
			0 8px 24px rgba(0,0,0,0.1);
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
		display: flex;
		align-items: center;
		background: white;
		border-radius: 999px;
		padding: 5px;
		box-shadow: 0 0 0 1px rgba(23,23,23,0.08), 0 2px 8px rgba(23,23,23,0.06);
	}

	.tab {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
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
		overflow: hidden;
		transition: color 0.15s;
	}

	.tab:hover { color: rgba(23,23,23,0.75); }

	.tab.active {
		background: linear-gradient(90deg, hsl(158 85% 28%), hsl(175 85% 28%));
		color: hsl(162 80% 88%);
		box-shadow: 0 0 0 1px hsl(158 75% 42% / 0.4);
	}

	.tab-fill {
		position: absolute;
		inset: 0;
		left: 0;
		background: hsl(162 72% 38%);
		border-radius: 999px 0 0 999px;
		pointer-events: none;
	}

	.tab-label { position: relative; }

	.tab-divider {
		width: 1px;
		height: 16px;
		background: rgba(23,23,23,0.1);
		flex-shrink: 0;
		transition: opacity 0.15s;
	}

	.tab-divider.hidden { opacity: 0; }

	/* ── Feature sections ─────────────────────────────────── */
	.feature-section {
		height: 100vh;
		padding: 0 48px;
		border-top: 1px solid rgba(23,23,23,0.06);
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
		color: rgba(23,23,23,0.9);
		letter-spacing: -0.5px;
		margin: 0 0 12px;
	}

	.feature-section-desc {
		font-size: 15px;
		color: rgba(23,23,23,0.5);
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
			0 0 0 1px rgba(23,23,23,0.08),
			0 4px 16px rgba(0,0,0,0.07);
	}

	.media-placeholder {
		width: 100%;
		aspect-ratio: 16 / 9;
		border-radius: 12px;
		background: hsl(0 0% 95%);
		border: 1px dashed rgba(23,23,23,0.15);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.media-placeholder-text {
		font-size: 14px;
		color: rgba(23,23,23,0.25);
		font-weight: 500;
	}

	/* ── Footer ───────────────────────────────────────────── */
	.footer {
		height: 100vh;
		padding: 0 48px;
		border-top: 1px solid rgba(23,23,23,0.06);
		display: flex;
		align-items: center;
		scroll-snap-align: start;
		flex-shrink: 0;
		box-sizing: border-box;
	}

	.footer-text {
		font-size: 13px;
		color: rgba(23,23,23,0.35);
	}
</style>
