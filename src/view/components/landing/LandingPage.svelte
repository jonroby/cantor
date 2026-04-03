<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowRight, GitBranch, Shield } from 'lucide-svelte';

	let canvas: HTMLCanvasElement;
	let animationId: number;
	let mouseX = -1000;
	let mouseY = -1000;

	const SPACING = 80;
	const MAX_RADIUS = 350;
	const BASE_DOT = 3;
	const MAX_DOT = 14;

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

		const cols = Math.ceil(w / SPACING) + 1;
		const rows = Math.ceil(h / SPACING) + 1;
		const offsetX = (w - (cols - 1) * SPACING) / 2;
		const offsetY = (h - (rows - 1) * SPACING) / 2;

		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				const x = offsetX + c * SPACING;
				const y = offsetY + r * SPACING;

				const dx = x - mouseX;
				const dy = y - mouseY;
				const dist = Math.sqrt(dx * dx + dy * dy);

				// concentric: closer to mouse = bigger & darker
				const t = dist < MAX_RADIUS ? 1 - dist / MAX_RADIUS : 0;
				const radius = BASE_DOT + t * (MAX_DOT - BASE_DOT);
				const opacity = 0.15 + t * 0.7;

				ctx.beginPath();
				ctx.arc(x, y, radius, 0, Math.PI * 2);
				ctx.fillStyle = `rgba(30, 30, 30, ${opacity})`;
				ctx.fill();
			}
		}

		ctx.restore();
		animationId = requestAnimationFrame(animate);
	}

	function handleResize() {
		if (!canvas) return;
		setupCanvas();
	}

	function handleMouseMove(e: MouseEvent) {
		mouseX = e.clientX;
		mouseY = e.clientY;
	}

	function goToApp() {
		window.location.hash = '#/';
	}

	onMount(() => {
		setupCanvas();
		animate();

		window.addEventListener('resize', handleResize);
		window.addEventListener('mousemove', handleMouseMove);

		return () => {
			cancelAnimationFrame(animationId);
			window.removeEventListener('resize', handleResize);
			window.removeEventListener('mousemove', handleMouseMove);
		};
	});
</script>

<div class="landing">
	<canvas bind:this={canvas} class="particle-canvas"></canvas>

	<nav class="nav">
		<div class="nav-left">
			<svg
				class="logo-icon"
				width="35"
				height="40"
				viewBox="0 0 140 160"
				xmlns="http://www.w3.org/2000/svg"
			>
				<circle cx="70" cy="25" r="8.5" fill="hsl(var(--foreground))" />
				<circle cx="30" cy="60" r="8.5" fill="hsl(var(--foreground)/0.65)" />
				<circle cx="70" cy="60" r="8.5" fill="hsl(var(--foreground)/0.65)" />
				<circle cx="110" cy="60" r="8.5" fill="hsl(var(--foreground)/0.65)" />
				<circle cx="30" cy="95" r="8.5" fill="hsl(var(--foreground)/0.4)" />
				<circle cx="70" cy="95" r="8.5" fill="hsl(var(--foreground)/0.4)" />
				<circle cx="110" cy="95" r="8.5" fill="hsl(var(--foreground)/0.4)" />
				<circle cx="70" cy="130" r="8.5" fill="hsl(var(--foreground)/0.2)" />
			</svg>
			<span class="logo">Powerset Labs</span>
		</div>
		<div class="nav-right">
			<a href="#/landing" class="nav-link">Features</a>
			<a href="https://github.com" class="nav-link" target="_blank" rel="noopener">GitHub</a>
			<button class="launch-btn" onclick={goToApp}>
				Launch App
				<ArrowRight size={16} />
			</button>
		</div>
	</nav>

	<main class="hero">
		<div class="hero-badge">Side Chat Interface</div>
		<h1 class="hero-title">
			<span class="gradient-text">CANTOR</span>
		</h1>
		<p class="hero-subtitle">
			Copy conversations. Explore side chats. Visualize your thinking on a canvas. One interface for
			Claude, Gemini, Ollama, OpenAI, and WebLLM.
		</p>
		<div class="hero-actions">
			<button class="cta-primary" onclick={goToApp}>
				Start Chatting
				<ArrowRight size={18} strokeWidth={2.5} />
			</button>
			<button class="cta-secondary" onclick={goToApp}>See Features</button>
		</div>

		<div class="features-grid">
			<div class="feature-card">
				<div class="feature-icon">
					<GitBranch size={24} />
				</div>
				<h3>Side Chat Conversations</h3>
				<p>Copy any message to explore alternative directions without losing context.</p>
			</div>
			<div class="feature-card">
				<div class="feature-icon">
					<svg
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<rect x="3" y="3" width="18" height="18" rx="2" />
						<circle cx="9" cy="9" r="2" />
						<circle cx="15" cy="15" r="2" />
						<path d="M9 15h6" />
						<path d="M9 9h.01" />
					</svg>
				</div>
				<h3>Canvas View</h3>
				<p>Visualize your entire conversation tree as a zoomable node graph.</p>
			</div>
			<div class="feature-card">
				<div class="feature-icon">
					<svg
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M12 2v4" />
						<path d="m6.93 6.93 2.83 2.83" />
						<path d="M2 12h4" />
						<path d="m6.93 17.07 2.83-2.83" />
						<path d="M12 18v4" />
						<path d="m17.07 17.07-2.83-2.83" />
						<path d="M22 12h-4" />
						<path d="m17.07 6.93-2.83 2.83" />
					</svg>
				</div>
				<h3>Multi-Provider</h3>
				<p>Claude, Gemini, Ollama, OpenAI-compatible, and WebLLM — all in one place.</p>
			</div>
			<div class="feature-card">
				<div class="feature-icon">
					<Shield size={24} />
				</div>
				<h3>Local-First</h3>
				<p>All data stays in your browser. No accounts, no servers, no tracking.</p>
			</div>
		</div>
	</main>
