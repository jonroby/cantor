<script lang="ts">
	import type { CanvasNode, CanvasEdge, CodeEditorPosition } from '$lib/chat/layout';
	import type { Snippet } from 'svelte';
	import type { Shape, DrawingTool } from '$lib/drawing/types';
	import DrawingLayer from './DrawingLayer.svelte';

	const MIN_ZOOM = 0.1;
	const MAX_ZOOM = 2;

	interface Props {
		nodes: CanvasNode[];
		edges: CanvasEdge[];
		canvasWidth: number;
		canvasHeight: number;
		nodeWidth: number;
		renderNode: Snippet<[CanvasNode]>;
		codeEditor?: CodeEditorPosition;
		renderCodeEditor?: Snippet<[]>;
		pythonEditor?: CodeEditorPosition;
		renderPythonEditor?: Snippet<[]>;
		drawingMode?: boolean;
		drawingTool?: DrawingTool;
		shapes?: Shape[];
		onShapesChange?: (shapes: Shape[]) => void;
	}

	let {
		nodes,
		edges,
		canvasWidth,
		canvasHeight,
		nodeWidth,
		renderNode,
		codeEditor,
		renderCodeEditor,
		pythonEditor,
		renderPythonEditor,
		drawingMode = false,
		drawingTool = 'select',
		shapes = [],
		onShapesChange
	}: Props = $props();

	let containerEl: HTMLDivElement | null = $state(null);
	let tx = $state(0);
	let ty = $state(0);
	let scale = $state(1);
	let animating = $state(false);

	let isPanning = false;
	let lastPointerX = 0;
	let lastPointerY = 0;

	let nodeLookup = $derived(new Map(nodes.map((n) => [n.id, n])));

	function clamp(v: number, min: number, max: number) {
		return Math.min(Math.max(v, min), max);
	}

	function computeEdgePath(edge: CanvasEdge, lookup: Map<string, CanvasNode>): string {
		const source = lookup.get(edge.from);
		const target = lookup.get(edge.to);
		if (!source || !target) return '';
		const sx = source.x + nodeWidth / 2;
		const sy = source.y + source.height;
		const tx = target.x + nodeWidth / 2;
		const ty = target.y;
		const midY = (sy + ty) / 2;
		return `M ${sx} ${sy} C ${sx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`;
	}

	function onWheel(e: WheelEvent) {
		e.preventDefault();
		if (!containerEl) return;

		if (e.ctrlKey || e.metaKey) {
			const rect = containerEl.getBoundingClientRect();
			const mx = e.clientX - rect.left;
			const my = e.clientY - rect.top;
			const prevScale = scale;
			const next = clamp(prevScale * (1 - e.deltaY * 0.005), MIN_ZOOM, MAX_ZOOM);
			const ratio = next / prevScale;
			tx = mx - ratio * (mx - tx);
			ty = my - ratio * (my - ty);
			scale = next;
		} else {
			tx -= e.deltaX;
			ty -= e.deltaY;
		}
	}

	function onPointerDown(e: PointerEvent) {
		if (e.button !== 0) return;
		if (drawingMode) return;
		const target = e.target as HTMLElement;
		if (target.closest('.exchange-card') || target.closest('.code-editor-card')) return;
		isPanning = true;
		lastPointerX = e.clientX;
		lastPointerY = e.clientY;
		containerEl?.setPointerCapture(e.pointerId);
	}

	function onPointerMove(e: PointerEvent) {
		if (!isPanning) return;
		tx += e.clientX - lastPointerX;
		ty += e.clientY - lastPointerY;
		lastPointerX = e.clientX;
		lastPointerY = e.clientY;
	}

	function onPointerUp(e: PointerEvent) {
		if (!isPanning) return;
		isPanning = false;
		containerEl?.releasePointerCapture(e.pointerId);
	}

	export function setCenter(x: number, y: number, opts?: { zoom?: number; duration?: number }) {
		if (!containerEl) return;
		const targetScale = opts?.zoom ?? scale;
		const rect = containerEl.getBoundingClientRect();
		const targetTx = rect.width / 2 - x * targetScale;
		const targetTy = rect.height / 2 - y * targetScale;

		if (opts?.duration && opts.duration > 0) {
			animating = true;
			tx = targetTx;
			ty = targetTy;
			scale = targetScale;
			setTimeout(() => {
				animating = false;
			}, opts.duration);
		} else {
			tx = targetTx;
			ty = targetTy;
			scale = targetScale;
		}
	}

	export function scrollNodeToTop(
		nodeY: number,
		nodeCenterX: number,
		opts?: { zoom?: number; duration?: number; topOffset?: number }
	) {
		if (!containerEl) return;
		const targetScale = opts?.zoom ?? scale;
		const topOffset = opts?.topOffset ?? 60;
		const rect = containerEl.getBoundingClientRect();
		const targetTx = rect.width / 2 - nodeCenterX * targetScale;
		const targetTy = topOffset - nodeY * targetScale;

		if (opts?.duration && opts.duration > 0) {
			animating = true;
			tx = targetTx;
			ty = targetTy;
			scale = targetScale;
			setTimeout(() => {
				animating = false;
			}, opts.duration);
		} else {
			tx = targetTx;
			ty = targetTy;
			scale = targetScale;
		}
	}

	export function fitView(opts?: { duration?: number; maxZoom?: number }) {
		if (!containerEl || nodes.length === 0) return;
		const rect = containerEl.getBoundingClientRect();
		let minX = Infinity,
			minY = Infinity,
			maxX = -Infinity,
			maxY = -Infinity;
		for (const n of nodes) {
			minX = Math.min(minX, n.x);
			minY = Math.min(minY, n.y);
			maxX = Math.max(maxX, n.x + nodeWidth);
			maxY = Math.max(maxY, n.y + n.height);
		}
		const bbW = maxX - minX;
		const bbH = maxY - minY;
		const padding = 48;
		const fitScale = Math.min(
			(rect.width - padding * 2) / bbW,
			(rect.height - padding * 2) / bbH,
			opts?.maxZoom ?? 1
		);
		const cx = minX + bbW / 2;
		const cy = minY + bbH / 2;
		setCenter(cx, cy, { zoom: fitScale, duration: opts?.duration });
	}
