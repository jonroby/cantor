<script lang="ts">
	import * as domain from '@/domain';
	import * as app from '@/app';
	import { Button, Header } from '@/view/primitives';
	import * as Tooltip from '@/view/primitives/tooltip';
	import {
		Search,
		Maximize2,
		ArrowUpToLine,
		CircleDot,
		SquareArrowOutUpRight,
		SplitSquareVertical
	} from 'lucide-svelte';

	interface Props {
		onSearchOpen?: () => void;
	}

	interface CanvasNode {
		id: string;
		x: number;
		y: number;
		height: number;
		exchange: app.chat.Exchange;
		depth: number;
		sideBranchCount: number;
		isActive: boolean;
	}

	interface CanvasEdge {
		id: string;
		fromId: string;
		toId: string;
	}

	let { onSearchOpen }: Props = $props();

	const MIN_ZOOM = 0.9;
	const MAX_ZOOM = 1.6;
	const NODE_WIDTH = 920;
	const NODE_MIN_HEIGHT = 340;
	const COLUMN_GAP = 88;
	const ROW_GAP = 64;
	const PADDING_X = 84;
	const PADDING_Y = 96;

	let containerEl: HTMLDivElement | null = $state(null);
	let tx = $state(0);
	let ty = $state(0);
	let scale = $state(1);
	let animating = $state(false);
	let isPanning = $state(false);
	let lastPointerX = 0;
	let lastPointerY = 0;
	let expandedSideChatParent: string | null = $state(null);
	let measuredHeights: Record<string, number> = $state({});

	let activeChat = $derived(app.chat.getChat());
	let activeExchangeId = $derived(app.chat.getActiveExchangeId());
	let tree = $derived({ rootId: activeChat.rootId, exchanges: activeChat.exchanges });
	let hiddenExchangeIds = $derived(getHiddenExchangeIds(tree, expandedSideChatParent));
	let graph = $derived(computeLayout(tree, activeExchangeId, hiddenExchangeIds, measuredHeights));
	let nodeLookup = $derived(new Map(graph.nodes.map((node) => [node.id, node])));

	function getHiddenExchangeIds(
		currentTree: { rootId: string | null; exchanges: Record<string, app.chat.Exchange> },
		expandedParentId: string | null
	): Set<string> {
		const hidden = new Set<string>();
		const rootId = currentTree.rootId;
		if (!rootId) return hidden;

		for (const exchange of Object.values(currentTree.exchanges)) {
			if (exchange.childIds.length <= 1 || exchange.id === expandedParentId) continue;
			for (const childId of exchange.childIds.slice(1)) {
				hidden.add(childId);
				hideDescendants(childId, currentTree, hidden);
			}
		}
		return hidden;
	}

	function hideDescendants(
		exchangeId: string,
		currentTree: { rootId: string | null; exchanges: Record<string, app.chat.Exchange> },
		hidden: Set<string>
	) {
		const exchange = currentTree.exchanges[exchangeId];
		if (!exchange) return;
		for (const childId of exchange.childIds) {
			hidden.add(childId);
			hideDescendants(childId, currentTree, hidden);
		}
	}

	function estimateHeight(exchange: app.chat.Exchange) {
		const promptLines = Math.ceil(Math.max(1, exchange.prompt.text.trim().length) / 90);
		const responseLines = Math.ceil(Math.max(1, exchange.response?.text.trim().length ?? 0) / 120);
		return Math.max(NODE_MIN_HEIGHT, 188 + promptLines * 22 + responseLines * 18);
	}

	function computeLayout(
		currentTree: { rootId: string | null; exchanges: Record<string, app.chat.Exchange> },
		activeId: string | null,
		hiddenIds: Set<string>,
		measured: Record<string, number>
	) {
		const nodes: CanvasNode[] = [];
		const edges: CanvasEdge[] = [];
		const rootId = currentTree.rootId;

		if (!rootId || !currentTree.exchanges[rootId]) {
			return {
				nodes,
				edges,
				width: NODE_WIDTH + PADDING_X * 2,
				height: NODE_MIN_HEIGHT + PADDING_Y * 2
			};
		}

		const columnBottoms = new Map<number, number>();
		let maxColumn = 0;
		let maxBottom = PADDING_Y;

		function visit(exchangeId: string, column: number, startY: number, depth: number) {
			const exchange = currentTree.exchanges[exchangeId];
			if (!exchange || hiddenIds.has(exchangeId)) return;

			const height = Math.max(measured[exchange.id] ?? 0, estimateHeight(exchange));
			const y = Math.max(startY, columnBottoms.get(column) ?? PADDING_Y);
			const x = PADDING_X + column * (NODE_WIDTH + COLUMN_GAP);
			const sideBranchCount = exchange.childIds.length > 1 ? exchange.childIds.length - 1 : 0;

			nodes.push({
				id: exchange.id,
				x,
				y,
				height,
				exchange,
				depth,
				sideBranchCount,
				isActive: exchange.id === activeId
			});

			columnBottoms.set(column, y + height + ROW_GAP);
			maxColumn = Math.max(maxColumn, column);
			maxBottom = Math.max(maxBottom, y + height);

			const visibleChildren = exchange.childIds
				.map((childId) => currentTree.exchanges[childId])
				.filter((child): child is app.chat.Exchange => !!child && !hiddenIds.has(child.id));

			for (let index = 0; index < visibleChildren.length; index += 1) {
				const child = visibleChildren[index]!;
				edges.push({ id: `${exchange.id}->${child.id}`, fromId: exchange.id, toId: child.id });
				// Keep the main chain vertical; side branches fan out to the right.
				const childColumn = index === 0 ? column : column + index;
				visit(child.id, childColumn, y + height + ROW_GAP, depth + 1);
			}
		}

		visit(rootId, 0, PADDING_Y, 0);

		return {
			nodes,
			edges,
			width: PADDING_X * 2 + (maxColumn + 1) * NODE_WIDTH + maxColumn * COLUMN_GAP,
			height: maxBottom + PADDING_Y
		};
	}

	function clamp(value: number, min: number, max: number) {
		return Math.min(Math.max(value, min), max);
	}

	function computeEdgePath(edge: CanvasEdge) {
		const source = nodeLookup.get(edge.fromId);
		const target = nodeLookup.get(edge.toId);
		if (!source || !target) return '';

		const sx = source.x + NODE_WIDTH / 2;
		const sy = source.y + source.height;
		const tx2 = target.x + NODE_WIDTH / 2;
		const ty2 = target.y;
		const midY = sy + (ty2 - sy) * 0.46;
		return `M ${sx} ${sy} C ${sx} ${midY}, ${tx2} ${midY}, ${tx2} ${ty2}`;
	}

	function onWheel(event: WheelEvent) {
		event.preventDefault();
		if (!containerEl) return;

		if (event.ctrlKey || event.metaKey) {
			const rect = containerEl.getBoundingClientRect();
			const mx = event.clientX - rect.left;
			const my = event.clientY - rect.top;
			const previousScale = scale;
			const nextScale = clamp(previousScale * (1 - event.deltaY * 0.004), MIN_ZOOM, MAX_ZOOM);
			const ratio = nextScale / previousScale;
			tx = mx - ratio * (mx - tx);
			ty = my - ratio * (my - ty);
			scale = nextScale;
			return;
		}

		tx -= event.deltaX;
		ty -= event.deltaY;
	}

	function onPointerDown(event: PointerEvent) {
		if (event.button !== 0) return;
		const target = event.target as HTMLElement;
		if (target.closest('.canvas-node-card') || target.closest('.floating-actions')) return;

		isPanning = true;
		lastPointerX = event.clientX;
		lastPointerY = event.clientY;
		containerEl?.setPointerCapture(event.pointerId);
	}

	function onPointerMove(event: PointerEvent) {
		if (!isPanning) return;
		tx += event.clientX - lastPointerX;
		ty += event.clientY - lastPointerY;
		lastPointerX = event.clientX;
		lastPointerY = event.clientY;
	}

	function onPointerUp(event: PointerEvent) {
		if (!isPanning) return;
		isPanning = false;
		containerEl?.releasePointerCapture(event.pointerId);
	}

	function withAnimation(callback: () => void, duration = 240) {
		animating = true;
		callback();
		window.setTimeout(() => {
			animating = false;
		}, duration);
	}

	export function scrollToNode(nodeId: string | null) {
		if (!nodeId || !containerEl) return;
		const node = nodeLookup.get(nodeId);
		if (!node) return;

		withAnimation(() => {
			const rect = containerEl!.getBoundingClientRect();
			tx = rect.width / 2 - (node.x + NODE_WIDTH / 2) * scale;
			ty = 84 - node.y * scale;
		});
	}

	export function fitView() {
		if (!containerEl || graph.nodes.length === 0) return;
		const rect = containerEl.getBoundingClientRect();
		const minX = Math.min(...graph.nodes.map((node) => node.x));
		const minY = Math.min(...graph.nodes.map((node) => node.y));
		const maxX = Math.max(...graph.nodes.map((node) => node.x + NODE_WIDTH));
		const maxY = Math.max(...graph.nodes.map((node) => node.y + node.height));
		const width = maxX - minX;
		const height = maxY - minY;
		const nextScale = clamp(
			Math.min((rect.width - 56) / width, (rect.height - 80) / height, 1.18),
			MIN_ZOOM,
			1.18
		);

		withAnimation(() => {
			scale = nextScale;
			tx = rect.width / 2 - (minX + width / 2) * nextScale;
			ty = rect.height / 2 - (minY + height / 2) * nextScale;
		});
	}

	export function scrollToTop() {
		const root = graph.nodes[0];
		if (!root || !containerEl) return;
		withAnimation(() => {
			const rect = containerEl!.getBoundingClientRect();
			tx = rect.width / 2 - (root.x + NODE_WIDTH / 2) * scale;
			ty = 84 - root.y * scale;
		});
	}

	export function expandSideChat(exchangeId: string) {
		expandedSideChatParent = exchangeId;
		queueMicrotask(() => scrollToNode(exchangeId));
	}

	export function resetUIState() {
		expandedSideChatParent = null;
		scale = 1;
		tx = 0;
		ty = 0;
	}

	function openInChat(exchangeId: string) {
		app.chat.selectExchange(exchangeId);
		window.location.hash = '#/';
	}

	function openSideChat(exchangeId: string) {
		const sideChats = app.chat.getSideChats(tree, exchangeId);
		const sideChatIndex = sideChats.length > 0 ? sideChats.length - 1 : 0;
		app.chat.selectExchange(sideChats[sideChatIndex]?.at(-1)?.id ?? exchangeId);
		app.workspace.setPanels([
			{ type: 'chat' },
			{ type: 'side-chat', parentExchangeId: exchangeId, sideChatIndex }
		]);
		window.location.hash = '#/';
	}

	function toggleSideChat(exchangeId: string) {
		expandedSideChatParent = expandedSideChatParent === exchangeId ? null : exchangeId;
		if (expandedSideChatParent === exchangeId) {
			queueMicrotask(() => scrollToNode(exchangeId));
		}
	}

	function selectNode(exchangeId: string) {
		app.chat.selectExchange(exchangeId);
	}

	function preview(text: string, fallback: string) {
		const value = text.trim();
		if (!value) return fallback;
		return value;
	}

	function shortText(text: string, max = 240) {
		return text.length > max ? `${text.slice(0, max - 3)}...` : text;
	}

	function formatTime(timestamp: number) {
		return new Intl.DateTimeFormat(undefined, {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		}).format(timestamp);
	}

	$effect(() => {
		if (
			activeExchangeId &&
			graph.nodes.some((node) => node.id === activeExchangeId) &&
			tx === 0 &&
			ty === 0
		) {
			queueMicrotask(() => fitView());
		}
	});

	function bindNodeCard(element: HTMLDivElement, exchangeId: string) {
		if (typeof ResizeObserver === 'undefined') return;

		const updateHeight = () => {
			const nextHeight = Math.ceil(element.getBoundingClientRect().height);
			if (!nextHeight || measuredHeights[exchangeId] === nextHeight) return;
			measuredHeights = { ...measuredHeights, [exchangeId]: nextHeight };
		};

		updateHeight();
		const observer = new ResizeObserver(() => updateHeight());
		observer.observe(element);

		return {
			destroy() {
				observer.disconnect();
			}
		};
	}
