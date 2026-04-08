<script lang="ts">
	import { onMount } from 'svelte';
	import { gsap } from 'gsap';
	import { Plus, GitFork, Trash2, MessageSquare } from 'lucide-svelte';

	interface Props {
		onComplete: () => void;
	}

	const { onComplete }: Props = $props();
	const CHAPTER_START_DELAY_S = 1.25;

	const prompt1 = 'How does attention work in transformers?';
	const response1Lines = [
		'Attention lets the model weigh how relevant each token is to every',
		'other token in the sequence.',
		'',
		'For each position it computes a <strong>query</strong>, <strong>key</strong>, and <strong>value</strong>. The query',
		'is matched against all keys to produce scores, softmaxed into',
		'weights that sum the values into the final output.'
	];

	const forkPrompt = 'Can you explain this differently?';
	const forkResponseLines = [
		'Think of it like a spotlight. Each token decides which other tokens',
		'to "look at" — the brighter the spotlight, the more influence',
		'that token has on the output.'
	];

	let chatTitle        = $state('Transformers');
	let forkVisible      = $state(false);
	let forkResponded    = $state(false);
	let forkButtonActive = $state(false);
	let composerText     = $state('');
	let activeChat       = $state<'original' | 'fork'>('fork');

	let frameEl: HTMLElement;
	let sidebarEl: HTMLElement;
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

		tl.to({}, { duration: CHAPTER_START_DELAY_S });

		// Pulse fork button → title changes, fork exchange appears
		tl.set({}, { onComplete: () => { forkButtonActive = true; } });
		pulse(tl, 'fork-btn');
		tl.set({}, { onComplete: () => { forkButtonActive = false; forkVisible = true; chatTitle = 'Transformers (Fork)'; } });
		tl.to({}, { duration: 0.3 });

		// Fork bubble appears
		tl.fromTo('#fork-bubble', { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out' });
		tl.to({}, { duration: 0.2 });

		tl.to({}, { duration: 0.8 });

		// Sidebar slides in
		tl.to(sidebarEl, { width: 200, opacity: 1, duration: 0.35, ease: 'power3.inOut' });
		tl.to({}, { duration: 1.0 });

		// Pulse "Transformers" → switch active, update title, close sidebar
		pulse(tl, 'sidebar-original');
		tl.set({}, { onComplete: () => { activeChat = 'original'; chatTitle = 'Transformers'; } });
		tl.to({}, { duration: 0.3 });
		tl.to(sidebarEl, { width: 0, opacity: 0, duration: 0.35, ease: 'power3.inOut' });
		tl.to({}, { duration: 1.5 });
		tl.call(onComplete);

		tl.play();
	});
</script>

<div class="demo-frame" bind:this={frameEl}>
	<div class="content-area">

		<!-- Sidebar -->
		<div class="sidebar" bind:this={sidebarEl}>
			<div class="sidebar-inner">
				<div class="sidebar-section-label">Chats</div>
				<div id="sidebar-original" class="sidebar-item" class:sidebar-item-active={activeChat === 'original'}>
					<MessageSquare size={13} />
					<span class="sidebar-item-label">Transformers</span>
				</div>
				<div class="sidebar-item" class:sidebar-item-active={activeChat === 'fork'}>
					<MessageSquare size={13} />
					<span class="sidebar-item-label">Transformers (Fork)</span>
				</div>
			</div>
		</div>

		<div class="main">
			<div class="chat-header">
				<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" fill="rgba(23,23,23,0.4)" viewBox="0 0 256 256"><path d="M128,24A104,104,0,0,0,36.18,176.88L24.83,210.93a16,16,0,0,0,20.24,20.24l34.05-11.35A104,104,0,1,0,128,24Zm0,192a87.87,87.87,0,0,1-44.06-11.81,8,8,0,0,0-6.54-.67L40,216,52.47,178.6a8,8,0,0,0-.66-6.54A88,88,0,1,1,128,216Z"/></svg>
				<span class="chat-title">{chatTitle}</span>
			</div>

			<div class="messages">
				<div class="messages-inner">
					<!-- Exchange 1 -->
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
							<button
								id="fork-btn"
								class="icon-chip"
								class:icon-chip-active={forkButtonActive}
							><GitFork size={14} /></button>
							<button class="icon-chip"><Trash2 size={14} /></button>
						</div>
					</div>

					<!-- Forked exchange (no divider) -->
					{#if forkVisible}
						<div id="fork-bubble" class="user-bubble" style="opacity:0">{forkPrompt}</div>
						{#if forkResponded}
							<div class="exchange-block">
								<div class="response">
									{#each forkResponseLines as line, li}
										<div id="fork-r-{li}" class="resp-line" style="opacity:0">{line}</div>
									{/each}
								</div>
							</div>
						{/if}
					{/if}
				</div>
			</div>
		</div>

	</div>

	<div class="composer-outer">
		<div class="composer-wrap">
			<div class="composer">
				<div class="composer-row">
					<button class="composer-attach"><Plus size={16} /></button>
					<div class="composer-input">
						{#if composerText}
							<span class="composer-text">{composerText}<span class="composer-cursor">|</span></span>
						{:else}
							<span class="composer-placeholder">Chat...</span>
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

	/* ── Sidebar ──────────────────────────────────────────── */
	.sidebar {
		width: 0;
		opacity: 0;
		background: hsl(0 0% 97%);
		border-right: 1px solid hsl(0 0% 91%);
		flex-shrink: 0;
		overflow: hidden;
	}

	.sidebar-inner {
		width: 200px;
		padding: 1rem 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.sidebar-section-label {
		font-size: 10.5px;
		font-weight: 600;
		color: rgba(23,23,23,0.35);
		letter-spacing: 0.05em;
		text-transform: uppercase;
		padding: 0 0.5rem;
		margin-bottom: 0.25rem;
	}

	.sidebar-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4rem 0.5rem;
		border-radius: 6px;
		color: rgba(23,23,23,0.55);
		cursor: pointer;
		white-space: nowrap;
		overflow: hidden;
	}

	.sidebar-item-active {
		background: hsl(0 0% 91%);
		color: rgba(23,23,23,0.85);
		font-weight: 500;
	}

	.sidebar-item-label {
		font-size: 12.75px;
		overflow: hidden;
		text-overflow: ellipsis;
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
		transition: color 0.15s, background 0.15s;
	}

	.icon-chip-active {
		color: hsl(158 70% 38%);
		background: hsl(158 60% 96%);
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

	@keyframes blink {
		0%, 100% { opacity: 1; }
		50% { opacity: 0; }
	}
</style>
