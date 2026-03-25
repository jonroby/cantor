export type DrawingTool = 'select' | 'rectangle' | 'circle' | 'line' | 'arrow' | 'pen';

export interface Point {
	x: number;
	y: number;
}

export interface BaseShape {
	id: string;
	type: string;
	stroke: string;
	strokeWidth: number;
	fill: string;
}

export interface RectShape extends BaseShape {
	type: 'rectangle';
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface CircleShape extends BaseShape {
	type: 'circle';
	cx: number;
	cy: number;
	rx: number;
	ry: number;
}

export interface LineShape extends BaseShape {
	type: 'line';
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

export interface ArrowShape extends BaseShape {
	type: 'arrow';
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

export interface PenShape extends BaseShape {
	type: 'pen';
	points: Point[];
}

export type Shape = RectShape | CircleShape | LineShape | ArrowShape | PenShape;

let _nextId = 0;
export function generateShapeId(): string {
	return `shape-${Date.now()}-${_nextId++}`;
}
