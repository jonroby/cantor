<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { gsap } from 'gsap';
	import { Plus, GitFork, Trash2 } from 'lucide-svelte';

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

	const prompt2 = 'Can you describe self-attention?';
	const response2Para1 =
		'Self-attention lets every token in a sequence look at every other token simultaneously. For each position, the model computes a weighted sum of all token representations — the weights reflect how relevant each token is to the current one.';
	const response2Para2 =
		'Those weights come from dot products between query and key vectors, scaled and passed through a softmax. The result is a new representation for each token that blends information from the entire context window.';

	const autoAskPrompt =
		'Can you say more about: Those weights come from dot products between query and key vectors...';
	const autoAskResponseLines = [
		'The dot product measures alignment between a query and a key —',
		'high similarity means high attention weight. Scaling by √d_k',
		'prevents the softmax from saturating in high dimensions.',
		'',
		'After softmax, the weights sum to 1 and act as a mixing',
		"distribution over value vectors. Each token's output is",
		'the weighted average of all values in the sequence.'
	];

	let highlightActive = $state(false);
	let contextMenuVisible = $state(false);
	let contextMenuX = $state(0);
	let contextMenuY = $state(0);
	let quickAskActive = $state(false);
	let showAutoAsk = $state(false);

	let frameEl: HTMLElement;
	let highlightRef: HTMLElement;
	let tl: gsap.core.Timeline;

	export function pause() {
		tl?.pause();
	}
	export function resume() {
		tl?.resume();
	}

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
			// eslint-disable-next-line svelte/no-dom-manipulating
			frameEl.appendChild(ring);
			gsap.to(ring, {
				width: 72,
				height: 72,
				opacity: 0,
				boxShadow: '0 0 0 28px rgba(16,185,129,0)',
				duration: 0.85,
				ease: 'power2.out',
				onComplete: () => ring.remove()
			});
		});
		tl.to({}, { duration: 0.5 });
	}

	function pulseEl(tl: gsap.core.Timeline, el: () => HTMLElement | null) {
		tl.call(() => {
			const frame = frameEl.getBoundingClientRect();
			const target = el()?.getBoundingClientRect();
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
			// eslint-disable-next-line svelte/no-dom-manipulating
			frameEl.appendChild(ring);
			gsap.to(ring, {
				width: 72,
				height: 72,
				opacity: 0,
				boxShadow: '0 0 0 28px rgba(16,185,129,0)',
				duration: 0.85,
				ease: 'power2.out',
				onComplete: () => ring.remove()
			});
		});
		tl.to({}, { duration: 0.5 });
	}

	onMount(() => {
		tl = gsap.timeline({ paused: true });

		tl.to({}, { duration: CHAPTER_START_DELAY_S });

		// Highlight the phrase
		tl.set(
			{},
			{
				onComplete: () => {
					highlightActive = true;
				}
			}
		);
		tl.to({}, { duration: 0.5 });

		// Right-click → context menu
		pulseEl(tl, () => highlightRef);
		tl.set(
			{},
			{
				onComplete: () => {
					if (highlightRef) {
						const frame = frameEl.getBoundingClientRect();
						const r = highlightRef.getBoundingClientRect();
						contextMenuX = r.right - frame.left - 120;
						contextMenuY = r.bottom - frame.top - 36;
					}
					contextMenuVisible = true;
				}
			}
		);
		tl.to({}, { duration: 0.6 });

		// Click "Quick Ask" → highlight button then swap view
		tl.set(
			{},
			{
				onComplete: () => {
					quickAskActive = true;
				}
			}
		);
		pulse(tl, 'quick-ask-btn');
		tl.set(
			{},
			{
				onComplete: () => {
					quickAskActive = false;
					contextMenuVisible = false;
					highlightActive = false;
					showAutoAsk = true;
				}
			}
		);
		tl.to({}, { duration: 0.05 });

		// Wait for Svelte to render the new elements, then stream in the response
		tl.call(() => {
			tick().then(() => {
				autoAskResponseLines.forEach((_, li) => {
					gsap.fromTo(
						`#auto-ask-r-${li}`,
						{ opacity: 0, y: 4 },
						{ opacity: 1, y: 0, duration: 0.16, ease: 'power1.out', delay: li * 0.18 }
					);
				});
			});
		});

		tl.to({}, { duration: autoAskResponseLines.length * 0.18 + 1.0 });
		tl.call(onComplete);

		tl.play();
	});
</script>

