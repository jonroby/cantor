<script lang="ts">
	import { onMount } from 'svelte';

	let canvas: HTMLCanvasElement;
	let animationId: number;

	interface Dot {
		x: number;
		y: number;
		vx: number;
		vy: number;
		r: number;
		opacity: number;
	}

	let dots: Dot[] = [];

	function initDots(w: number, h: number) {
		dots = Array.from({ length: 55 }, () => ({
			x: Math.random() * w,
			y: Math.random() * h,
			vx: (Math.random() - 0.5) * 0.3,
			vy: (Math.random() - 0.5) * 0.3,
			r: 2 + Math.random() * 3.5,
			opacity: 0.07 + Math.random() * 0.15
		}));
	}

	function animate() {
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const dpr = window.devicePixelRatio || 1;
		const w = canvas.width / dpr;
		const h = canvas.height / dpr;

		ctx.save();
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, w, h);

		for (const d of dots) {
			d.x += d.vx;
			d.y += d.vy;
			if (d.x < -10) d.x = w + 10;
			if (d.x > w + 10) d.x = -10;
			if (d.y < -10) d.y = h + 10;
			if (d.y > h + 10) d.y = -10;

			ctx.beginPath();
			ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
			ctx.fillStyle = `rgba(23, 23, 23, ${d.opacity})`;
			ctx.fill();
		}

		ctx.restore();
		animationId = requestAnimationFrame(animate);
	}

	function setupCanvas() {
		const dpr = window.devicePixelRatio || 1;
		const w = window.innerWidth;
		const h = window.innerHeight;
		canvas.width = w * dpr;
		canvas.height = h * dpr;
		canvas.style.width = w + 'px';
		canvas.style.height = h + 'px';
		const ctx = canvas.getContext('2d');
		if (ctx) ctx.scale(dpr, dpr);
		initDots(w, h);
	}

	function goToApp() {
		window.location.hash = '#/';
	}

	onMount(() => {
		setupCanvas();
		animate();
		const onResize = () => setupCanvas();
		window.addEventListener('resize', onResize);
		return () => {
			cancelAnimationFrame(animationId);
			window.removeEventListener('resize', onResize);
		};
	});
</script>

