<script lang="ts">
	import { onMount } from 'svelte';
	import { gsap } from 'gsap';
	import { MessageSquare, MessageSquarePlus, FolderPlus, ArrowUp, Plus } from 'lucide-svelte';

	const userPrompt = 'How does attention work in transformers?';
	const responseLines = [
		'Attention lets the model weigh how relevant each token is to every',
		'other token in the sequence.',
		'',
		'For each position it computes a <strong>query</strong>, <strong>key</strong>, and <strong>value</strong>. The query is',
		'matched against all keys to produce scores, softmaxed into weights',
		'that sum the values into the final output.'
	];

	let composerText = $state('');
	let sidebarEl: HTMLElement;
	let mainEl: HTMLElement;

	let frameEl: HTMLElement;

	onMount(() => {
		const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.5 });

		// ── 0. Zoom into composer ─────────────────────────────
		// The composer sits at the bottom-center of the frame.
		// We scale the frame up and shift it so the composer fills view.
		tl.fromTo(
			frameEl,
			{ scale: 1, y: 0 },
			{ scale: 2.2, y: '-38%', duration: 0.8, ease: 'power3.inOut' }
		);
		tl.to({}, { duration: 0.4 });

		// ── 1. Type into composer ─────────────────────────────
		tl.to(
			{},
			{
				duration: userPrompt.length * 0.042,
				ease: 'none',
				onUpdate() {
					const progress = this.progress();
					const chars = Math.floor(progress * userPrompt.length);
					composerText = userPrompt.slice(0, chars);
				}
			}
		);

		tl.to({}, { duration: 0.3 });

		// ── 2. Send ───────────────────────────────────────────
		tl.fromTo(
			'#user-bubble',
			{ opacity: 0, y: 8 },
			{ opacity: 1, y: 0, duration: 0.2, ease: 'power2.out' }
		);
		tl.set(
			{},
			{
				onComplete: () => {
					composerText = '';
				}
			}
		);

		tl.to({}, { duration: 0.5 });

		// ── 3. Stream response lines ──────────────────────────
		responseLines.forEach((_, i) => {
			tl.fromTo(
				`#resp-${i}`,
				{ opacity: 0, y: 4 },
				{ opacity: 1, y: 0, duration: 0.18, ease: 'power1.out' },
				'<+0.2'
			);
		});

		tl.to('#resp-cursor', { opacity: 0, duration: 0.35, repeat: 5, yoyo: true });
		tl.set('#resp-cursor', { opacity: 0 });

		tl.to({}, { duration: 1.5 });

		// ── 4. Collapse sidebar ───────────────────────────────
		tl.to(sidebarEl, { width: 0, duration: 0.4, ease: 'power3.inOut' });
		tl.to(mainEl, { marginLeft: 0, duration: 0.4, ease: 'power3.inOut' }, '<');

		tl.to({}, { duration: 1.5 });

		// ── 5. Expand sidebar ─────────────────────────────────
		tl.to(sidebarEl, { width: 216, duration: 0.4, ease: 'power3.inOut' });
		tl.to(mainEl, { marginLeft: 216, duration: 0.4, ease: 'power3.inOut' }, '<');

		tl.to({}, { duration: 0.5 });

		// ── Reset ─────────────────────────────────────────────
		tl.set('#user-bubble', { opacity: 0, y: 8 });
		responseLines.forEach((_, i) => {
			tl.set(`#resp-${i}`, { opacity: 0, y: 4 });
		});
	});
</script>

