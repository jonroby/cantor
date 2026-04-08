<script lang="ts">
	import { onMount } from 'svelte';
	import { gsap } from 'gsap';

	// Dot layout matches the existing logo: 4 rows
	// Row 0 (top):    [1 dot]   — darkest green
	// Row 1:          [3 dots]
	// Row 2:          [3 dots]
	// Row 3 (bottom): [1 dot]   — lightest green

	// Colors: top = hsl(158 85% 38%), bottom = hsl(175 85% 62%)
	// Interpolated per row
	const dotColors = [
		'hsl(158, 85%, 38%)', // row 0 — top, darkest
		'hsl(162, 85%, 46%)', // row 1
		'hsl(168, 85%, 54%)', // row 2
		'hsl(175, 85%, 62%)' // row 3 — bottom, lightest
	];

	// Dot positions [col, row] — same layout as existing logo
	// Row 0: center
	// Row 1: left, center, right
	// Row 2: left, center, right
	// Row 3: center
	const dots = [
		{ col: 1, row: 0 }, // 0: top
		{ col: 0, row: 1 }, // 1: mid-left
		{ col: 1, row: 1 }, // 2: mid-center
		{ col: 2, row: 1 }, // 3: mid-right
		{ col: 0, row: 2 }, // 4: lower-left
		{ col: 1, row: 2 }, // 5: lower-center
		{ col: 2, row: 2 }, // 6: lower-right
		{ col: 1, row: 3 } // 7: bottom
	];

	// Lines: [from-dot-index, to-dot-index]
	// Bottom (row3) → lower row (row2): straight up center
	// Lower (row2) → mid (row1): criss-cross
	// Mid (row1) → top (row0): converge
	const lines = [
		// bottom → lower row (fan out)
		[7, 4], // bottom → lower-left
		[7, 5], // bottom → lower-center
		[7, 6], // bottom → lower-right
		// lower → mid (criss-cross)
		[5, 1], // lower-center → mid-left   (cross)
		[5, 3], // lower-center → mid-right  (cross)
		[4, 2], // lower-left → mid-center   (cross)
		[6, 2], // lower-right → mid-center  (cross)
		[4, 1], // lower-left → mid-left     (straight)
		[6, 3], // lower-right → mid-right   (straight)
		// mid → top (converge)
		[1, 0], // mid-left → top
		[2, 0], // mid-center → top
		[3, 0] // mid-right → top
	];

	const R = 7; // dot radius
	const GAP_X = 28; // horizontal spacing
	const GAP_Y = 24; // vertical spacing
	const PAD = 10;

	function dotX(d: (typeof dots)[0]) {
		return PAD + d.col * GAP_X;
	}
	function dotY(d: (typeof dots)[0]) {
		return PAD + d.row * GAP_Y;
	}

	const W = PAD * 2 + 2 * GAP_X;
	const H = PAD * 2 + 3 * GAP_Y;

	let svgEl: SVGSVGElement;

	onMount(() => {
		const lineEls = Array.from(svgEl.querySelectorAll<SVGLineElement>('line'));
		const dotEls = Array.from(svgEl.querySelectorAll<SVGCircleElement>('circle'));

		const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.8 });

		// Reset
		gsap.set(lineEls, { strokeDashoffset: 60, opacity: 0 });
		gsap.set(dotEls, { opacity: 0, attr: { r: 0 } });

		// 1. Dots appear bottom to top
		[7, 4, 5, 6, 1, 2, 3, 0].forEach((di, i) => {
			tl.to(
				dotEls[di],
				{ opacity: 1, attr: { r: R }, duration: 0.18, ease: 'back.out(2)' },
				i * 0.06
			);
		});

		// 2. Lines draw bottom to top (staggered)
		lines.forEach((_, i) => {
			tl.to(
				lineEls[i],
				{ strokeDashoffset: 0, opacity: 1, duration: 0.35, ease: 'power2.out' },
				0.5 + i * 0.07
			);
		});

		// 3. Hold
		tl.to({}, { duration: 1.2 });

		// 4. Fade all out
		tl.to([...lineEls, ...dotEls], { opacity: 0, duration: 0.3, ease: 'power2.in' });
		tl.set(dotEls, { attr: { r: 0 } });
		tl.set(lineEls, { strokeDashoffset: 60 });
		tl.to({}, { duration: 0.2 });
	});
</script>

<svg
	bind:this={svgEl}
	width={W}
	height={H}
	viewBox="0 0 {W} {H}"
	xmlns="http://www.w3.org/2000/svg"
>
	<!-- Lines (drawn first, behind dots) -->
	{#each lines as [from, to] (from + '-' + to)}
		<line
			x1={dotX(dots[from])}
			y1={dotY(dots[from])}
			x2={dotX(dots[to])}
			y2={dotY(dots[to])}
			stroke="hsl(165, 80%, 48%)"
			stroke-width="1.5"
			stroke-linecap="round"
			stroke-dasharray="60"
			stroke-dashoffset="60"
			opacity="0"
		/>
	{/each}

	<!-- Dots -->
	{#each dots as d (d.col + '-' + d.row)}
		<circle cx={dotX(d)} cy={dotY(d)} r={R} fill={dotColors[d.row]} opacity="0" />
	{/each}
</svg>