</script>

<div
	class="canvas-container"
	bind:this={containerEl}
	onwheel={onWheel}
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
	role="application"
	style="--tx:{tx}px;--ty:{ty}px;--scale:{scale};{drawingMode && drawingTool !== 'select' ? 'cursor:crosshair' : ''}"
>
	<div class="canvas-layer" class:canvas-animating={animating}>
		<svg class="edges-svg" width={canvasWidth} height={canvasHeight}>
			{#each edges as edge (edge.id)}
				<path d={computeEdgePath(edge, nodeLookup)} class="edge-path" />
			{/each}
		</svg>
		{#each nodes as n (n.id)}
			<div class="canvas-node" style="left:{n.x}px;top:{n.y}px;width:{nodeWidth}px;">
				{@render renderNode(n)}
			</div>
		{/each}
		{#if codeEditor && renderCodeEditor}
			<div
				class="canvas-node"
				style="left:{codeEditor.x}px;top:{codeEditor.y}px;width:{codeEditor.width}px;"
			>
				{@render renderCodeEditor()}
			</div>
		{/if}
		{#if pythonEditor && renderPythonEditor}
			<div
				class="canvas-node"
				style="left:{pythonEditor.x}px;top:{pythonEditor.y}px;width:{pythonEditor.width}px;"
			>
				{@render renderPythonEditor()}
			</div>
		{/if}
		{#if drawingMode && onShapesChange}
			<DrawingLayer
				{shapes}
				activeTool={drawingTool}
				{onShapesChange}
				{canvasWidth}
				{canvasHeight}
			/>
		{/if}
	</div>
</div>

<style>
	.canvas-container {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		cursor: grab;
		touch-action: none;
		background-color: hsl(var(--background, 0 0% 100%));
		background-image: radial-gradient(circle, rgba(0, 0, 0, 0.12) 1px, transparent 1px);
		background-size: calc(18px * var(--scale)) calc(18px * var(--scale));
		background-position: var(--tx) var(--ty);
	}
	.canvas-container:active {
		cursor: grabbing;
	}
	.canvas-layer {
		position: absolute;
		top: 0;
		left: 0;
		transform-origin: 0 0;
		transform: translate(var(--tx), var(--ty)) scale(var(--scale));
	}
	.canvas-layer.canvas-animating {
		transition: transform 250ms ease;
	}
	.edges-svg {
		position: absolute;
		top: 0;
		left: 0;
		pointer-events: none;
		overflow: visible;
	}
	.edge-path {
		fill: none;
		stroke: hsl(var(--border, 0 0% 85%));
		stroke-width: 1.5;
	}
	.canvas-node {
		position: absolute;
	}
</style>
