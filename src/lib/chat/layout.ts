import { buildExchangesByParentId, getChildExchanges, type ExchangeMap } from './tree';

export const NODE_WIDTH = 768;
export const NODE_MIN_HEIGHT = 260;
export const NODE_MAX_HEIGHT = 560;
export const COLUMN_GAP = 80;
export const ROW_GAP = 210;
export const PADDING_X = 48;
export const PADDING_Y = 48;

export interface CanvasNode {
	id: string;
	x: number;
	y: number;
	depth: number;
	height: number;
}

export interface CanvasEdge {
	id: string;
	from: string;
	to: string;
}

export interface CanvasLayout {
	nodes: CanvasNode[];
	edges: CanvasEdge[];
	width: number;
	height: number;
}

interface LayoutOptions {
	hiddenExchangeIds?: Set<string>;
	measuredHeights?: Record<string, number>;
}

export function computeCanvasLayout(exchanges: ExchangeMap, options: LayoutOptions = {}): CanvasLayout {
	const anchor = Object.values(exchanges).find((exchange) => exchange.isAnchor);
	const hiddenExchangeIds = options.hiddenExchangeIds ?? new Set<string>();
	const measuredHeights = options.measuredHeights ?? {};

	if (!anchor) {
		return { nodes: [], edges: [], width: 1200, height: 800 };
	}

	const exchangesByParentId = buildExchangesByParentId(exchanges);
	const nodes: CanvasNode[] = [];
	const edges: CanvasEdge[] = [];
	const columnBottoms = new Map<number, number>();
	let maxDepth = 0;
	let maxColumn = 0;

	function getNodeHeight(exchangeId: string) {
		return Math.max(NODE_MIN_HEIGHT, measuredHeights[exchangeId] ?? NODE_MIN_HEIGHT);
	}

	function visit(exchangeId: string, depth: number, column: number, y: number) {
		const exchange = exchanges[exchangeId];
		if (!exchange || hiddenExchangeIds.has(exchangeId)) return;
		const height = getNodeHeight(exchange.id);
		const nextY = Math.max(y, columnBottoms.get(column) ?? PADDING_Y);

		nodes.push({
			id: exchange.id,
			x: PADDING_X + column * (NODE_WIDTH + COLUMN_GAP),
			y: nextY,
			depth,
			height
		});
		columnBottoms.set(column, nextY + height + ROW_GAP);

		maxDepth = Math.max(maxDepth, depth);
		maxColumn = Math.max(maxColumn, column);

		const children = getChildExchanges(exchanges, exchange.id, exchangesByParentId).filter(
			(child) => !hiddenExchangeIds.has(child.id)
		);

		for (let index = 0; index < children.length; index += 1) {
			const child = children[index]!;
			if (hiddenExchangeIds.has(child.id)) continue;
			edges.push({ id: `${exchange.id}->${child.id}`, from: exchange.id, to: child.id });
			visit(child.id, depth + 1, column + index, nextY + height + ROW_GAP);
		}
	}

	const rootChildren = getChildExchanges(exchanges, anchor.id, exchangesByParentId).filter(
		(child) => !hiddenExchangeIds.has(child.id)
	);

	for (let index = 0; index < rootChildren.length; index += 1) {
		const child = rootChildren[index]!;
		if (hiddenExchangeIds.has(child.id)) continue;
		visit(child.id, 0, index, PADDING_Y);
	}

	const maxBottom = nodes.reduce((bottom, node) => Math.max(bottom, node.y + node.height), PADDING_Y);

	return {
		nodes,
		edges,
		width: Math.max(
			1200,
			PADDING_X * 2 + (maxColumn + 1) * NODE_WIDTH + Math.max(0, maxColumn) * COLUMN_GAP
		),
		height: Math.max(900, maxBottom + PADDING_Y)
	};
}
