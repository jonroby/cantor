<script lang="ts">
	import { onMount } from 'svelte';
	import { gsap } from 'gsap';
	import { Plus, Split, X, ChevronLeft, ChevronRight, GitFork, Trash2 } from 'lucide-svelte';

	interface Props {
		onComplete: () => void;
		startChapter?: number;
	}

	const { onComplete, startChapter = 0 }: Props = $props();

	const prompt1 = 'How does attention work in transformers?';
	const response1Lines = [
		'Attention lets the model weigh how relevant each token is to every',
		'other token in the sequence.',
		'',
		'For each position it computes a <strong>query</strong>, <strong>key</strong>, and <strong>value</strong>. The query',
		'is matched against all keys to produce scores, softmaxed into',
		'weights that sum the values into the final output.'
	];

	const prompt2 = 'Can you give a concrete example?';
	const response2Lines = [
		'Sure. Take the sentence "The cat sat on the mat".',
		'For the token "sat", the model computes attention scores',
		'across all tokens…'
	];

	const sideChats = [
		{
			prompt: 'What is a query?',
			lines: ['The <strong>query</strong> vector represents what the current token is "looking for" — it scores relevance against all keys in the sequence.']
		},
		{
			prompt: 'What is a key?',
			lines: ['The <strong>key</strong> vector represents what each token "offers". A high dot-product between a query and a key means strong attention.']
		},
		{
			prompt: 'What is a value?',
			lines: ['The <strong>value</strong> vector is the content retrieved. Attention weights are applied to the values and summed to produce the final output.']
		},
	];

	let composerText    = $state('');
	let sideComposerText = $state('');
	let sideCounter     = $state('1 / 1');
	let sideBadgeCount  = $state(0);
	let activeSide      = $state(0);
	let sideOpen        = $state(false);
	let sideCount       = $state(0);
	let sideResponded   = $state([false, false, false]);

	let frameEl: HTMLElement;
	let sidePanelEl: HTMLElement;
	let tl: gsap.core.Timeline;

	export function pause()  { tl?.pause();  }
	export function resume() { tl?.resume(); }

	function pulse(tl: gsap.core.Timeline, targetId: string) {
		tl.call(() => {
			const frame = frameEl.getBoundingClientRect();
			const target = document.getElementById(targetId)?.getBoundingClientRect();
			if (!target) return;
			const ring = document.createElement('div');
			ring.style.cssText = `
				position: absolute;
				left: ${target.left - frame.left + target.width / 2}px;
				top: ${target.top - frame.top + target.height / 2}px;
				width: 0; height: 0;
				border-radius: 50%;
				background: rgba(16, 185, 129, 0.55);
				box-shadow: 0 0 0 0 rgba(16, 185, 129, 1);
				transform: translate(-50%, -50%);
				pointer-events: none;
				z-index: 200;
			`;
			frameEl.appendChild(ring);
			gsap.to(ring, {
				width: 72, height: 72,
				opacity: 0,
				boxShadow: '0 0 0 28px rgba(16,185,129,0)',
				duration: 0.85,
				ease: 'power2.out',
				onComplete: () => ring.remove()
			});
		});
		tl.to({}, { duration: 0.5 });
	}

	function typeInto(tl: gsap.core.Timeline, setter: (s: string) => void, text: string, cps = 0.042) {
		tl.to({}, {
			duration: text.length * cps,
			ease: 'none',
			onUpdate() {
				const chars = Math.floor(this.progress() * text.length);
				setter(text.slice(0, chars));
			}
		});
	}

	onMount(() => {
		tl = gsap.timeline({ paused: true });

		// Brief pause before animation begins
		tl.to({}, { duration: 1.2 });

		// ── Click side chat button on exchange 2 ──────────────
		pulse(tl, 'side-badge');

		// Side panel slides open
		tl.to(sidePanelEl, { width: '50%', opacity: 1, duration: 0.4, ease: 'power3.inOut' });
		tl.set({}, { onComplete: () => { sideOpen = true; sideCount = 1; } });
		tl.to({}, { duration: 0.4 });

		// ── Side chat 1: "What is a query?" ──────────────────
		typeInto(tl, s => { sideComposerText = s; }, sideChats[0].prompt, 0.05);
		tl.to({}, { duration: 0.2 });
		pulse(tl, 'composer-send');
		tl.fromTo('#side-bubble-0', { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.18, ease: 'power2.out' });
		tl.set({}, { onComplete: () => {
			sideComposerText = '';
			sideBadgeCount = 1;
			sideCounter = '1 / 1';
			activeSide = 0;
		}});
		tl.to({}, { duration: 0.3 });

		sideChats[0].lines.forEach((_, li) => {
			tl.fromTo(`#side-r0-${li}`, { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 0.16, ease: 'power1.out' }, '<+0.18');
		});
		tl.set({}, { onComplete: () => { sideResponded = [true, false, false]; } });
		tl.to({}, { duration: 0.8 });

		// ── Side chat 2: "What is a value?" ──────────────────
		// Click the + button to open a new side chat
		pulse(tl, 'side-plus-btn');
		tl.set({}, { onComplete: () => { sideCount = 2; activeSide = 1; sideCounter = '2 / 2'; } });
		tl.to({}, { duration: 0.3 });

		typeInto(tl, s => { sideComposerText = s; }, sideChats[1].prompt, 0.05);
		tl.to({}, { duration: 0.2 });
		pulse(tl, 'composer-send');
		tl.fromTo('#side-bubble-1', { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.18, ease: 'power2.out' });
		tl.set({}, { onComplete: () => {
			sideComposerText = '';
			sideBadgeCount = 2;
		}});
		tl.to({}, { duration: 0.3 });

		sideChats[1].lines.forEach((_, li) => {
			tl.fromTo(`#side-r1-${li}`, { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 0.16, ease: 'power1.out' }, '<+0.18');
		});
		tl.set({}, { onComplete: () => { sideResponded = [true, true, false]; } });
		tl.to({}, { duration: 0.8 });

		// ── Side chat 3: "What is a key?" ────────────────────
		// Click the + button again
		pulse(tl, 'side-plus-btn');
		tl.set({}, { onComplete: () => { sideCount = 3; activeSide = 2; sideCounter = '3 / 3'; } });
		tl.to({}, { duration: 0.3 });

		typeInto(tl, s => { sideComposerText = s; }, sideChats[2].prompt, 0.05);
		tl.to({}, { duration: 0.2 });
		pulse(tl, 'composer-send');
		tl.fromTo('#side-bubble-2', { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.18, ease: 'power2.out' });
		tl.set({}, { onComplete: () => {
			sideComposerText = '';
			sideBadgeCount = 3;
		}});
		tl.to({}, { duration: 0.3 });

		sideChats[2].lines.forEach((_, li) => {
			tl.fromTo(`#side-r2-${li}`, { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 0.16, ease: 'power1.out' }, '<+0.18');
		});
		tl.set({}, { onComplete: () => { sideResponded = [true, true, true]; } });
		tl.to({}, { duration: 1.2 });

		// Play immediately
		tl.play();
	});
