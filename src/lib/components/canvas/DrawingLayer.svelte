<script lang="ts">
	import {
		type Shape,
		type DrawingTool,
		type Point,
		generateShapeId
	} from '$lib/drawing/types';

	interface Props {
		shapes: Shape[];
		activeTool: DrawingTool;
		onShapesChange: (shapes: Shape[]) => void;
		canvasWidth: number;
		canvasHeight: number;
	}

	let { shapes, activeTool, onShapesChange, canvasWidth, canvasHeight }: Props = $props();

	let drawing = $state(false);
	let startPoint: Point | null = $state(null);
	let currentPoint: Point | null = $state(null);
	let selectedId: string | null = $state(null);
	let dragOffset: Point | null = $state(null);
	let penPoints: Point[] = $state([]);

	const STROKE_COLOR = '#374151';
	const STROKE_WIDTH = 2;
	const FILL_COLOR = 'transparent';

	function svgPoint(e: PointerEvent): Point {
		const svg = e.currentTarget as SVGSVGElement;
		const rect = svg.getBoundingClientRect();
		const scaleX = canvasWidth / rect.width;
		const scaleY = canvasHeight / rect.height;
		return {
			x: (e.clientX - rect.left) * scaleX,
			y: (e.clientY - rect.top) * scaleY
		};
	}

	function onPointerDown(e: PointerEvent) {
		if (e.button !== 0) return;
		const pt = svgPoint(e);

		if (activeTool === 'select') {
			// Check if clicking on a shape
			const target = e.target as SVGElement;
			const shapeEl = target.closest('[data-shape-id]') as SVGElement | null;
			if (shapeEl) {
				const id = shapeEl.dataset.shapeId!;
				selectedId = id;
				const shape = shapes.find((s) => s.id === id);
				if (shape) {
					const bounds = getShapeBounds(shape);
					dragOffset = { x: pt.x - bounds.x, y: pt.y - bounds.y };
					drawing = true;
					(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
				}
			} else {
				selectedId = null;
			}
			e.stopPropagation();
			return;
		}

		drawing = true;
		startPoint = pt;
		currentPoint = pt;
		if (activeTool === 'pen') {
			penPoints = [pt];
		}
		(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
		e.stopPropagation();
	}

	function onPointerMove(e: PointerEvent) {
		if (!drawing) return;
		const pt = svgPoint(e);

		if (activeTool === 'select' && selectedId && dragOffset) {
			const off = dragOffset;
			const updated = shapes.map((s) => {
				if (s.id !== selectedId) return s;
				return moveShape(s, pt.x - off.x, pt.y - off.y);
			});
			onShapesChange(updated);
			e.stopPropagation();
			return;
		}

		currentPoint = pt;
		if (activeTool === 'pen') {
			penPoints = [...penPoints, pt];
		}
		e.stopPropagation();
	}

	function onPointerUp(e: PointerEvent) {
		if (!drawing) return;
		drawing = false;

		if (activeTool === 'select') {
			dragOffset = null;
			e.stopPropagation();
			return;
		}

		if (startPoint && currentPoint) {
			const shape = createShape(activeTool, startPoint, currentPoint, penPoints);
			if (shape) {
				onShapesChange([...shapes, shape]);
			}
		}
		startPoint = null;
		currentPoint = null;
		penPoints = [];
		e.stopPropagation();
	}

	function createShape(
		tool: DrawingTool,
		start: Point,
		end: Point,
		pen: Point[]
	): Shape | null {
		const base = {
			id: generateShapeId(),
			stroke: STROKE_COLOR,
			strokeWidth: STROKE_WIDTH,
			fill: FILL_COLOR
		};

		switch (tool) {
			case 'rectangle': {
				const x = Math.min(start.x, end.x);
				const y = Math.min(start.y, end.y);
				const w = Math.abs(end.x - start.x);
				const h = Math.abs(end.y - start.y);
				if (w < 3 && h < 3) return null;
				return { ...base, type: 'rectangle', x, y, width: w, height: h };
			}
			case 'circle': {
				const cx = (start.x + end.x) / 2;
				const cy = (start.y + end.y) / 2;
				const rx = Math.abs(end.x - start.x) / 2;
				const ry = Math.abs(end.y - start.y) / 2;
				if (rx < 3 && ry < 3) return null;
				return { ...base, type: 'circle', cx, cy, rx, ry };
			}
			case 'line': {
				const d = Math.hypot(end.x - start.x, end.y - start.y);
				if (d < 3) return null;
				return { ...base, type: 'line', x1: start.x, y1: start.y, x2: end.x, y2: end.y };
			}
			case 'arrow': {
				const d = Math.hypot(end.x - start.x, end.y - start.y);
				if (d < 3) return null;
				return { ...base, type: 'arrow', x1: start.x, y1: start.y, x2: end.x, y2: end.y };
			}
			case 'pen': {
				if (pen.length < 2) return null;
				return { ...base, type: 'pen', points: [...pen] };
			}
			default:
				return null;
		}
	}

	function getShapeBounds(shape: Shape): { x: number; y: number } {
		switch (shape.type) {
			case 'rectangle':
				return { x: shape.x, y: shape.y };
			case 'circle':
				return { x: shape.cx - shape.rx, y: shape.cy - shape.ry };
			case 'line':
			case 'arrow':
				return { x: Math.min(shape.x1, shape.x2), y: Math.min(shape.y1, shape.y2) };
			case 'pen':
				return {
					x: Math.min(...shape.points.map((p) => p.x)),
					y: Math.min(...shape.points.map((p) => p.y))
				};
		}
	}

	function moveShape(shape: Shape, newX: number, newY: number): Shape {
		const bounds = getShapeBounds(shape);
		const dx = newX - bounds.x;
		const dy = newY - bounds.y;

		switch (shape.type) {
			case 'rectangle':
				return { ...shape, x: shape.x + dx, y: shape.y + dy };
			case 'circle':
				return { ...shape, cx: shape.cx + dx, cy: shape.cy + dy };
			case 'line':
				return {
					...shape,
					x1: shape.x1 + dx,
					y1: shape.y1 + dy,
					x2: shape.x2 + dx,
					y2: shape.y2 + dy
				};
			case 'arrow':
				return {
					...shape,
					x1: shape.x1 + dx,
					y1: shape.y1 + dy,
					x2: shape.x2 + dx,
					y2: shape.y2 + dy
				};
			case 'pen':
				return {
					...shape,
					points: shape.points.map((p) => ({ x: p.x + dx, y: p.y + dy }))
				};
		}
	}

	function penPathD(points: Point[]): string {
		if (points.length === 0) return '';
		let d = `M ${points[0].x} ${points[0].y}`;
		for (let i = 1; i < points.length; i++) {
			d += ` L ${points[i].x} ${points[i].y}`;
		}
		return d;
	}

	function arrowHeadPoints(x1: number, y1: number, x2: number, y2: number): string {
		const angle = Math.atan2(y2 - y1, x2 - x1);
		const headLen = 12;
		const a1 = angle - Math.PI / 6;
		const a2 = angle + Math.PI / 6;
		const p1x = x2 - headLen * Math.cos(a1);
		const p1y = y2 - headLen * Math.sin(a1);
		const p2x = x2 - headLen * Math.cos(a2);
		const p2y = y2 - headLen * Math.sin(a2);
		return `${p1x},${p1y} ${x2},${y2} ${p2x},${p2y}`;
	}

	// Preview shape while drawing
	let previewShape = $derived.by(() => {
		if (!drawing || !startPoint || !currentPoint || activeTool === 'select') return null;
		return createShape(activeTool, startPoint, currentPoint, penPoints);
	});

	function isSelected(id: string): boolean {
		return activeTool === 'select' && selectedId === id;
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Delete' || e.key === 'Backspace') {
			if (selectedId) {
				onShapesChange(shapes.filter((s) => s.id !== selectedId));
				selectedId = null;
			}
		}
	}
</script>

<svelte:window onkeydown={handleKeyDown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<svg
	class="drawing-layer"
	width={canvasWidth}
	height={canvasHeight}
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
>
	<defs>
		<marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
			<polygon points="0 0, 10 3.5, 0 7" fill={STROKE_COLOR} />
		</marker>
	</defs>

	{#each shapes as shape (shape.id)}
		{@const sel = isSelected(shape.id)}
		<g data-shape-id={shape.id} class="shape-group" class:shape-selected={sel}
			style="cursor: {activeTool === 'select' ? 'move' : 'crosshair'}">
			{#if shape.type === 'rectangle'}
				<rect
					x={shape.x}
					y={shape.y}
					width={shape.width}
					height={shape.height}
					fill={shape.fill}
					stroke={shape.stroke}
					stroke-width={shape.strokeWidth}
				/>
				{#if sel}
					<rect
						x={shape.x - 2}
						y={shape.y - 2}
						width={shape.width + 4}
						height={shape.height + 4}
						fill="none"
						stroke="#3b82f6"
						stroke-width="1"
						stroke-dasharray="4 2"
					/>
				{/if}
			{:else if shape.type === 'circle'}
				<ellipse
					cx={shape.cx}
					cy={shape.cy}
					rx={shape.rx}
					ry={shape.ry}
					fill={shape.fill}
					stroke={shape.stroke}
					stroke-width={shape.strokeWidth}
				/>
				{#if sel}
					<rect
						x={shape.cx - shape.rx - 2}
						y={shape.cy - shape.ry - 2}
						width={shape.rx * 2 + 4}
						height={shape.ry * 2 + 4}
						fill="none"
						stroke="#3b82f6"
						stroke-width="1"
						stroke-dasharray="4 2"
					/>
				{/if}
			{:else if shape.type === 'line'}
				<line
					x1={shape.x1}
					y1={shape.y1}
					x2={shape.x2}
					y2={shape.y2}
					stroke={shape.stroke}
					stroke-width={shape.strokeWidth}
				/>
				<!-- Thicker invisible hit area for lines -->
				<line
					x1={shape.x1}
					y1={shape.y1}
					x2={shape.x2}
					y2={shape.y2}
					stroke="transparent"
					stroke-width="12"
				/>
			{:else if shape.type === 'arrow'}
				<line
					x1={shape.x1}
					y1={shape.y1}
					x2={shape.x2}
					y2={shape.y2}
					stroke={shape.stroke}
					stroke-width={shape.strokeWidth}
					marker-end="url(#arrowhead)"
				/>
				<line
					x1={shape.x1}
					y1={shape.y1}
					x2={shape.x2}
					y2={shape.y2}
					stroke="transparent"
					stroke-width="12"
				/>
			{:else if shape.type === 'pen'}
				<path
					d={penPathD(shape.points)}
					fill="none"
					stroke={shape.stroke}
					stroke-width={shape.strokeWidth}
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
				<path
					d={penPathD(shape.points)}
					fill="none"
					stroke="transparent"
					stroke-width="12"
				/>
			{/if}
		</g>
	{/each}

	<!-- Preview while drawing -->
	{#if previewShape}
		<g class="preview-shape">
			{#if previewShape.type === 'rectangle'}
				<rect
					x={previewShape.x}
					y={previewShape.y}
					width={previewShape.width}
					height={previewShape.height}
					fill="none"
					stroke={STROKE_COLOR}
					stroke-width={STROKE_WIDTH}
					opacity="0.5"
				/>
			{:else if previewShape.type === 'circle'}
				<ellipse
					cx={previewShape.cx}
					cy={previewShape.cy}
					rx={previewShape.rx}
					ry={previewShape.ry}
					fill="none"
					stroke={STROKE_COLOR}
					stroke-width={STROKE_WIDTH}
					opacity="0.5"
				/>
			{:else if previewShape.type === 'line'}
				<line
					x1={previewShape.x1}
					y1={previewShape.y1}
					x2={previewShape.x2}
					y2={previewShape.y2}
					stroke={STROKE_COLOR}
					stroke-width={STROKE_WIDTH}
					opacity="0.5"
				/>
			{:else if previewShape.type === 'arrow'}
				<line
					x1={previewShape.x1}
					y1={previewShape.y1}
					x2={previewShape.x2}
					y2={previewShape.y2}
					stroke={STROKE_COLOR}
					stroke-width={STROKE_WIDTH}
					opacity="0.5"
					marker-end="url(#arrowhead)"
				/>
			{:else if previewShape.type === 'pen'}
				<path
					d={penPathD(previewShape.points)}
					fill="none"
					stroke={STROKE_COLOR}
					stroke-width={STROKE_WIDTH}
					stroke-linecap="round"
					stroke-linejoin="round"
					opacity="0.5"
				/>
			{/if}
		</g>
	{/if}
</svg>

<style>
	.drawing-layer {
		position: absolute;
		top: 0;
		left: 0;
		overflow: visible;
		cursor: crosshair;
	}

	.shape-group {
		pointer-events: all;
	}

	.shape-selected {
		filter: drop-shadow(0 0 2px #3b82f6);
	}
</style>
