<script lang="ts">
	import { onMount } from 'svelte';
	import AppScreenRecording from './AppScreenRecording.svelte';

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

	<!-- App preview — animated SVG screen recording -->
	<div class="preview-wrap">
		<div class="preview">
			<AppScreenRecording />
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
		padding: 0 32px 64px;
	}

	.preview {
		width: 960px;
		max-width: 100%;
		border-radius: 12px;
		box-shadow:
			0 4px 16px hsl(var(--foreground) / 0.06),
			0 24px 64px hsl(var(--foreground) / 0.1);
		overflow: hidden;
	}
</style>
