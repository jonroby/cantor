import { buildExchangesByParentId, getChildExchanges, type ExchangeMap } from '@/lib/chat/tree';

export const NODE_WIDTH = 768;
export const NODE_MIN_HEIGHT = 260;
export const NODE_MAX_HEIGHT = 560;
export const COLUMN_GAP = 80;
export const ROW_GAP = 48;
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

export interface CodeEditorPosition {
	x: number;
	y: number;
	width: number;
}

export const CODE_EDITOR_WIDTH = 640;
export const CODE_EDITOR_GAP = 40;
export const CODE_EDITOR_HEIGHT = 400;
export const CODE_EDITOR_ROW_GAP = 60;
export const DRAWING_BOARD_WIDTH = 800;
export const DOCS_PANEL_WIDTH = 816;
export const DOCS_PANEL_HEIGHT = 1056;
export const DOCS_PANEL_GAP = 60;

export interface CanvasLayout {
	nodes: CanvasNode[];
	edges: CanvasEdge[];
	width: number;
	height: number;
	codeEditor: CodeEditorPosition;
	pythonEditor: CodeEditorPosition;
	drawingBoard: CodeEditorPosition;
	docsPanels: CodeEditorPosition[];
}

interface LayoutOptions {
	hiddenExchangeIds?: Set<string>;
	measuredHeights?: Record<string, number>;
	codeEditorHeight?: number;
	pythonEditorHeight?: number;
	docsPanelCount?: number;
}

function buildDocsPanels(count: number): CodeEditorPosition[] {
	const panels: CodeEditorPosition[] = [];
	for (let i = 0; i < count; i++) {
		panels.push({
			x: PADDING_X,
			y: PADDING_Y + i * (DOCS_PANEL_HEIGHT + DOCS_PANEL_GAP),
			width: DOCS_PANEL_WIDTH
		});
	}
	return panels;
}

export function computeCanvasLayout(
	exchanges: ExchangeMap,
	options: LayoutOptions = {}
): CanvasLayout {
	const anchor = Object.values(exchanges).find((exchange) => exchange.isAnchor);
	const hiddenExchangeIds = options.hiddenExchangeIds ?? new Set<string>();
	const measuredHeights = options.measuredHeights ?? {};
	const docsPanelCount = Math.max(1, options.docsPanelCount ?? 1);

	const docsRight = PADDING_X + DOCS_PANEL_WIDTH + DOCS_PANEL_GAP;
	const jsEditorX = docsRight;
	const pyEditorX = docsRight + CODE_EDITOR_WIDTH + CODE_EDITOR_GAP;
	const drawBoardX = pyEditorX + CODE_EDITOR_WIDTH + CODE_EDITOR_GAP;
	const jsHeight = options.codeEditorHeight ?? CODE_EDITOR_HEIGHT;
	const pyHeight = options.pythonEditorHeight ?? CODE_EDITOR_HEIGHT;
	const editorsBottomY = PADDING_Y + Math.max(jsHeight, pyHeight) + CODE_EDITOR_ROW_GAP;

	if (!anchor) {
		return {
			nodes: [],
			edges: [],
			width: 1200,
			height: 800,
			codeEditor: {
				x: jsEditorX,
				y: PADDING_Y,
				width: CODE_EDITOR_WIDTH
			},
			pythonEditor: {
				x: pyEditorX,
				y: PADDING_Y,
				width: CODE_EDITOR_WIDTH
			},
			drawingBoard: {
				x: drawBoardX,
				y: PADDING_Y,
				width: DRAWING_BOARD_WIDTH
			},
			docsPanels: buildDocsPanels(docsPanelCount)
		};
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
		const nextY = Math.max(y, columnBottoms.get(column) ?? editorsBottomY);

		nodes.push({
			id: exchange.id,
			x: docsRight + column * (NODE_WIDTH + COLUMN_GAP),
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
		visit(child.id, 0, index, editorsBottomY);
	}

	const maxBottom = nodes.reduce(
		(bottom, node) => Math.max(bottom, node.y + node.height),
		editorsBottomY
	);

	const editorsRight = drawBoardX + DRAWING_BOARD_WIDTH + PADDING_X;
	const nodesRight =
		docsRight + (maxColumn + 1) * (NODE_WIDTH + COLUMN_GAP) - COLUMN_GAP + PADDING_X;
	const totalWidth = Math.max(1200, Math.max(editorsRight, nodesRight));

	return {
		nodes,
		edges,
		width: totalWidth,
		height: Math.max(900, maxBottom + PADDING_Y),
		codeEditor: {
			x: jsEditorX,
			y: PADDING_Y,
			width: CODE_EDITOR_WIDTH
		},
		pythonEditor: {
			x: pyEditorX,
			y: PADDING_Y,
			width: CODE_EDITOR_WIDTH
		},
		drawingBoard: {
			x: drawBoardX,
			y: PADDING_Y,
			width: DRAWING_BOARD_WIDTH
		},
		docsPanels: buildDocsPanels(docsPanelCount)
	};
}