<div class="demo-frame" bind:this={frameEl}>
	<div class="content-area">
		<div class="main">
			<div class="chat-header">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="17"
					height="17"
					fill="rgba(23,23,23,0.4)"
					viewBox="0 0 256 256"
					><path
						d="M128,24A104,104,0,0,0,36.18,176.88L24.83,210.93a16,16,0,0,0,20.24,20.24l34.05-11.35A104,104,0,1,0,128,24Zm0,192a87.87,87.87,0,0,1-44.06-11.81,8,8,0,0,0-6.54-.67L40,216,52.47,178.6a8,8,0,0,0-.66-6.54A88,88,0,1,1,128,216Z"
					/></svg
				>
				<span class="chat-title">Transformers</span>
			</div>

			<div class="messages">
				<div class="messages-inner">
					{#if !showAutoAsk}
						<!-- Exchange 1 -->
						<div class="user-bubble">{prompt1}</div>
						<div class="exchange-block">
							<div class="response">
								{#each response1Lines as line (line)}
									{#if line === ''}
										<div class="resp-spacer"></div>
									{:else}
										<!-- eslint-disable-next-line svelte/no-at-html-tags -->
										<div class="resp-line">{@html line}</div>
									{/if}
								{/each}
							</div>
							<div class="msg-toolbar">
								<button class="icon-chip"><GitFork size={14} /></button>
								<button class="icon-chip"><Trash2 size={14} /></button>
							</div>
						</div>

						<div class="exchange-divider"></div>

						<!-- Exchange 2 -->
						<div class="user-bubble">{prompt2}</div>
						<div class="exchange-block">
							<div class="response">
								<div class="resp-para">{response2Para1}</div>
								<div
									bind:this={highlightRef}
									class="resp-para resp-highlight"
									class:resp-highlight-active={highlightActive}
								>
									{response2Para2}
								</div>
							</div>
						</div>
					{:else}
						<!-- Auto Ask response at top -->
						<div class="user-bubble auto-ask-bubble">{autoAskPrompt}</div>
						<div class="exchange-block">
							<div class="response">
								{#each autoAskResponseLines as line, li (li)}
									{#if line === ''}
										<div id="auto-ask-r-{li}" class="resp-spacer" style="opacity:0"></div>
									{:else}
										<div id="auto-ask-r-{li}" class="resp-line" style="opacity:0">{line}</div>
									{/if}
								{/each}
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<!-- Context menu -->
	{#if contextMenuVisible}
		<div class="context-menu" style="left: {contextMenuX}px; top: {contextMenuY}px;">
			<button
				id="quick-ask-btn"
				class="context-menu-item"
				class:context-menu-item-active={quickAskActive}>Quick Ask</button
			>
		</div>
	{/if}

	<!-- Composer -->
	<div class="composer-outer">
		<div class="composer-wrap">
			<div class="composer">
				<div class="composer-row">
					<button class="composer-attach"><Plus size={16} /></button>
					<div class="composer-input">
						<span class="composer-placeholder">Chat...</span>
					</div>
					<button class="composer-send">
						<svg
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
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
		color: rgba(23, 23, 23, 0.8);
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
		color: rgba(255, 255, 255, 0.92);
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

	.resp-line {
		display: block;
	}
	.resp-spacer {
		display: block;
		height: 0.6em;
	}

	.resp-para {
		display: block;
		margin-bottom: 0.6em;
	}

	.resp-para:last-child {
		margin-bottom: 0;
	}

	.auto-ask-bubble {
		font-size: 12.5px;
		opacity: 0.85;
	}

	.resp-highlight {
		border-radius: 4px;
		transition:
			background 0.2s,
			color 0.2s;
		position: relative;
		z-index: 1;
	}

	.resp-highlight-active {
		background: hsl(158 60% 88%);
		color: hsl(158 60% 18%);
		border-radius: 4px;
	}

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
		color: rgba(23, 23, 23, 0.4);
		cursor: pointer;
	}

	.context-menu {
		position: absolute;
		background: white;
		border: 1px solid hsl(0 0% 88%);
		border-radius: 8px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
		overflow: hidden;
		z-index: 300;
		min-width: 110px;
	}

	.context-menu-item {
		display: block;
		width: 100%;
		padding: 7px 12px;
		text-align: left;
		background: transparent;
		border: none;
		font-size: 13px;
		font-family: inherit;
		color: hsl(0 0% 9%);
		cursor: pointer;
	}

	.context-menu-item:hover {
		background: hsl(0 0% 96%);
	}

	.context-menu-item-active {
		background: hsl(0 0% 92%);
		color: hsl(0 0% 9%);
	}

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
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
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
		color: rgba(23, 23, 23, 0.5);
		flex-shrink: 0;
		cursor: pointer;
	}

	.composer-input {
		flex: 1;
		font-size: 13.75px;
		min-height: 20px;
	}

	.composer-placeholder {
		color: rgba(23, 23, 23, 0.3);
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
</style>
