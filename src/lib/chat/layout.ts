import { buildExchangesByParentId, getChildExchanges, type ExchangeMap } from './tree';

export const NODE_WIDTH = 420;
export const NODE_HEIGHT = 172;
export const COLUMN_GAP = 72;
export const ROW_GAP = 42;
export const PADDING_X = 48;
export const PADDING_Y = 48;

export interface CanvasNode {
	id: string;
	x: number;
	y: number;
	depth: number;
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
}

export function computeCanvasLayout(exchanges: ExchangeMap, options: LayoutOptions = {}): CanvasLayout {
	const anchor = Object.values(exchanges).find((exchange) => exchange.isAnchor);
	const hiddenExchangeIds = options.hiddenExchangeIds ?? new Set<string>();

	if (!anchor) {
		return { nodes: [], edges: [], width: 1200, height: 800 };
	}

	const exchangesByParentId = buildExchangesByParentId(exchanges);
	const nodes: CanvasNode[] = [];
	const edges: CanvasEdge[] = [];
	let row = 0;
	let maxDepth = 0;

	function visit(exchangeId: string, depth: number) {
		const exchange = exchanges[exchangeId];
		if (!exchange || hiddenExchangeIds.has(exchangeId)) return;

		nodes.push({
			id: exchange.id,
			x: PADDING_X + depth * (NODE_WIDTH + COLUMN_GAP),
			y: PADDING_Y + row * (NODE_HEIGHT + ROW_GAP),
			depth
		});

		maxDepth = Math.max(maxDepth, depth);
		row += 1;

		for (const child of getChildExchanges(exchanges, exchange.id, exchangesByParentId)) {
			if (hiddenExchangeIds.has(child.id)) continue;
			edges.push({ id: `${exchange.id}->${child.id}`, from: exchange.id, to: child.id });
			visit(child.id, depth + 1);
		}
	}

	for (const child of getChildExchanges(exchanges, anchor.id, exchangesByParentId)) {
		if (hiddenExchangeIds.has(child.id)) continue;
		visit(child.id, 0);
	}

	return {
		nodes,
		edges,
		width: Math.max(1200, PADDING_X * 2 + (maxDepth + 1) * NODE_WIDTH + maxDepth * COLUMN_GAP),
		height: Math.max(900, PADDING_Y * 2 + Math.max(1, row) * NODE_HEIGHT + Math.max(0, row - 1) * ROW_GAP)
	};
}