<div class="demo-frame" bind:this={frameEl}>
	<!-- Sidebar -->
	<div class="sidebar" bind:this={sidebarEl}>
		<div class="sidebar-header">
			<span class="sidebar-brand">Cantor</span>
		</div>

		<div class="sidebar-actions">
			<button class="sidebar-action-btn">
				<MessageSquarePlus size={15} />
				New chat
			</button>
			<button class="sidebar-action-btn">
				<FolderPlus size={15} />
				New folder
			</button>
		</div>

		<div class="sidebar-section-label">Chats</div>

		<div class="sidebar-items">
			<div class="sidebar-item sidebar-item-active">
				<MessageSquare size={14} />
				<span>Transformers</span>
			</div>
			{#each ['Chat (1)', 'Chat (2)', 'Chat (3)', 'Chat (4)'] as name (name)}
				<div class="sidebar-item">
					<MessageSquare size={14} />
					<span>{name}</span>
				</div>
			{/each}
		</div>

		<div class="sidebar-divider"></div>
		<div class="sidebar-section-label">Folders</div>
		<div class="sidebar-items">
			{#each ['Probability', 'Research', 'New Folder'] as name (name)}
				<div class="sidebar-item">
					<span class="folder-chevron">›</span>
					<span>{name}</span>
				</div>
			{/each}
		</div>
	</div>

	<!-- Main panel -->
	<div class="main" bind:this={mainEl} style="margin-left: 216px;">
		<!-- Chat header -->
		<div class="chat-header">
			<span class="chat-title">Transformers</span>
		</div>

		<!-- Messages -->
		<div class="messages">
			<!-- User bubble -->
			<div id="user-bubble" class="user-bubble" style="opacity:0">
				{userPrompt}
			</div>

			<!-- Response -->
			<div class="response">
				{#each responseLines as line, i (i)}
					{#if line === ''}
						<div id="resp-{i}" class="resp-spacer" style="opacity:0"></div>
					{:else}
						<div id="resp-{i}" class="resp-line" style="opacity:0">
							<!-- eslint-disable-next-line svelte/no-at-html-tags -->
							{@html line}
						</div>
					{/if}
				{/each}
				<span id="resp-cursor" class="resp-cursor" style="opacity:0">|</span>
			</div>
		</div>

		<!-- Composer -->
		<div class="composer-wrap">
			<div class="composer">
				<div class="composer-row">
					<button class="composer-attach"><Plus size={18} /></button>
					<div class="composer-input">
						{#if composerText}
							<span class="composer-text">{composerText}<span class="composer-cursor">|</span></span
							>
						{:else}
							<span class="composer-placeholder">Chat...</span>
						{/if}
					</div>
					<button class="composer-send"><ArrowUp size={14} strokeWidth={2.5} /></button>
				</div>
				<div class="composer-footer">
					<div class="composer-footer-left">
						<div class="model-chip">
							<span class="model-dot"></span>
							gemma4:latest
						</div>
						<div class="mode-chip">Agent</div>
						<div class="mode-chip">Tools</div>
					</div>
					<div class="composer-footer-right">
						<span class="ctx-label">Context Window</span>
						<div class="ctx-track"><div class="ctx-fill"></div></div>
						<span class="ctx-count">2,058 / 131,072</span>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	/* ── Frame ────────────────────────────────────────────── */
	.demo-frame {
		position: relative;
		display: flex;
		width: 100%;
		aspect-ratio: 16 / 9;
		overflow: hidden;
		background: hsl(0 0% 98%);
		font-family: Inter, system-ui, sans-serif;
		font-size: 12.75px;
		color: hsl(0 0% 9%);
		isolation: isolate;
		transform-origin: bottom center;
	}

	/* ── Sidebar ──────────────────────────────────────────── */
	.sidebar {
		position: absolute;
		top: 0;
		left: 0;
		width: 216px;
		height: 100%;
		background: hsl(0 0% 97%);
		border-right: 1px solid hsl(0 0% 88%);
		overflow: hidden;
		flex-shrink: 0;
		z-index: 2;
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		height: 52px;
		padding: 0 1.5rem;
		border-bottom: 1px solid hsl(0 0% 88%);
	}

	.sidebar-brand {
		font-size: 17px;
		font-weight: 600;
		color: rgba(23, 23, 23, 0.88);
	}

	.sidebar-actions {
		padding: 0.5rem;
	}

	.sidebar-action-btn {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		width: 100%;
		padding: 0.5rem 1rem;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: rgba(23, 23, 23, 0.6);
		font-size: 13.75px;
		cursor: pointer;
		text-align: left;
	}

	.sidebar-divider {
		height: 1px;
		background: hsl(0 0% 88%);
		margin: 0.5rem 0;
	}

	.sidebar-section-label {
		padding: 0 1.5rem;
		margin-bottom: 0.25rem;
		font-size: 12px;
		font-weight: 500;
		color: rgba(23, 23, 23, 0.5);
	}

	.sidebar-items {
		padding: 0 0.5rem;
	}

	.sidebar-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.45rem 1rem;
		border-radius: 6px;
		color: rgba(23, 23, 23, 0.5);
		font-size: 13.75px;
		white-space: nowrap;
		overflow: hidden;
	}

	.sidebar-item-active {
		background: rgba(23, 23, 23, 0.07);
		color: rgba(23, 23, 23, 0.88);
		font-weight: 500;
	}

	.folder-chevron {
		font-size: 15px;
		color: rgba(23, 23, 23, 0.4);
	}

	/* ── Main ─────────────────────────────────────────────── */
	.main {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: white;
		display: flex;
		flex-direction: column;
	}

	.chat-header {
		height: 52px;
		display: flex;
		align-items: center;
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

	/* ── Messages ─────────────────────────────────────────── */
	.messages {
		flex: 1;
		padding: 1.5rem 1.5rem 6rem;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.user-bubble {
		align-self: flex-end;
		max-width: 60%;
		background: hsl(0 0% 12%);
		color: rgba(255, 255, 255, 0.9);
		padding: 0.75rem 1.1rem;
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

	.resp-cursor {
		display: inline;
		color: rgba(23, 23, 23, 0.6);
		font-weight: 300;
		animation: blink 0.9s ease infinite;
	}

	@keyframes blink {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0;
		}
	}

	/* ── Composer ─────────────────────────────────────────── */
	.composer-wrap {
		position: absolute;
		bottom: 1.5rem;
		left: 50%;
		transform: translateX(-50%);
		width: min(680px, calc(100% - 3rem));
	}

	.composer {
		background: white;
		border: 1px solid hsl(0 0% 88%);
		border-radius: 20px;
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.1);
		overflow: hidden;
	}

	.composer-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.85rem 1rem;
	}

	.composer-attach {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		border: 1px solid hsl(0 0% 88%);
		background: white;
		color: rgba(23, 23, 23, 0.5);
		flex-shrink: 0;
		cursor: pointer;
	}

	.composer-input {
		flex: 1;
		font-size: 15px;
		min-height: 24px;
	}

	.composer-text {
		color: hsl(0 0% 9%);
	}

	.composer-placeholder {
		color: rgba(23, 23, 23, 0.3);
	}

	.composer-cursor {
		color: rgba(23, 23, 23, 0.7);
		animation: blink 0.7s ease infinite;
	}

	.composer-send {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		border: none;
		background: hsl(0 0% 12%);
		color: white;
		flex-shrink: 0;
		cursor: pointer;
	}

	.composer-footer {
		display: flex;
		align-items: center;
		border-top: 1px solid hsl(0 0% 91%);
		padding: 0.65rem 1rem;
		gap: 0.75rem;
	}

	.composer-footer-left {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.model-chip,
	.mode-chip {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		height: 26px;
		padding: 0 0.65rem;
		border: 1px solid hsl(0 0% 88%);
		border-radius: 6px;
		background: white;
		font-size: 11.5px;
		font-weight: 500;
		color: rgba(23, 23, 23, 0.7);
		white-space: nowrap;
	}

	.model-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: #d97706;
		flex-shrink: 0;
	}

	.composer-footer-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-left: auto;
		padding-left: 0.75rem;
		border-left: 1px solid hsl(0 0% 91%);
		color: rgba(23, 23, 23, 0.45);
		font-size: 11.5px;
	}

	.ctx-label {
		white-space: nowrap;
	}
	.ctx-count {
		white-space: nowrap;
	}

	.ctx-track {
		width: 80px;
		height: 4px;
		border-radius: 999px;
		background: hsl(0 0% 91%);
		overflow: hidden;
	}

	.ctx-fill {
		width: 26%;
		height: 100%;
		border-radius: inherit;
		background: rgba(23, 23, 23, 0.75);
	}
</style>
