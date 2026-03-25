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
		strokeColor: string;
		onShapesChange: (shapes: Shape[]) => void;
		canvasWidth: number;
		canvasHeight: number;
	}

	let { shapes, activeTool, strokeColor, onShapesChange, canvasWidth, canvasHeight }: Props = $props();

	let drawing = $state(false);
	let startPoint: Point | null = $state(null);
	let currentPoint: Point | null = $state(null);
	let selectedId: string | null = $state(null);
	let dragOffset: Point | null = $state(null);
	let penPoints: Point[] = $state([]);

	// Resize state
	type HandleId = 'tl' | 'tr' | 'bl' | 'br' | 'p1' | 'p2';
	let resizingHandle: HandleId | null = $state(null);
	let resizeAnchor: Point | null = $state(null);

	const STROKE_WIDTH = 2;
	const FILL_COLOR = 'transparent';
	const HANDLE_SIZE = 8;

	function svgPoint(e: PointerEvent): Point {
		const svg = (e.currentTarget as Element).closest('svg') as SVGSVGElement;
		const rect = svg.getBoundingClientRect();
		const scaleX = canvasWidth / rect.width;
		const scaleY = canvasHeight / rect.height;
		return {
			x: (e.clientX - rect.left) * scaleX,
			y: (e.clientY - rect.top) * scaleY
		};
	}

	function getHandles(shape: Shape): { id: HandleId; x: number; y: number; cursor: string }[] {
		switch (shape.type) {
			case 'rectangle':
				return [
					{ id: 'tl', x: shape.x, y: shape.y, cursor: 'nwse-resize' },
					{ id: 'tr', x: shape.x + shape.width, y: shape.y, cursor: 'nesw-resize' },
					{ id: 'bl', x: shape.x, y: shape.y + shape.height, cursor: 'nesw-resize' },
					{ id: 'br', x: shape.x + shape.width, y: shape.y + shape.height, cursor: 'nwse-resize' }
				];
			case 'circle':
				return [
					{ id: 'tl', x: shape.cx - shape.rx, y: shape.cy - shape.ry, cursor: 'nwse-resize' },
					{ id: 'tr', x: shape.cx + shape.rx, y: shape.cy - shape.ry, cursor: 'nesw-resize' },
					{ id: 'bl', x: shape.cx - shape.rx, y: shape.cy + shape.ry, cursor: 'nesw-resize' },
					{ id: 'br', x: shape.cx + shape.rx, y: shape.cy + shape.ry, cursor: 'nwse-resize' }
				];
			case 'line':
			case 'arrow':
				return [
					{ id: 'p1', x: shape.x1, y: shape.y1, cursor: 'move' },
					{ id: 'p2', x: shape.x2, y: shape.y2, cursor: 'move' }
				];
			default:
				return [];
		}
	}

	function resizeShape(shape: Shape, handle: HandleId, pt: Point): Shape {
		switch (shape.type) {
			case 'rectangle': {
				let { x, y, width, height } = shape;
				switch (handle) {
					case 'tl': width += x - pt.x; height += y - pt.y; x = pt.x; y = pt.y; break;
					case 'tr': width = pt.x - x; height += y - pt.y; y = pt.y; break;
					case 'bl': width += x - pt.x; x = pt.x; height = pt.y - y; break;
					case 'br': width = pt.x - x; height = pt.y - y; break;
				}
				return { ...shape, x, y, width: Math.abs(width), height: Math.abs(height) };
			}
			case 'circle': {
				const anchor = resizeAnchor!;
				const cx = (anchor.x + pt.x) / 2;
				const cy = (anchor.y + pt.y) / 2;
				const rx = Math.abs(pt.x - anchor.x) / 2;
				const ry = Math.abs(pt.y - anchor.y) / 2;
				return { ...shape, cx, cy, rx, ry };
			}
			case 'line':
			case 'arrow': {
				if (handle === 'p1') return { ...shape, x1: pt.x, y1: pt.y };
				return { ...shape, x2: pt.x, y2: pt.y };
			}
			default:
				return shape;
		}
	}

	function hitTestShapes(pt: Point): Shape | null {
		const HIT = 8;
		for (let i = shapes.length - 1; i >= 0; i--) {
			const s = shapes[i];
			switch (s.type) {
				case 'rectangle':
					if (pt.x >= s.x - HIT && pt.x <= s.x + s.width + HIT &&
						pt.y >= s.y - HIT && pt.y <= s.y + s.height + HIT) return s;
					break;
				case 'circle':
					if (pt.x >= s.cx - s.rx - HIT && pt.x <= s.cx + s.rx + HIT &&
						pt.y >= s.cy - s.ry - HIT && pt.y <= s.cy + s.ry + HIT) return s;
					break;
				case 'line':
				case 'arrow': {
					const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
					const len = Math.hypot(dx, dy);
					if (len === 0) break;
					const t = Math.max(0, Math.min(1, ((pt.x - s.x1) * dx + (pt.y - s.y1) * dy) / (len * len)));
					const px = s.x1 + t * dx, py = s.y1 + t * dy;
					if (Math.hypot(pt.x - px, pt.y - py) <= HIT) return s;
					break;
				}
				case 'pen': {
					for (let j = 0; j < s.points.length - 1; j++) {
						const a = s.points[j], b = s.points[j + 1];
						const dx = b.x - a.x, dy = b.y - a.y;
						const len = Math.hypot(dx, dy);
						if (len === 0) continue;
						const t = Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / (len * len)));
						const px = a.x + t * dx, py = a.y + t * dy;
						if (Math.hypot(pt.x - px, pt.y - py) <= HIT) return s;
					}
					break;
				}
			}
		}
		return null;
	}

	function onHandleDown(e: PointerEvent, handleId: HandleId) {
		e.stopPropagation();
		if (e.button !== 0 || !selectedId) return;
		const shape = shapes.find((s) => s.id === selectedId);
		if (!shape) return;

		resizingHandle = handleId;
		drawing = true;

		// Set the anchor to the opposite corner for circle/rect resizing
		if (shape.type === 'rectangle') {
			const handles = getHandles(shape);
			const oppositeMap: Record<string, string> = { tl: 'br', tr: 'bl', bl: 'tr', br: 'tl' };
			const opp = handles.find((h) => h.id === oppositeMap[handleId]);
			if (opp) resizeAnchor = { x: opp.x, y: opp.y };
		} else if (shape.type === 'circle') {
			const handles = getHandles(shape);
			const oppositeMap: Record<string, string> = { tl: 'br', tr: 'bl', bl: 'tr', br: 'tl' };
			const opp = handles.find((h) => h.id === oppositeMap[handleId]);
			if (opp) resizeAnchor = { x: opp.x, y: opp.y };
		}

		const svg = (e.target as Element).closest('svg') as SVGSVGElement;
		svg.setPointerCapture(e.pointerId);
	}

	function onPointerDown(e: PointerEvent) {
		if (e.button !== 0) return;
		const pt = svgPoint(e);

		if (activeTool === 'select') {
			const hit = hitTestShapes(pt);
			if (hit) {
				selectedId = hit.id;
				const bounds = getShapeBounds(hit);
				dragOffset = { x: pt.x - bounds.x, y: pt.y - bounds.y };
				drawing = true;
				const svg = (e.currentTarget as Element).closest('svg') as SVGSVGElement;
				svg.setPointerCapture(e.pointerId);
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
		const svg = (e.currentTarget as Element).closest('svg') as SVGSVGElement;
		svg.setPointerCapture(e.pointerId);
		e.stopPropagation();
	}

	function onPointerMove(e: PointerEvent) {
		if (!drawing) return;
		const pt = svgPoint(e);

		// Resizing a handle
		if (resizingHandle && selectedId) {
			const updated = shapes.map((s) => {
				if (s.id !== selectedId) return s;
				return resizeShape(s, resizingHandle!, pt);
			});
			onShapesChange(updated);
			e.stopPropagation();
			return;
		}

		// Moving a shape
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

		if (resizingHandle) {
			resizingHandle = null;
			resizeAnchor = null;
			e.stopPropagation();
			return;
		}

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
			stroke: strokeColor,
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
				return { ...shape, x1: shape.x1 + dx, y1: shape.y1 + dy, x2: shape.x2 + dx, y2: shape.y2 + dy };
			case 'arrow':
				return { ...shape, x1: shape.x1 + dx, y1: shape.y1 + dy, x2: shape.x2 + dx, y2: shape.y2 + dy };
			case 'pen':
				return { ...shape, points: shape.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
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

	let previewShape = $derived.by(() => {
		if (!drawing || !startPoint || !currentPoint || activeTool === 'select') return null;
		return createShape(activeTool, startPoint, currentPoint, penPoints);
	});

	let selectedShape = $derived(selectedId ? shapes.find((s) => s.id === selectedId) ?? null : null);
	let handles = $derived(selectedShape && activeTool === 'select' ? getHandles(selectedShape) : []);

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
			<polygon points="0 0, 10 3.5, 0 7" fill={strokeColor} />
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

	<!-- Resize handles for selected shape -->
	{#each handles as handle (handle.id)}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<rect
			class="resize-handle"
			x={handle.x - HANDLE_SIZE / 2}
			y={handle.y - HANDLE_SIZE / 2}
			width={HANDLE_SIZE}
			height={HANDLE_SIZE}
			fill="white"
			stroke="#3b82f6"
			stroke-width="1.5"
			style="cursor: {handle.cursor}"
			onpointerdown={(e) => onHandleDown(e, handle.id)}
		/>
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
					stroke={strokeColor}
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
					stroke={strokeColor}
					stroke-width={STROKE_WIDTH}
					opacity="0.5"
				/>
			{:else if previewShape.type === 'line'}
				<line
					x1={previewShape.x1}
					y1={previewShape.y1}
					x2={previewShape.x2}
					y2={previewShape.y2}
					stroke={strokeColor}
					stroke-width={STROKE_WIDTH}
					opacity="0.5"
				/>
			{:else if previewShape.type === 'arrow'}
				<line
					x1={previewShape.x1}
					y1={previewShape.y1}
					x2={previewShape.x2}
					y2={previewShape.y2}
					stroke={strokeColor}
					stroke-width={STROKE_WIDTH}
					opacity="0.5"
					marker-end="url(#arrowhead)"
				/>
			{:else if previewShape.type === 'pen'}
				<path
					d={penPathD(previewShape.points)}
					fill="none"
					stroke={strokeColor}
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

	.resize-handle {
		pointer-events: all;
	}
</style>
