<section class="panel">

	<div class="title-block">
		<h2 class="heading"><span class="accent">Experimental</span> View</h2>
		<p class="title-desc">Chat Tree and other features in early development.</p>
	</div>

	<div class="demo">
		<video
			class="video"
			src="/experimental.mp4"
			autoplay
			loop
			muted
			playsinline
		></video>
	</div>

</section>

<style>
	.panel {
		height: 100vh;
		flex-shrink: 0;
		scroll-snap-align: start;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		padding: 80px 48px 64px;
		box-sizing: border-box;
		font-family: Inter, system-ui, sans-serif;
		border-top: 1px solid rgba(23,23,23,0.06);
		background: hsl(0 0% 98.5%);
	}

	.title-block {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.heading {
		font-size: clamp(36px, 4.5vw, 56px);
		font-weight: 800;
		letter-spacing: -2px;
		color: rgba(23,23,23,0.92);
		margin: 0 0 10px;
		text-align: center;
	}

	.accent {
		background: linear-gradient(90deg, hsl(158 85% 40%), hsl(175 90% 38%));
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.title-desc {
		font-size: 16px;
		color: rgba(23,23,23,0.45);
		margin: 0;
		text-align: center;
	}

	.demo {
		flex: 1;
		width: 100%;
		max-width: 1100px;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 0;
		padding: 32px 0;
	}

	.video {
		width: 100%;
		display: block;
		border-radius: 14px;
		box-shadow:
			0 0 0 1px rgba(23,23,23,0.08),
			0 8px 24px rgba(0,0,0,0.1);
	}
</style>
