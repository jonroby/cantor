<script lang="ts">
	import { onMount } from 'svelte';

	interface Particle {
		x: number;
		y: number;
		vx: number;
		vy: number;
		size: number;
		color: string;
		rotation: number;
		rotationSpeed: number;
		shape: 'rect' | 'circle' | 'line';
		opacity: number;
	}

	let canvas: HTMLCanvasElement;
	let particles: Particle[] = [];
	let animationId: number;

	const colors = [
		'#6366f1', // indigo
		'#8b5cf6', // violet
		'#ec4899', // pink
		'#f43f5e', // rose
		'#3b82f6', // blue
		'#06b6d4', // cyan
		'#10b981', // emerald
		'#f59e0b' // amber
	];

	function createParticle(): Particle {
		const shape = (['rect', 'circle', 'line'] as const)[Math.floor(Math.random() * 3)];
		return {
			x: Math.random() * window.innerWidth,
			y: Math.random() * window.innerHeight,
			vx: (Math.random() - 0.5) * 0.4,
			vy: (Math.random() - 0.5) * 0.4,
			size: Math.random() * 6 + 2,
			color: colors[Math.floor(Math.random() * colors.length)],
			rotation: Math.random() * Math.PI * 2,
			rotationSpeed: (Math.random() - 0.5) * 0.02,
			shape,
			opacity: Math.random() * 0.5 + 0.2
		};
	}

	function animate() {
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		ctx.clearRect(0, 0, canvas.width, canvas.height);

		for (const p of particles) {
			p.x += p.vx;
			p.y += p.vy;
			p.rotation += p.rotationSpeed;

			// wrap around
			if (p.x < -20) p.x = canvas.width + 20;
			if (p.x > canvas.width + 20) p.x = -20;
			if (p.y < -20) p.y = canvas.height + 20;
			if (p.y > canvas.height + 20) p.y = -20;

			ctx.save();
			ctx.translate(p.x, p.y);
			ctx.rotate(p.rotation);
			ctx.globalAlpha = p.opacity;
			ctx.fillStyle = p.color;
			ctx.strokeStyle = p.color;

			if (p.shape === 'rect') {
				ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.4);
			} else if (p.shape === 'circle') {
				ctx.beginPath();
				ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
				ctx.fill();
			} else {
				ctx.lineWidth = 1.5;
				ctx.beginPath();
				ctx.moveTo(-p.size, 0);
				ctx.lineTo(p.size, 0);
				ctx.stroke();
			}

			ctx.restore();
		}

		animationId = requestAnimationFrame(animate);
	}

	function handleResize() {
		if (!canvas) return;
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
	}

	function goToApp() {
		window.location.hash = '#/';
	}

	onMount(() => {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;

		for (let i = 0; i < 120; i++) {
			particles.push(createParticle());
		}

		animate();

		window.addEventListener('resize', handleResize);

		return () => {
			cancelAnimationFrame(animationId);
			window.removeEventListener('resize', handleResize);
		};
	});
</script>

<div class="landing">
	<canvas bind:this={canvas} class="particle-canvas"></canvas>

	<nav class="nav">
		<div class="nav-left">
			<span class="logo">Superset</span>
		</div>
		<div class="nav-right">
			<a href="#/landing" class="nav-link">Features</a>
			<a href="https://github.com" class="nav-link" target="_blank" rel="noopener">GitHub</a>
			<button class="launch-btn" onclick={goToApp}>
				Launch App
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M5 12h14" />
					<path d="m12 5 7 7-7 7" />
				</svg>
			</button>
		</div>
	</nav>

	<main class="hero">
		<div class="hero-badge">Branching Chat Interface</div>
		<h1 class="hero-title">
			LLMs for
			<span class="gradient-text">Power Users</span>
		</h1>
		<p class="hero-subtitle">
			Fork conversations. Explore side branches. Visualize your thinking on a canvas. One interface
			for Claude, Gemini, Ollama, OpenAI, and WebLLM.
		</p>
		<div class="hero-actions">
			<button class="cta-primary" onclick={goToApp}>
				Start Chatting
				<svg
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M5 12h14" />
					<path d="m12 5 7 7-7 7" />
				</svg>
			</button>
			<button class="cta-secondary" onclick={goToApp}>See Features</button>
		</div>

		<div class="features-grid">
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
						<path d="M6 3v12" />
						<circle cx="18" cy="6" r="3" />
						<circle cx="6" cy="18" r="3" />
						<path d="M18 9a9 9 0 0 1-9 9" />
					</svg>
				</div>
				<h3>Branching Conversations</h3>
				<p>Fork any message to explore alternative directions without losing context.</p>
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
						<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
					</svg>
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
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
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
		font-size: clamp(40px, 8vw, 72px);
		font-weight: 800;
		line-height: 1.05;
		letter-spacing: -2px;
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
