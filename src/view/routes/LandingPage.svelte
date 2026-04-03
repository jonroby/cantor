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
				<circle cx="70" cy="25" r="8.5" fill="#2b2b2b" />
				<circle cx="30" cy="60" r="8.5" fill="#4a4a4a" />
				<circle cx="70" cy="60" r="8.5" fill="#4a4a4a" />
				<circle cx="110" cy="60" r="8.5" fill="#4a4a4a" />
				<circle cx="30" cy="95" r="8.5" fill="#6e6e6e" />
				<circle cx="70" cy="95" r="8.5" fill="#6e6e6e" />
				<circle cx="110" cy="95" r="8.5" fill="#6e6e6e" />
				<circle cx="70" cy="130" r="8.5" fill="#949494" />
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
		background: #fafafa;
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
		background: rgba(250, 250, 250, 0.7);
	}

	.nav-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.logo {
		font-size: 20px;
		font-weight: 700;
		letter-spacing: -0.5px;
		color: #111;
	}

	.nav-right {
		display: flex;
		align-items: center;
		gap: 24px;
	}

	.nav-link {
		font-size: 14px;
		font-weight: 500;
		color: #555;
		text-decoration: none;
		transition: color 0.2s;
	}

	.nav-link:hover {
		color: #111;
	}

	.launch-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		background: #111;
		color: #fff;
		border: none;
		border-radius: 999px;
		padding: 8px 20px;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.2s;
	}

	.launch-btn:hover {
		background: #333;
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
		background: rgba(99, 102, 241, 0.08);
		border: 1px solid rgba(99, 102, 241, 0.2);
		border-radius: 999px;
		font-size: 13px;
		font-weight: 600;
		color: #6366f1;
		margin-bottom: 24px;
		letter-spacing: 0.02em;
	}

	.hero-title {
		font-size: clamp(48px, 10vw, 88px);
		font-weight: 800;
		line-height: 1.05;
		letter-spacing: 0.02em;
		color: #111;
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
		color: #666;
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
		background: #111;
		color: #fff;
		border: none;
		border-radius: 12px;
		font-size: 16px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.cta-primary:hover {
		background: #333;
		transform: translateY(-1px);
	}

	.cta-secondary {
		padding: 14px 32px;
		background: transparent;
		color: #333;
		border: 1px solid #ddd;
		border-radius: 12px;
		font-size: 16px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.cta-secondary:hover {
		border-color: #bbb;
		background: #fff;
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
		background: rgba(255, 255, 255, 0.8);
		backdrop-filter: blur(8px);
		border: 1px solid #e5e5e5;
		border-radius: 16px;
		padding: 28px 24px;
		text-align: left;
		transition: all 0.25s;
	}

	.feature-card:hover {
		border-color: #ccc;
		transform: translateY(-2px);
		box-shadow: 0 8px 30px rgba(0, 0, 0, 0.06);
	}

	.feature-icon {
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(99, 102, 241, 0.08);
		border-radius: 10px;
		margin-bottom: 14px;
		color: #6366f1;
	}

	.feature-card h3 {
		font-size: 15px;
		font-weight: 700;
		color: #111;
		margin: 0 0 6px;
	}

	.feature-card p {
		font-size: 13px;
		line-height: 1.5;
		color: #777;
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