<div class="landing">
	<canvas bind:this={canvas} class="bg-canvas"></canvas>

	<!-- Top-left logo -->
	<div class="logo-area">
		<svg width="36" height="41" viewBox="0 0 140 160" xmlns="http://www.w3.org/2000/svg">
			<circle cx="70" cy="25" r="8.5" fill="hsl(var(--foreground))" />
			<circle cx="30" cy="60" r="8.5" fill="hsl(var(--foreground)/0.65)" />
			<circle cx="70" cy="60" r="8.5" fill="hsl(var(--foreground)/0.65)" />
			<circle cx="110" cy="60" r="8.5" fill="hsl(var(--foreground)/0.65)" />
			<circle cx="30" cy="95" r="8.5" fill="hsl(var(--foreground)/0.4)" />
			<circle cx="70" cy="95" r="8.5" fill="hsl(var(--foreground)/0.4)" />
			<circle cx="110" cy="95" r="8.5" fill="hsl(var(--foreground)/0.4)" />
			<circle cx="70" cy="130" r="8.5" fill="hsl(var(--foreground)/0.2)" />
		</svg>
		<span class="logo-name">Cantor</span>
		<span class="alpha-badge">Alpha</span>
	</div>

	<!-- Hero -->
	<div class="hero">
		<h1 class="tagline">LLMs for Power Users</h1>
		<p class="subline">For long running chat sessions</p>
		<div class="btn-row">
			<button class="start-btn" onclick={goToApp}>
				<svg width="22" height="25" viewBox="0 0 140 160" xmlns="http://www.w3.org/2000/svg">
					<circle cx="70" cy="25" r="8.5" fill="white" />
					<circle cx="30" cy="60" r="8.5" fill="white" />
					<circle cx="70" cy="60" r="8.5" fill="white" />
					<circle cx="110" cy="60" r="8.5" fill="white" />
					<circle cx="30" cy="95" r="8.5" fill="white" />
					<circle cx="70" cy="95" r="8.5" fill="white" />
					<circle cx="110" cy="95" r="8.5" fill="white" />
					<circle cx="70" cy="130" r="8.5" fill="white" />
				</svg>
				Get Started
			</button>
			<button class="key-btn">Request a Key</button>
		</div>
	</div>

	<!-- App preview — wide, cropped at bottom -->
	<div class="preview-wrap">
		<div class="preview">
			<!-- Window chrome -->
			<div class="preview-chrome">
				<div class="chrome-dots">
					<span class="dot dot-red"></span>
					<span class="dot dot-yellow"></span>
					<span class="dot dot-green"></span>
				</div>
				<div class="chrome-tabs">
					<span class="chrome-tab active">Chat</span>
					<span class="chrome-tab">Canvas</span>
					<span class="chrome-tab">Documents</span>
				</div>
			</div>
			<!-- Window body -->
			<div class="preview-body">
				<!-- Sidebar -->
				<div class="preview-sidebar">
					<div class="sidebar-item active-item">
						<div class="item-dot"></div>
						<div class="item-lines">
							<div class="item-line long"></div>
							<div class="item-line short"></div>
						</div>
					</div>
					<div class="sidebar-item">
						<div class="item-dot dim"></div>
						<div class="item-lines">
							<div class="item-line long dim"></div>
							<div class="item-line med dim"></div>
						</div>
					</div>
					<div class="sidebar-item">
						<div class="item-dot dim"></div>
						<div class="item-lines">
							<div class="item-line med dim"></div>
							<div class="item-line short dim"></div>
						</div>
					</div>
					<div class="sidebar-item">
						<div class="item-dot dim"></div>
						<div class="item-lines">
							<div class="item-line long dim"></div>
							<div class="item-line long dim"></div>
						</div>
					</div>
				</div>

				<!-- Chat -->
				<div class="preview-chat">
					<div class="chat-messages">
						<!-- Assistant msg 1 -->
						<div class="msg assistant">
							<div class="msg-avatar"></div>
							<div class="msg-bubble assistant-bubble">
								<div class="msg-line full"></div>
								<div class="msg-line three-quarter"></div>
							</div>
						</div>
						<!-- User msg 1 -->
						<div class="msg user">
							<div class="user-pill">
								<div class="msg-line half"></div>
							</div>
						</div>
						<!-- Assistant msg 2 -->
						<div class="msg assistant">
							<div class="msg-avatar"></div>
							<div class="msg-bubble assistant-bubble">
								<div class="msg-line full"></div>
								<div class="msg-line two-thirds"></div>
								<div class="code-block">
									<div class="code-line short code-dim"></div>
									<div class="code-line full code-bright"></div>
									<div class="code-line med code-bright"></div>
									<div class="code-line long code-dim"></div>
									<div class="code-line full code-bright"></div>
								</div>
								<div class="msg-line half"></div>
							</div>
						</div>
						<!-- User msg 2 -->
						<div class="msg user">
							<div class="user-pill">
								<div class="msg-line two-thirds"></div>
							</div>
						</div>
					</div>
					<div class="chat-input-area">
						<div class="chat-input-bar">
							<div class="input-placeholder"></div>
							<div class="input-send"></div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.landing {
		position: relative;
		min-height: 100vh;
		background: hsl(var(--background));
		overflow: hidden;
	}

	.bg-canvas {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		z-index: 0;
	}

	/* Logo */
	.logo-area {
		position: fixed;
		top: 22px;
		left: 28px;
		display: flex;
		align-items: center;
		gap: 8px;
		z-index: 10;
	}

	.logo-name {
		font-size: 24px;
		font-weight: var(--font-weight-semibold);
		color: hsl(var(--foreground) / 0.88);
		margin-bottom: 3px;
	}

	.alpha-badge {
		display: inline-flex;
		align-items: center;
		margin-top: 3px;
		margin-left: 0.25rem;
		border: 1px solid hsl(215 80% 45%);
		border-radius: 9999px;
		background: hsl(215 90% 92%);
		padding: 0.125rem 0.45rem;
		font-size: 11px;
		font-weight: var(--font-weight-normal);
		line-height: 1.2;
		color: hsl(215 80% 35%);
	}

	/* Hero */
	.hero {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding-top: 8vh;
		padding-bottom: 40px;
	}

	.tagline {
		font-size: 52px;
		font-weight: var(--font-weight-bold);
		color: hsl(var(--foreground));
		margin: 0 0 12px;
		letter-spacing: -1.5px;
		line-height: 1.1;
	}

	.subline {
		font-size: 17px;
		font-weight: var(--font-weight-normal);
		color: hsl(var(--muted-foreground));
		margin: 0 0 32px;
	}

	.start-btn {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 14px 32px 14px 22px;
		background: hsl(0 0% 12%);
		color: white;
		border: none;
		border-radius: var(--radius-full);
		font-size: 16px;
		font-weight: var(--font-weight-semibold);
		cursor: pointer;
		transition: opacity 0.15s;
		letter-spacing: -0.1px;
		box-shadow:
			0 2px 4px rgba(0, 0, 0, 0.06),
			0 8px 24px rgba(0, 0, 0, 0.1);
	}

	.btn-row {
		display: flex;
		align-items: center;
		gap: 40px;
	}

	.key-btn {
		height: 53px;
		padding: 0 36px;
		background: white;
		color: hsl(var(--foreground));
		border: 1px solid hsl(var(--border));
		border-radius: var(--radius-full);
		font-size: 16px;
		font-weight: var(--font-weight-semibold);
		cursor: pointer;
		transition: opacity 0.15s;
		letter-spacing: -0.1px;
		box-shadow:
			0 2px 4px rgba(0, 0, 0, 0.06),
			0 8px 24px rgba(0, 0, 0, 0.1);
	}

	.key-btn:hover {
		opacity: 0.9;
	}

	.start-btn svg {
		transform: translateX(-5px);
	}

	.start-btn:hover {
		opacity: 0.85;
	}

	/* Preview */
	.preview-wrap {
		position: relative;
		z-index: 1;
		display: flex;
		justify-content: center;
		padding: 0 32px;
	}

	.preview {
		width: min(1100px, calc(100vw - 32px));
		border-radius: 12px 12px 0 0;
		border: 1px solid hsl(var(--border));
		border-bottom: none;
		background: hsl(var(--card));
		box-shadow:
			0 4px 16px hsl(var(--foreground) / 0.06),
			0 24px 64px hsl(var(--foreground) / 0.1);
		overflow: hidden;
	}

	/* Chrome bar */
	.preview-chrome {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 11px 16px;
		background: hsl(var(--muted));
		border-bottom: 1px solid hsl(var(--border));
	}

	.chrome-dots {
		display: flex;
		gap: 5px;
		flex-shrink: 0;
	}

	.dot {
		width: 11px;
		height: 11px;
		border-radius: 50%;
	}
	.dot-red {
		background: #ff5f57;
	}
	.dot-yellow {
		background: #febc2e;
	}
	.dot-green {
		background: #28c840;
	}

	.chrome-tabs {
		display: flex;
		gap: 2px;
	}

	.chrome-tab {
		font-size: 12px;
		font-weight: var(--font-weight-medium);
		color: hsl(var(--muted-foreground));
		padding: 5px 14px;
		border-radius: var(--radius-sm);
		cursor: default;
	}

	.chrome-tab.active {
		background: hsl(var(--background));
		color: hsl(var(--foreground));
		border: 1px solid hsl(var(--border));
	}

	/* Body */
	.preview-body {
		display: flex;
		height: 560px;
	}

	/* Sidebar */
	.preview-sidebar {
		width: 240px;
		flex-shrink: 0;
		border-right: 1px solid hsl(var(--border));
		padding: 14px 10px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		background: hsl(var(--sidebar));
	}

	.sidebar-item {
		display: flex;
		align-items: flex-start;
		gap: 9px;
		padding: 9px 8px;
		border-radius: var(--radius-sm);
	}

	.sidebar-item.active-item {
		background: hsl(var(--sidebar-accent));
	}

	.item-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: hsl(var(--foreground) / 0.65);
		margin-top: 4px;
		flex-shrink: 0;
	}

	.item-dot.dim {
		background: hsl(var(--foreground) / 0.18);
	}

	.item-lines {
		display: flex;
		flex-direction: column;
		gap: 5px;
		flex: 1;
	}

	.item-line {
		height: 7px;
		border-radius: 3px;
		background: hsl(var(--foreground) / 0.55);
	}

	.item-line.dim {
		background: hsl(var(--foreground) / 0.13);
	}

	.item-line.long {
		width: 88%;
	}
	.item-line.med {
		width: 62%;
	}
	.item-line.short {
		width: 42%;
	}

	/* Chat */
	.preview-chat {
		flex: 1;
		display: flex;
		flex-direction: column;
		background: hsl(var(--background));
	}

	.chat-messages {
		flex: 1;
		padding: 24px 28px;
		display: flex;
		flex-direction: column;
		gap: 22px;
		overflow: hidden;
	}

	.msg {
		display: flex;
		gap: 12px;
	}

	.msg.user {
		justify-content: flex-end;
	}

	.msg-avatar {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: hsl(var(--foreground) / 0.13);
		flex-shrink: 0;
		margin-top: 2px;
	}

	.msg-bubble {
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-width: 68%;
	}

	.assistant-bubble {
		align-items: flex-start;
	}

	/* User messages: dark pill like Railway */
	.user-pill {
		background: hsl(0 0% 14%);
		padding: 11px 18px;
		border-radius: 20px;
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.user-pill .msg-line {
		background: rgba(255 255 255 / 0.75);
	}

	.msg-line {
		height: 8px;
		border-radius: 4px;
		background: hsl(var(--foreground) / 0.16);
	}

	.msg-line.full {
		width: 100%;
		min-width: 220px;
	}
	.msg-line.three-quarter {
		width: 75%;
		min-width: 165px;
	}
	.msg-line.two-thirds {
		width: 66%;
		min-width: 145px;
	}
	.msg-line.half {
		width: 50%;
		min-width: 100px;
	}

	.code-block {
		background: hsl(var(--muted));
		border: 1px solid hsl(var(--border));
		border-radius: var(--radius-sm);
		padding: 10px 14px;
		display: flex;
		flex-direction: column;
		gap: 5px;
		width: 100%;
		min-width: 260px;
		margin: 2px 0;
	}

	.code-line {
		height: 7px;
		border-radius: 3px;
	}

	.code-line.code-bright {
		background: hsl(var(--foreground) / 0.5);
	}
	.code-line.code-dim {
		background: hsl(var(--foreground) / 0.22);
	}
	.code-line.short {
		width: 28%;
	}
	.code-line.med {
		width: 52%;
	}
	.code-line.long {
		width: 72%;
	}
	.code-line.full {
		width: 94%;
	}

	/* Input */
	.chat-input-area {
		padding: 14px 28px;
		border-top: 1px solid hsl(var(--border));
	}

	.chat-input-bar {
		display: flex;
		align-items: center;
		gap: 10px;
		border: 1px solid hsl(var(--border));
		border-radius: var(--radius-lg);
		padding: 11px 14px;
		background: hsl(var(--background));
	}

	.input-placeholder {
		flex: 1;
		height: 8px;
		border-radius: 4px;
		background: hsl(var(--foreground) / 0.09);
	}

	.input-send {
		width: 30px;
		height: 30px;
		border-radius: var(--radius-sm);
		background: hsl(var(--primary));
		opacity: 0.45;
		flex-shrink: 0;
	}
</style>