</script>

<div class="canvas-page">
	<Header class="canvas-header-shell">
		{#snippet children()}
			<div class="canvas-header-content">
				<div class="canvas-header-copy">
					<span class="canvas-header-kicker">Canvas</span>
					<span class="canvas-header-name">{activeChat.name}</span>
				</div>
				<div class="canvas-header-meta">
					<span>{graph.nodes.length} nodes</span>
					<span>{expandedSideChatParent ? 'Expanded branch' : 'Main chain focus'}</span>
				</div>
			</div>
		{/snippet}
	</Header>

	<div
		class="canvas-container"
		bind:this={containerEl}
		role="application"
		onwheel={onWheel}
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		style={`--tx:${tx}px;--ty:${ty}px;--scale:${scale};`}
	>
		<div class="canvas-layer" class:canvas-animating={animating}>
			<svg class="canvas-edges" width={graph.width} height={graph.height} aria-hidden="true">
				{#each graph.edges as edge (edge.id)}
					<path class="canvas-edge-path" d={computeEdgePath(edge)} />
				{/each}
			</svg>

			{#each graph.nodes as node (node.id)}
				<div class="canvas-node" style={`left:${node.x}px;top:${node.y}px;width:${NODE_WIDTH}px;`}>
					<div
						use:bindNodeCard={node.id}
						role="button"
						tabindex="0"
						class="canvas-node-card"
						class:canvas-node-card-active={node.isActive}
						onclick={() => selectNode(node.id)}
						onkeydown={(event) => {
							if (event.key === 'Enter' || event.key === ' ') {
								event.preventDefault();
								selectNode(node.id);
							}
						}}
					>
						<div class="node-topline">
							<div class="node-topline-left">
								<span class="node-depth">Depth {node.depth + 1}</span>
								<span class="node-time">{formatTime(node.exchange.createdAt)}</span>
							</div>
							<div class="node-topline-right">
								<span class="node-chip">{node.exchange.provider}</span>
								<span class="node-chip">{node.exchange.model}</span>
							</div>
						</div>

						<div class="node-sections">
							<section class="node-section">
								<div class="node-kicker">You</div>
								<p class="node-text">
									{shortText(preview(node.exchange.prompt.text, 'Empty prompt'))}
								</p>
							</section>

							<section class="node-section node-section-response">
								<div class="node-kicker node-kicker-assistant">Assistant</div>
								<p class="node-text node-text-response">
									{shortText(preview(node.exchange.response?.text ?? '', 'No response yet'))}
								</p>
							</section>
						</div>

						<div class="node-footer">
							<div class="node-footer-left">
								{#if node.sideBranchCount > 0}
									<span class="branch-badge">
										{node.sideBranchCount} side {node.sideBranchCount === 1 ? 'branch' : 'branches'}
									</span>
								{/if}
							</div>
							<div class="node-footer-actions">
								<Button
									size="sm"
									variant="ghost"
									class="node-action-btn"
									onclick={(event) => {
										event.stopPropagation();
										openInChat(node.id);
									}}
								>
									<SquareArrowOutUpRight size={14} />
									<span>Open</span>
								</Button>
								{#if node.sideBranchCount > 0}
									<Button
										size="sm"
										variant="ghost"
										class="node-action-btn"
										onclick={(event) => {
											event.stopPropagation();
											toggleSideChat(node.id);
										}}
									>
										<SplitSquareVertical size={14} />
										<span>{expandedSideChatParent === node.id ? 'Collapse' : 'Expand'}</span>
									</Button>
									<Button
										size="sm"
										variant="ghost"
										class="node-action-btn"
										onclick={(event) => {
											event.stopPropagation();
											openSideChat(node.id);
										}}
									>
										<CircleDot size={14} />
										<span>Side chat</span>
									</Button>
								{/if}
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>

		<Tooltip.Provider>
			<div class="floating-actions">
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<Button
								{...props}
								size="icon"
								variant="outline"
								class="floating-button"
								onclick={() => onSearchOpen?.()}
							>
								<Search size={16} />
							</Button>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content side="left">Search</Tooltip.Content>
				</Tooltip.Root>

				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<Button
								{...props}
								size="icon"
								variant="outline"
								class="floating-button"
								onclick={fitView}
							>
								<Maximize2 size={16} />
							</Button>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content side="left">Fit view</Tooltip.Content>
				</Tooltip.Root>

				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<Button
								{...props}
								size="icon"
								variant="outline"
								class="floating-button"
								onclick={scrollToTop}
							>
								<ArrowUpToLine size={16} />
							</Button>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content side="left">Go to top</Tooltip.Content>
				</Tooltip.Root>

				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<Button
								{...props}
								size="icon"
								variant="outline"
								class="floating-button"
								onclick={() => scrollToNode(activeExchangeId)}
							>
								<CircleDot size={16} />
							</Button>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content side="left">Go to active</Tooltip.Content>
				</Tooltip.Root>
			</div>
		</Tooltip.Provider>
	</div>
</div>

<style>
	.canvas-page {
		position: relative;
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		background:
			radial-gradient(circle at top left, hsl(192 55% 95%), transparent 24%),
			radial-gradient(circle at top right, hsl(160 38% 93% / 0.78), transparent 28%),
			linear-gradient(180deg, hsl(210 33% 99%), hsl(202 28% 96%));
	}

	:global(.canvas-header-shell.header) {
		background: hsl(0 0% 100% / 0.7);
		backdrop-filter: blur(16px);
	}

	.canvas-header-content {
		display: flex;
		width: 100%;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.canvas-header-copy,
	.canvas-header-meta,
	.node-topline,
	.node-topline-left,
	.node-topline-right,
	.node-footer,
	.node-footer-left,
	.node-footer-actions {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.canvas-header-copy {
		min-width: 0;
	}

	.canvas-header-kicker {
		border-radius: 999px;
		background: hsl(184 46% 90%);
		padding: 0.18rem 0.55rem;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: hsl(186 67% 32%);
	}

	.canvas-header-name {
		font-size: 0.95rem;
		font-weight: 600;
		color: hsl(217 30% 24%);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.canvas-header-meta {
		font-size: 0.8rem;
		color: hsl(217 16% 43%);
	}

	.canvas-container {
		position: relative;
		flex: 1;
		min-height: 0;
		overflow: hidden;
		cursor: grab;
		touch-action: none;
		background:
			linear-gradient(hsl(202 26% 86% / 0.46) 1px, transparent 1px),
			linear-gradient(90deg, hsl(202 26% 86% / 0.46) 1px, transparent 1px),
			linear-gradient(180deg, hsl(196 32% 97% / 0.78), hsl(191 24% 95% / 0.56));
		background-size: calc(28px * var(--scale)) calc(28px * var(--scale));
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

	.canvas-animating {
		transition: transform 240ms ease;
	}

	.canvas-edges {
		position: absolute;
		top: 0;
		left: 0;
		overflow: visible;
		pointer-events: none;
	}

	.canvas-edge-path {
		fill: none;
		stroke: hsl(180 29% 47% / 0.5);
		stroke-width: 2;
		stroke-linecap: round;
	}

	.canvas-node {
		position: absolute;
	}

	.canvas-node-card {
		display: flex;
		flex-direction: column;
		gap: 1.15rem;
		border: 1px solid hsl(188 14% 73%);
		border-radius: 1.25rem;
		background:
			linear-gradient(180deg, hsl(0 0% 100% / 0.88), hsl(190 17% 95% / 0.94)), hsl(0 0% 100% / 0.92);
		min-height: 340px;
		padding: 1.35rem 1.4rem;
		box-shadow:
			0 18px 40px -30px hsl(191 38% 17% / 0.42),
			0 10px 18px -16px hsl(191 38% 17% / 0.26);
		backdrop-filter: blur(10px);
		outline: none;
	}

	.canvas-node-card-active {
		border-color: hsl(176 60% 39%);
		box-shadow:
			0 0 0 3px hsl(173 55% 78% / 0.68),
			0 18px 40px -30px hsl(191 38% 17% / 0.42);
	}

	.node-topline {
		justify-content: space-between;
		flex-wrap: wrap;
		font-size: 0.72rem;
		color: hsl(191 15% 40%);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.node-sections {
		display: grid;
		gap: 0.75rem;
	}

	.node-section {
		border-radius: 1rem;
		background: hsl(0 0% 100% / 0.56);
		padding: 1rem 1.05rem;
		border: 1px solid hsl(188 15% 84% / 0.9);
	}

	.node-section-response {
		background: linear-gradient(180deg, hsl(174 36% 95%), hsl(189 28% 95%));
	}

	.node-kicker {
		font-size: 0.74rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: hsl(191 35% 34%);
	}

	.node-kicker-assistant {
		color: hsl(167 49% 30%);
	}

	.node-text {
		margin: 0.45rem 0 0;
		font-size: 1.02rem;
		line-height: 1.62;
		color: hsl(201 24% 20%);
		white-space: pre-wrap;
	}

	.node-text-response {
		color: hsl(192 19% 28%);
	}

	.node-chip,
	.branch-badge {
		display: inline-flex;
		align-items: center;
		border-radius: 999px;
		padding: 0.28rem 0.62rem;
		font-size: 0.74rem;
		font-weight: 700;
	}

	.node-chip {
		background: hsl(190 19% 91%);
		color: hsl(190 21% 33%);
	}

	.branch-badge {
		background: hsl(170 42% 89%);
		color: hsl(169 56% 27%);
	}

	.node-footer {
		justify-content: space-between;
		flex-wrap: wrap;
	}

	:global(.node-action-btn) {
		gap: 0.45rem;
		border-radius: 999px;
		color: hsl(188 30% 29%);
	}

	.floating-actions {
		position: absolute;
		top: 1rem;
		right: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		z-index: 10;
	}

	:global(.floating-button) {
		background: hsl(0 0% 100% / 0.84);
		border-color: hsl(188 16% 76%);
		backdrop-filter: blur(10px);
	}

	@media (max-width: 900px) {
		.canvas-header-meta {
			display: none;
		}

		.floating-actions {
			top: auto;
			bottom: 6.75rem;
			right: 0.85rem;
		}
	}
</style>
