<script lang="ts">
	import { onMount } from 'svelte';
	import { gsap } from 'gsap';
	import { MessageSquare, Zap, Bot, Sliders, FlaskConical } from 'lucide-svelte';
	import FlowChat from './flows/FlowChat.svelte';

	function goToApp() {
		window.location.hash = '#/';
	}

	// Each tab has a label and a list of flows.
	// Each flow = { question, feature } — question plays first, then video plays.
	const tabs = [
		{
			label: 'Power Tools', icon: MessageSquare,
			flows: [
				{ before: 'Branch ', green: 'side chats',          after: ' off any message.',             feature: 'Side Chats' },
				{ before: 'Stream ', green: 'multiple responses',   after: ' at once.',                     feature: 'Simultaneous Streams' },
				{ before: 'Ask anything with ', green: 'Auto Ask',  after: ' — no context switch.',         feature: 'Auto Ask' },
				{ before: 'Delete any exchange, ', green: 'clean and instant', after: '.',                  feature: 'Delete Exchanges' },
				{ before: 'Fork any conversation ', green: 'from any point',   after: '.',                  feature: 'Fork Chats' },
			],
		},
		{
			label: 'Model Selection', icon: Zap,
			flows: [
				{ before: 'Access ', green: 'frontier models',             after: ' with one keystroke.',         feature: 'Frontier Labs' },
				{ before: 'Run models ', green: 'locally',                 after: ' — your keys never transmit.', feature: 'Secure & Local' },
				{ before: 'Any ', green: 'Ollama model',                   after: ', plug and play.',             feature: 'Ollama' },
			],
		},
		{
			label: 'Agent Mode', icon: Bot,
			flows: [
				{ before: 'An agent that does ', green: 'whatever you can', after: '.',                           feature: 'Full Agent Control' },
				{ before: 'Create docs, write chapters, ', green: 'add charts', after: '.',                       feature: 'Document Authoring' },
				{ before: 'SVGs and visualizations, ', green: 'generated inline', after: '.',                     feature: 'Charts & SVGs' },
			],
		},
		{
			label: 'Context Control', icon: Sliders,
			flows: [
				{ before: 'Live ', green: 'token usage',                   after: ', always visible.',            feature: 'Token Monitor' },
				{ before: 'See and control ', green: "exactly what's in window", after: '.',                      feature: 'Context Window' },
				{ before: 'Pick exactly ', green: 'which tools',           after: ' your agent can use.',         feature: 'Tool Selection' },
				{ before: 'Choose the ', green: 'context strategy',        after: ' that fits.',                  feature: 'Context Strategy' },
			],
		},
		{
			label: 'Experimental', icon: FlaskConical,
			flows: [
				{ before: 'Your conversation as ', green: 'a visual tree', after: '.',                            feature: 'Chat Tree' },
			],
		},
	];

	// Duration of each video in ms
	const FLOW_DURATION = 18000;

	// Typed text split into segments for rendering
	let typedBefore = $state('');
	let typedGreen  = $state('');
	let typedAfter  = $state('');
	let showCursor  = $state(false);

	let tabIndex = $state(0);   // which tab
	let flowIndex = $state(0);  // which flow within tab
	let key = $state(0);
	let progress = $state(0);
	let showVideo = $state(false);

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
		showCursor  = true;

		const tl = gsap.timeline();
		currentTl = tl;

		const full = before + green + after;
		const greenStart = before.length;
		const greenEnd   = before.length + green.length;

		// Type the full string, splitting into segments as cursor advances
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

		// Hold — text fully visible
		tl.to({}, { duration: 0.8 });

		// Start video — text stays up for the whole flow
		tl.set({}, { onComplete: () => { showVideo = true; key++; startProgress(); showCursor = false; } });
	}

	function onVideoComplete() {
		const tab = tabs[tabIndex];
		const nextFlow = flowIndex + 1;
		if (nextFlow < tab.flows.length) {
			flowIndex = nextFlow;
		} else {
			tabIndex = (tabIndex + 1) % tabs.length;
			flowIndex = 0;
		}
		const f = tabs[tabIndex].flows[flowIndex] as any;
		playFlow(f.before, f.green, f.after);
	}

	function selectTab(i: number) {
		tabIndex = i;
		flowIndex = 0;
		const f = tabs[i].flows[0] as any;
		playFlow(f.before, f.green, f.after);
	}

	onMount(() => {
		const f = tabs[0].flows[0] as any;
		playFlow(f.before, f.green, f.after);
		return () => {
			currentTl?.kill();
			cancelAnimationFrame(rafId);
		};
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
			<h1 class="tagline">{typedBefore}<span class="tagline-accent">{typedGreen}</span>{typedAfter}{#if showCursor}<span class="tagline-cursor">|</span>{/if}</h1>
		</div>

		<!-- Content row -->
		<div class="content-row">

			<!-- Left: feature list -->
			<div class="feature-col">
				<p class="feature-label">{tabs[tabIndex].label}</p>
				<ul class="feature-list">
					{#each tabs[tabIndex].flows as f, i}
						<li class="feature-item" class:feature-item-active={i === flowIndex}>{f.feature}</li>
					{/each}
				</ul>
			</div>

	
			<!-- Right: viewport + tabs -->
			<div class="viewport-wrap">
				<div class="viewport">
					{#if showVideo}
						{#key key}
							<div style="display:contents; height:100%">
								<FlowChat onComplete={onVideoComplete} />
							</div>
						{/key}
					{:else}
						<div class="viewport-placeholder"></div>
					{/if}
				</div>

			</div>

			<!-- Right spacer to balance left col -->
			<div class="feature-col"></div>

		</div>

		<!-- Tab bar — outside content-row, always visible, truly centered -->
		<div class="tab-bar">
			<div class="tab-pill">
				{#each tabs as { label, icon }, i}
					{#if i > 0}<span class="tab-divider" class:hidden={tabIndex === i || tabIndex === i - 1}></span>{/if}
					<button
						class="tab"
						class:active={tabIndex === i}
						onclick={() => selectTab(i)}
					>
						{#if tabIndex === i}
							<span class="tab-fill" style="width: {progress * 100}%"></span>
						{/if}
						<span class="tab-icon"><svelte:component this={icon} size={14} /></span>
						<span class="tab-label">{label}</span>
					</button>
				{/each}
			</div>
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

	/* ── Intro ────────────────────────────────────────────── */
	.viewport-placeholder {
		width: 100%;
		height: 100%;
		background: hsl(0 0% 98%);
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

	.tagline-cursor {
		color: hsl(162 80% 40%);
		animation: blink 0.7s ease infinite;
		margin-left: 1px;
	}

	@keyframes blink {
		0%, 100% { opacity: 1; }
		50% { opacity: 0; }
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
		position: relative;
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

	/* Progress fill sweeps left→right with straight leading edge */
	.tab-fill {
		position: absolute;
		inset: 0;
		left: 0;
		background: hsl(162 72% 38%);
		border-radius: 999px 0 0 999px;
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

	.tab.active .tab-label,
	.tab.active .tab-icon {
		text-shadow: 0 0 8px hsl(158 85% 75% / 0.18);
		filter: drop-shadow(0 0 3px hsl(158 85% 75% / 0.12));
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