</script>

<div class="demo-frame" bind:this={frameEl}>
	<div class="content-area">

		<!-- Main panel -->
		<div class="main">
			<div class="chat-header">
				<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" fill="rgba(23,23,23,0.4)" viewBox="0 0 256 256"><path d="M128,24A104,104,0,0,0,36.18,176.88L24.83,210.93a16,16,0,0,0,20.24,20.24l34.05-11.35A104,104,0,1,0,128,24Zm0,192a87.87,87.87,0,0,1-44.06-11.81,8,8,0,0,0-6.54-.67L40,216,52.47,178.6a8,8,0,0,0-.66-6.54A88,88,0,1,1,128,216Z"/></svg>
				<span class="chat-title">Transformers</span>
			</div>

			<div class="messages">
				<div class="messages-inner">
					<!-- Exchange 1 — pre-rendered, has side chat toolbar -->
					<div class="user-bubble">{prompt1}</div>
					<div class="exchange-block">
						<div class="response">
							{#each response1Lines as line}
								{#if line === ''}
									<div class="resp-spacer"></div>
								{:else}
									<div class="resp-line">{@html line}</div>
								{/if}
							{/each}
						</div>
						<div class="msg-toolbar">
							<button id="side-badge" class="icon-chip icon-chip-side" class:icon-chip-active={sideBadgeCount > 0}>
								<span style="display:inline-flex;transform:scaleY(-1)"><Split size={14} /></span>
								{#if sideBadgeCount > 0}<span class="badge-count">{sideBadgeCount}</span>{/if}
							</button>
							<button class="icon-chip"><GitFork size={14} /></button>
							<button class="icon-chip"><Trash2 size={14} /></button>
						</div>
					</div>

					<div class="exchange-divider"></div>

					<!-- Exchange 2 — pre-rendered -->
					<div class="user-bubble">{prompt2}</div>
					<div class="exchange-block">
						<div class="response">
							{#each response2Lines as line}
								<div class="resp-line">{@html line}</div>
							{/each}
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Side panel -->
		<div class="side-panel" bind:this={sidePanelEl}>
			<div class="chat-header side-panel-header">
				<div class="side-panel-nav">
					<button class="side-nav-btn"><ChevronLeft size={14} /></button>
					<span class="side-counter">{sideCounter}</span>
					<button class="side-nav-btn"><ChevronRight size={14} /></button>
				</div>
				<div class="side-panel-actions">
					<button id="side-plus-btn" class="side-nav-btn"><Plus size={14} /></button>
					<button class="side-nav-btn"><X size={14} /></button>
				</div>
			</div>

			<div class="side-messages">
				{#each sideChats as chat, idx}
					<div class="side-chat-view" class:side-chat-active={activeSide === idx && idx < sideCount}>
						<!-- Copied context from main exchange -->
						<div class="branch-context">
							<div class="user-bubble branch-bubble">{prompt1}</div>
							<div class="exchange-block">
								<div class="response branch-response">
									{#each response1Lines as line}
										{#if line === ''}
											<div class="resp-spacer"></div>
										{:else}
											<div class="resp-line">{@html line}</div>
										{/if}
									{/each}
								</div>
								<div class="msg-toolbar">
									<button class="icon-chip"><GitFork size={14} /></button>
									<button class="icon-chip"><Trash2 size={14} /></button>
								</div>
							</div>
						</div>
						<div class="exchange-divider"></div>
						<div id="side-bubble-{idx}" class="user-bubble" style="opacity: 0">{chat.prompt}</div>
						<div class="response">
							{#each chat.lines as line, li}
								<div id="side-r{idx}-{li}" class="resp-line" style="opacity: 0">{@html line}</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>

	</div>

	<!-- Composer — shifts right when side panel is open -->
	<div class="composer-outer" class:composer-shifted={sideOpen}>
		<div class="composer-wrap">
			<div class="composer">
				<div class="composer-row">
					<button class="composer-attach"><Plus size={16} /></button>
					<div id="composer-input" class="composer-input">
						{#if sideOpen}
							{#if sideComposerText}
								<span class="composer-text">{sideComposerText}<span class="composer-cursor">|</span></span>
							{:else}
								<span class="composer-placeholder">Chat...</span>
							{/if}
						{:else}
							{#if composerText}
								<span class="composer-text">{composerText}<span class="composer-cursor">|</span></span>
							{:else}
								<span class="composer-placeholder">Chat...</span>
							{/if}
						{/if}
					</div>
					<button id="composer-send" class="composer-send">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<line x1="12" y1="19" x2="12" y2="5"></line>
							<polyline points="5 12 12 5 19 12"></polyline>
						</svg>
					</button>
				</div>
			</div>
		</div>
	</div>

</div>

<style>
	.demo-frame {
		position: relative;
		display: flex;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: hsl(0 0% 98%);
		font-family: Inter, system-ui, sans-serif;
		font-size: 12.75px;
		color: hsl(0 0% 9%);
		isolation: isolate;
		flex: 1;
	}

	.content-area {
		position: absolute;
		inset: 0;
		display: flex;
	}

	/* ── Main panel ───────────────────────────────────────── */
	.main {
		position: relative;
		flex: 1;
		min-width: 0;
		background: white;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.chat-header {
		height: 52px;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0 1.5rem;
		background: hsl(0 0% 98%);
		border-bottom: 1px solid hsl(0 0% 91%);
		flex-shrink: 0;
	}

	.chat-title {
		font-size: 13.75px;
		font-weight: 600;
		color: rgba(23,23,23,0.8);
	}

	/* ── Messages ─────────────────────────────────────────── */
	.messages {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 1.5rem 1.5rem 7rem;
	}

	.messages-inner {
		width: 100%;
		max-width: 640px;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.exchange-divider {
		height: 1px;
		background: hsl(0 0% 91%);
		margin: 0.25rem 0;
	}

	.exchange-block {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.user-bubble {
		align-self: flex-end;
		max-width: 65%;
		background: hsl(0 0% 12%);
		color: rgba(255,255,255,0.92);
		padding: 0.65rem 1rem;
		border-radius: 12px;
		font-size: 13.75px;
		font-weight: 500;
		line-height: 1.5;
	}

	.response {
		font-size: 13.75px;
		line-height: 1.75;
		color: hsl(0 0% 9%);
	}

	.resp-line { display: block; }
	.resp-spacer { display: block; height: 0.6em; }

	/* ── Message toolbar ──────────────────────────────────── */
	.msg-toolbar {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.2rem;
		margin-top: 0.25rem;
	}

	.icon-chip {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: rgba(23,23,23,0.4);
		cursor: pointer;
	}

	.icon-chip:hover {
		background: hsl(0 0% 94%);
		color: rgba(23,23,23,0.8);
	}

	.icon-chip-side {
		width: auto;
		padding: 0 0.5rem;
		gap: 0.3rem;
		border-radius: 999px;
		border: 1px solid hsl(0 0% 88%);
	}

	.icon-chip-active {
		color: hsl(158 70% 38%);
		border-color: hsl(158 60% 72%);
		background: hsl(158 60% 96%);
	}

	.badge-count {
		font-size: 11.5px;
		font-weight: 500;
	}

	/* ── Composer ─────────────────────────────────────────── */
	.composer-outer {
		position: absolute;
		bottom: 1.25rem;
		left: 0;
		width: 100%;
		display: flex;
		justify-content: center;
		pointer-events: none;
		transition: transform 0.4s cubic-bezier(0.77,0,0.18,1);
	}

	.composer-shifted {
		transform: translateX(25%);
	}

	.composer-wrap {
		width: min(640px, calc(50% - 3rem));
		pointer-events: all;
	}

	.composer {
		background: white;
		border: 1px solid hsl(0 0% 88%);
		border-radius: 20px;
		box-shadow: 0 8px 32px rgba(0,0,0,0.08);
		overflow: hidden;
	}

	.composer-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.75rem 0.85rem;
	}

	.composer-attach {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border-radius: 50%;
		border: 1px solid hsl(0 0% 88%);
		background: white;
		color: rgba(23,23,23,0.5);
		flex-shrink: 0;
		cursor: pointer;
	}

	.composer-input {
		flex: 1;
		font-size: 13.75px;
		min-height: 20px;
	}

	.composer-text { color: hsl(0 0% 9%); }
	.composer-placeholder { color: rgba(23,23,23,0.3); }

	.composer-cursor {
		color: rgba(23,23,23,0.7);
		animation: blink 0.7s ease infinite;
	}

	.composer-send {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border-radius: 50%;
		border: none;
		background: hsl(0 0% 12%);
		color: white;
		flex-shrink: 0;
		cursor: pointer;
		line-height: 0;
	}

	/* ── Side panel ───────────────────────────────────────── */
	.side-panel {
		position: relative;
		width: 0;
		opacity: 0;
		background: hsl(0 0% 99%);
		border-left: 1px solid hsl(0 0% 91%);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		flex-shrink: 0;
	}

	.side-panel-header {
		justify-content: space-between;
		padding: 0 0.75rem;
	}

	.side-panel-nav, .side-panel-actions {
		display: flex;
		align-items: center;
		gap: 0.2rem;
	}

	.side-counter {
		font-size: 12px;
		color: rgba(23,23,23,0.45);
		min-width: 2.5rem;
		text-align: center;
	}

	.side-nav-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: rgba(23,23,23,0.5);
		cursor: pointer;
	}

	.side-messages {
		position: relative;
		flex: 1;
		overflow: hidden;
	}

	.side-chat-view {
		display: none;
		flex-direction: column;
		gap: 0.85rem;
		padding: 1.5rem 1.5rem 7rem 1.5rem;
		height: 100%;
		overflow-y: auto;
	}

	.branch-context {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		opacity: 0.4;
	}

	.branch-bubble {
		pointer-events: none;
	}

	.branch-response {
		pointer-events: none;
	}


	.side-chat-active {
		display: flex;
	}

	@keyframes blink {
		0%, 100% { opacity: 1; }
		50% { opacity: 0; }
	}
</style>
