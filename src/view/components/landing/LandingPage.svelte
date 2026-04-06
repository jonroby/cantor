<script lang="ts">
	import { onMount } from 'svelte';
	import { gsap } from 'gsap';
	import { MessageSquare, Layers, Bot, FileText, Plug } from 'lucide-svelte';
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
				{ question: 'Multiple questions for a single response?',   feature: 'Side Chats' },
				{ question: 'Side chats that branch from any message?',    feature: 'Multi Streaming' },
				{ question: 'Ask anything without leaving context?',       feature: 'Quick Ask' },
			],
		},
		{
			label: 'Context', icon: Layers,
			flows: [
				{ question: 'Context windows you can actually manage?',    feature: 'Context Window' },
				{ question: 'Choose exactly how your tokens get pruned?',  feature: 'Context Strategy' },
			],
		},
		{
			label: 'Agents', icon: Bot,
			flows: [
				{ question: 'Agents that use only the tools you allow?',   feature: 'Agent Mode' },
				{ question: 'Watch tool calls stream in real time?',        feature: 'Streaming Tools' },
			],
		},
		{
			label: 'Documents', icon: FileText,
			flows: [
				{ question: 'Documents with rendered math and plots?',     feature: 'Rendered Docs' },
				{ question: 'Export any conversation as a file?',           feature: 'Export' },
			],
		},
		{
			label: 'Providers', icon: Plug,
			flows: [
				{ question: 'Providers that never see your keys?',         feature: 'Local Keys' },
				{ question: 'Switch models mid-conversation?',             feature: 'Model Switching' },
			],
		},
	];

	// Duration of each video in ms
	const FLOW_DURATION = 18000;

	let questionText = $state('');
	let showIntro = $state(true);
	let introEl: HTMLElement;

	let tabIndex = $state(0);   // which tab
	let flowIndex = $state(0);  // which flow within tab
	let key = $state(0);
	let progress = $state(0);

	let rafId: number;
	let startTime: number;
	let currentTl: gsap.core.Timeline | null = null;

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

	function playQuestion(question: string, onDone: () => void) {
		if (currentTl) currentTl.kill();
		showIntro = true;
		questionText = '';
		gsap.set(introEl, { opacity: 1, y: 0 });
		const tl = gsap.timeline();
		currentTl = tl;

		tl.to({}, {
			duration: question.length * 0.038,
			ease: 'none',
			onUpdate() {
				questionText = question.slice(0, Math.floor(this.progress() * question.length));
			}
		});
		tl.to({}, { duration: 0.8 });
		tl.to(introEl, { opacity: 0, y: -16, duration: 0.35, ease: 'power2.in' });
		tl.set({}, { onComplete: () => { showIntro = false; questionText = ''; } });
		tl.call(onDone);
	}

	// Called when a video finishes
	function onVideoComplete() {
		const tab = tabs[tabIndex];
		const nextFlow = flowIndex + 1;
		if (nextFlow < tab.flows.length) {
			// Next flow in same tab
			flowIndex = nextFlow;
			playQuestion(tab.flows[flowIndex].question, () => { key++; startProgress(); });
		} else {
			// Advance to next tab, first flow
			tabIndex = (tabIndex + 1) % tabs.length;
			flowIndex = 0;
			playQuestion(tabs[tabIndex].flows[0].question, () => { key++; startProgress(); });
		}
	}

	function selectTab(i: number) {
		tabIndex = i;
		flowIndex = 0;
		playQuestion(tabs[i].flows[0].question, () => { key++; startProgress(); });
	}

	onMount(() => {
		playQuestion(tabs[0].flows[0].question, () => { key++; startProgress(); });
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
			<h1 class="tagline">LLMs for <span class="tagline-accent">Power Users</span></h1>
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
					{#if showIntro}
						<!-- Blank placeholder keeps viewport sized; intro overlays on top -->
						<div class="viewport-placeholder"></div>
						<div class="intro-wrap" bind:this={introEl}>
							<p class="intro-question">
								{questionText}<span class="intro-cursor">|</span>
							</p>
						</div>
					{:else}
						{#key key}
							<div style="display:contents; height:100%">
								<FlowChat onComplete={onVideoComplete} />
							</div>
						{/key}
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

	.intro-wrap {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: hsl(0 0% 98%);
		z-index: 10;
		border-radius: 12px;
	}

	.intro-question {
		font-size: 28px;
		font-weight: 600;
		letter-spacing: -0.5px;
		color: rgba(23,23,23,0.88);
		margin: 0;
		max-width: 640px;
		text-align: center;
		background: linear-gradient(90deg, hsl(158 85% 40%), hsl(175 90% 38%));
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.intro-cursor {
		-webkit-text-fill-color: hsl(158 85% 50%);
		animation: blink 0.7s ease infinite;
	}

	@keyframes blink {
		0%, 100% { opacity: 1; }
		50% { opacity: 0; }
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