</div>

<style>
	.landing {
		position: relative;
		min-height: 100vh;
		background: hsl(var(--background));
		font-family: 'Inter', ui-sans-serif, sans-serif;
		overflow-x: hidden;
	}

	.particle-canvas {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		z-index: 0;
	}

	/* Nav */
	.nav {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 40px;
		z-index: 10;
		backdrop-filter: blur(12px);
		background: hsl(var(--background) / 0.7);
	}

	.nav-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.logo {
		font-size: var(--text-xl);
		font-weight: 700;
		letter-spacing: -0.5px;
		color: hsl(var(--foreground));
	}

	.nav-right {
		display: flex;
		align-items: center;
		gap: 24px;
	}

	.nav-link {
		font-size: var(--text-md);
		font-weight: 500;
		color: hsl(var(--muted-foreground));
		text-decoration: none;
		transition: color 0.2s;
	}

	.nav-link:hover {
		color: hsl(var(--foreground));
	}

	.launch-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		background: hsl(var(--primary));
		color: hsl(var(--primary-foreground));
		border: none;
		border-radius: var(--radius-full);
		padding: 8px 20px;
		font-size: var(--text-md);
		font-weight: 600;
		cursor: pointer;
		transition: opacity 0.2s;
	}

	.launch-btn:hover {
		opacity: 0.88;
	}

	/* Hero */
	.hero {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: 160px 24px 80px;
		max-width: 900px;
		margin: 0 auto;
	}

	.hero-badge {
		display: inline-flex;
		align-items: center;
		padding: 6px 16px;
		background: hsl(var(--accent));
		border: 1px solid hsl(var(--border));
		border-radius: var(--radius-full);
		font-size: var(--text-base);
		font-weight: 600;
		color: hsl(var(--accent-foreground));
		margin-bottom: 24px;
		letter-spacing: 0.02em;
	}

	.hero-title {
		font-size: clamp(48px, 10vw, 88px);
		font-weight: 800;
		line-height: 1.05;
		letter-spacing: 0.02em;
		color: hsl(var(--foreground));
		margin: 0 0 20px;
	}

	.gradient-text {
		background: linear-gradient(135deg, #6366f1 0%, #ec4899 50%, #f59e0b 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.hero-subtitle {
		font-size: 18px;
		line-height: 1.6;
		color: hsl(var(--muted-foreground));
		max-width: 560px;
		margin: 0 0 36px;
	}

	.hero-actions {
		display: flex;
		gap: 12px;
		margin-bottom: 80px;
	}

	.cta-primary {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 14px 32px;
		background: hsl(var(--primary));
		color: hsl(var(--primary-foreground));
		border: none;
		border-radius: var(--radius-lg);
		font-size: var(--text-lg);
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.cta-primary:hover {
		opacity: 0.88;
		transform: translateY(-1px);
	}

	.cta-secondary {
		padding: 14px 32px;
		background: transparent;
		color: hsl(var(--foreground));
		border: 1px solid hsl(var(--border));
		border-radius: var(--radius-lg);
		font-size: var(--text-lg);
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.cta-secondary:hover {
		background: hsl(var(--accent));
	}

	/* Features */
	.features-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 20px;
		width: 100%;
		max-width: 700px;
	}

	.feature-card {
		background: hsl(var(--card) / 0.8);
		backdrop-filter: blur(8px);
		border: 1px solid hsl(var(--border));
		border-radius: var(--radius-lg);
		padding: 28px 24px;
		text-align: left;
		transition: all 0.25s;
	}

	.feature-card:hover {
		border-color: hsl(var(--ring));
		transform: translateY(-2px);
		box-shadow: 0 8px 30px hsl(var(--foreground) / 0.06);
	}

	.feature-icon {
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: hsl(var(--accent));
		border-radius: var(--radius-md);
		margin-bottom: 14px;
		color: hsl(var(--accent-foreground));
	}

	.feature-card h3 {
		font-size: var(--text-md);
		font-weight: 700;
		color: hsl(var(--foreground));
		margin: 0 0 6px;
	}

	.feature-card p {
		font-size: var(--text-base);
		line-height: 1.5;
		color: hsl(var(--muted-foreground));
		margin: 0;
	}

	@media (max-width: 640px) {
		.nav {
			padding: 12px 20px;
		}
		.nav-link {
			display: none;
		}
		.hero {
			padding: 120px 20px 60px;
		}
		.hero-actions {
			flex-direction: column;
			width: 100%;
		}
		.cta-primary,
		.cta-secondary {
			width: 100%;
			justify-content: center;
		}
		.features-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
