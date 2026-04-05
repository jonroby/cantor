<script lang="ts">
	import { onMount } from 'svelte';
	import { gsap } from 'gsap';
	import { Plus, Split, X, ChevronLeft, ChevronRight } from 'lucide-svelte';

	interface Props {
		onComplete: () => void;
	}

	const { onComplete }: Props = $props();

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
			prompt: 'What is Q?',
			lines: ['The <strong>query</strong> vector represents what the current token is "looking for" — it scores relevance against all keys.']
		},
		{
			prompt: 'What is K?',
			lines: ['The <strong>key</strong> vector represents what each token "offers". A high dot-product between Q and K means strong attention.']
		},
		{
			prompt: 'What is V?',
			lines: ['The <strong>value</strong> vector is the content retrieved. Attention weights sum the values to produce the final output.']
		}
	];

	let composerText = $state('');
	let sideComposerText = $state('');
	let sideCounter = $state('1 / 1');
	let sideBadgeCount = $state(0);
	let activeSide = $state(0);
	let sideOpen = $state(false);

	let frameEl: HTMLElement;
	let sidebarEl: HTMLElement;
	let mainEl: HTMLElement;
	let sidePanelEl: HTMLElement;

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
		const tl = gsap.timeline();

		// 1. Type prompt 1, pulse send
		typeInto(tl, s => { composerText = s; }, prompt1);
		tl.to({}, { duration: 0.15 });
		pulse(tl, 'composer-send');
		tl.fromTo('#bubble-1', { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out' });
		tl.set({}, { onComplete: () => { composerText = ''; } });
		tl.to({}, { duration: 0.3 });

		// 2. Stream response 1
		response1Lines.forEach((_, i) => {
			tl.fromTo(`#r1-${i}`, { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 0.16, ease: 'power1.out' }, '<+0.18');
		});
		tl.to({}, { duration: 0.4 });

		// 3. Side badge appears
		tl.fromTo('#side-badge', { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.22, ease: 'back.out(1.5)' });
		tl.to({}, { duration: 0.3 });

		// 4. Type prompt 2, pulse send
		typeInto(tl, s => { composerText = s; }, prompt2);
		tl.to({}, { duration: 0.15 });
		pulse(tl, 'composer-send');
		tl.fromTo('#bubble-2', { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out' });
		tl.set({}, { onComplete: () => { composerText = ''; } });
		tl.to({}, { duration: 0.3 });

		// 5. Partial response 2 streams
		response2Lines.forEach((_, i) => {
			tl.fromTo(`#r2-${i}`, { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 0.16, ease: 'power1.out' }, '<+0.18');
		});
		tl.to({}, { duration: 0.5 });

		// 6. Pulse side badge, panel opens
		pulse(tl, 'side-badge');
		tl.to(sidePanelEl, { width: '50%', opacity: 1, duration: 0.4, ease: 'power3.inOut' });
		tl.set({}, { onComplete: () => { sideOpen = true; } });
		tl.to({}, { duration: 0.3 });

		// 7–9. Three side chats
		sideChats.forEach((chat, idx) => {
			tl.set({}, { onComplete: () => { activeSide = idx; } });

			typeInto(tl, s => { sideComposerText = s; }, chat.prompt, 0.05);
			tl.to({}, { duration: 0.15 });
			pulse(tl, 'composer-send');
			tl.fromTo(`#side-bubble-${idx}`, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.18, ease: 'power2.out' });
			tl.set({}, { onComplete: () => { sideComposerText = ''; } });
			tl.to({}, { duration: 0.3 });

			chat.lines.forEach((_, li) => {
				tl.fromTo(`#side-r${idx}-${li}`, { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 0.16, ease: 'power1.out' }, '<+0.18');
			});
			tl.set({}, { onComplete: () => {
				sideBadgeCount = idx + 1;
				sideCounter = `${idx + 1} / ${idx + 1}`;
			}});
			tl.to({}, { duration: 0.5 });

			if (idx < sideChats.length - 1) {
				pulse(tl, 'side-plus-btn');
				tl.to({}, { duration: 0.2 });
			}
		});

		tl.to({}, { duration: 1 });
		tl.call(onComplete);
	});
</script>

<div class="demo-frame" bind:this={frameEl}>
	<div class="content-area">

		<!-- Main panel -->
		<div class="main" bind:this={mainEl}>
			<div class="chat-header">
				<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" fill="rgba(23,23,23,0.4)" viewBox="0 0 256 256"><path d="M128,24A104,104,0,0,0,36.18,176.88L24.83,210.93a16,16,0,0,0,20.24,20.24l34.05-11.35A104,104,0,1,0,128,24Zm0,192a87.87,87.87,0,0,1-44.06-11.81,8,8,0,0,0-6.54-.67L40,216,52.47,178.6a8,8,0,0,0-.66-6.54A88,88,0,1,1,128,216Z"/></svg>
				<span class="chat-title">Transformers</span>
			</div>

			<div class="messages">
				<div class="messages-inner">
					<!-- Exchange 1 — side badge lives here -->
					<div id="bubble-1" class="user-bubble" style="opacity:0">{prompt1}</div>
					<div class="exchange-block">
						<div class="response">
							{#each response1Lines as line, i}
								{#if line === ''}
									<div id="r1-{i}" class="resp-spacer" style="opacity:0"></div>
								{:else}
									<div id="r1-{i}" class="resp-line" style="opacity:0">{@html line}</div>
								{/if}
							{/each}
						</div>
						<div class="badge-row">
							<button id="side-badge" class="side-badge" style="opacity:0">
								<Split size={13} style="transform: scaleY(-1)" />
								{#if sideBadgeCount > 0}<span>{sideBadgeCount}</span>{/if}
							</button>
						</div>
					</div>

					<!-- Exchange 2 -->
					<div id="bubble-2" class="user-bubble" style="opacity:0">{prompt2}</div>
					<div class="exchange-block">
						<div class="response">
							{#each response2Lines as line, i}
								<div id="r2-{i}" class="resp-line" style="opacity:0">{@html line}</div>
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
					<div class="side-chat-view" class:side-chat-active={activeSide === idx}>
						<div id="side-bubble-{idx}" class="user-bubble" style="opacity:0">{chat.prompt}</div>
						<div class="response">
							{#each chat.lines as line, li}
								<div id="side-r{idx}-{li}" class="resp-line" style="opacity:0">{@html line}</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>

	</div>

	<!-- Single composer — shifts right when side panel opens -->
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

	.exchange-block {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.badge-row {
		display: flex;
		justify-content: flex-end;
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

	/* ── Side badge ───────────────────────────────────────── */
	.side-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		align-self: flex-start;
		padding: 0.22rem 0.5rem;
		border: 1px solid hsl(0 0% 88%);
		border-radius: 999px;
		background: white;
		color: rgba(23,23,23,0.56);
		font-size: 12px;
		cursor: pointer;
	}

	/* ── Composer — single, floats over full width ────────── */
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
		padding: 1.25rem 1.25rem 7rem;
		height: 100%;
	}

	.side-chat-active {
		display: flex;
	}

@keyframes blink {
		0%, 100% { opacity: 1; }
		50% { opacity: 0; }
	}
</style>
