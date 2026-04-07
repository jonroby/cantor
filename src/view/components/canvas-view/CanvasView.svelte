<script lang="ts">
	import DOMPurify from 'dompurify';
	import { onMount } from 'svelte';
	import * as app from '@/app';
	import { Button } from '@/view/primitives';
	import * as Tooltip from '@/view/primitives/tooltip';
	import { PROVIDER_LOGOS } from '@/view/assets';
	import { renderRichText } from '@/view/lib/katex';
	import { Search, Maximize2, ArrowUpToLine, CircleDot, GitFork, Trash2, ArrowUp, ChevronLeft, ChevronRight, Split } from 'lucide-svelte';

	interface Props {
		onSearchOpen?: () => void;
	}

	interface CanvasNode {
		id: string;
		x: number;
		y: number;
		height: number;
	}

	interface CanvasEdge {
		id: string;
		from: string;
		to: string;
	}

	type DeleteMode = app.chat.DeleteMode;

	let { onSearchOpen }: Props = $props();

	const MIN_ZOOM = 0.1;
	const MAX_ZOOM = 2;
	const NODE_WIDTH = 720;
	const NODE_MIN_HEIGHT = 260;
	const COLUMN_GAP = 80;
	const ROW_GAP = 80;
	const PADDING_X = 48;
	const PADDING_Y = 48;

	let containerEl: HTMLDivElement | null = $state(null);
	let tx = $state(0);
	let ty = $state(0);
	let scale = $state(1);
	let animating = $state(false);
	let measuredHeights: Record<string, number> = $state({});
	let headerVisible = $state(true);
	let headerTimer: ReturnType<typeof setTimeout> | null = $state(null);
	let operationError: string | null = $state(null);

	let activeChat = $derived(app.chat.getChat());
	let activeExchangeId = $derived(app.chat.getActiveExchangeId());
	let selectedExchangeId = $state<string | null>(null);

	$effect(() => {
		selectedExchangeId = activeExchangeId;
	});
	let expandedSideChatParent: string | null = $state(null);
	let sideChatIndex = $state(0);
	let tree = $derived({ rootId: activeChat.rootId, exchanges: activeChat.exchanges });
	let hiddenExchangeIds = $derived(app.canvas.getHiddenExchangeIds(tree, expandedSideChatParent, sideChatIndex));
	let graph = $derived(computeLayout());
	let nodeLookup = $derived(new Map(graph.nodes.map((node) => [node.id, node])));
	let expandedSideChats = $derived(
		expandedSideChatParent ? app.chat.getSideChats(tree, expandedSideChatParent) : []
	);

	function computeLayout() {
		const nodes: CanvasNode[] = [];
		const edges: CanvasEdge[] = [];
		const rootId = tree.rootId;

		if (!rootId || !tree.exchanges[rootId]) {
			return { nodes, edges, width: 1200, height: 900 };
		}

		// Track how many columns are in use so side branches get fresh columns
		let nextFreeColumn = 0;
		const columnBottoms = new Map<number, number>();
		let maxBottom = PADDING_Y;

		function visit(exchangeId: string, column: number, y: number) {
			const exchange = tree.exchanges[exchangeId];
			if (!exchange || hiddenExchangeIds.has(exchangeId)) return;

			const height = Math.max(NODE_MIN_HEIGHT, measuredHeights[exchangeId] ?? NODE_MIN_HEIGHT);
			const nextY = Math.max(y, columnBottoms.get(column) ?? PADDING_Y);

			nodes.push({
				id: exchangeId,
				x: PADDING_X + column * (NODE_WIDTH + COLUMN_GAP),
				y: nextY,
				height
			});

			columnBottoms.set(column, nextY + height + ROW_GAP);
			nextFreeColumn = Math.max(nextFreeColumn, column + 1);
			maxBottom = Math.max(maxBottom, nextY + height);

			const children = exchange.childIds
				.map((childId) => tree.exchanges[childId])
				.filter((child): child is app.chat.Exchange => !!child && !hiddenExchangeIds.has(child.id));

			if (children.length === 0) return;

			// Main child stays in same column, below parent
			const mainChild = children[0]!;
			edges.push({ id: `${exchange.id}->${mainChild.id}`, from: exchange.id, to: mainChild.id });
			visit(mainChild.id, column, nextY + height + ROW_GAP);

			// Side children go into fresh columns to the right, at the same y as the main child
			for (let i = 1; i < children.length; i++) {
				const sideChild = children[i]!;
				const sideColumn = nextFreeColumn++;
				edges.push({ id: `${exchange.id}->${sideChild.id}`, from: exchange.id, to: sideChild.id });
				visit(sideChild.id, sideColumn, nextY + height + ROW_GAP);
			}
		}

		visit(rootId, 0, PADDING_Y);

		return {
			nodes,
			edges,
			width: Math.max(1200, PADDING_X * 2 + nextFreeColumn * NODE_WIDTH + (nextFreeColumn - 1) * COLUMN_GAP),
			height: Math.max(900, maxBottom + PADDING_Y)
		};
	}

	function getExchange(exchangeId: string) {
		return tree.exchanges[exchangeId] ?? null;
	}

	function clamp(value: number, min: number, max: number) {
		return Math.min(Math.max(value, min), max);
	}

	function computeEdgePath(edge: CanvasEdge) {
		const source = nodeLookup.get(edge.from);
		const target = nodeLookup.get(edge.to);
		if (!source || !target) return '';
		const sourceHeight = measuredHeights[edge.from] ?? source.height;
		const sx = source.x + NODE_WIDTH / 2;
		const sy = source.y + sourceHeight;
		const tx2 = target.x + NODE_WIDTH / 2;
		const ty2 = target.y;
		const midY = (sy + ty2) / 2;
		return `M ${sx} ${sy} C ${sx} ${midY}, ${tx2} ${midY}, ${tx2} ${ty2}`;
	}

	function onWheel(event: WheelEvent) {
		handleHeaderWheel(event);
		event.preventDefault();
		if (!containerEl) return;

		if (event.ctrlKey || event.metaKey) {
			const rect = containerEl.getBoundingClientRect();
			const mx = event.clientX - rect.left;
			const my = event.clientY - rect.top;
			const previousScale = scale;
			const nextScale = clamp(previousScale * (1 - event.deltaY * 0.005), MIN_ZOOM, MAX_ZOOM);
			const ratio = nextScale / previousScale;
			tx = mx - ratio * (mx - tx);
			ty = my - ratio * (my - ty);
			scale = nextScale;
			return;
		}

		tx -= event.deltaX;
		ty -= event.deltaY;
	}

	function handleHeaderWheel(event: WheelEvent) {
		if (event.deltaY < 0) {
			headerVisible = true;
			if (headerTimer) clearTimeout(headerTimer);
			headerTimer = setTimeout(() => {
				headerVisible = false;
			}, 2000);
		} else if (event.deltaY > 0) {
			if (headerTimer) clearTimeout(headerTimer);
			headerVisible = false;
		}
	}

	function setCenter(x: number, y: number, opts?: { zoom?: number; duration?: number }) {
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

	function setTop(x: number, y: number, opts?: { zoom?: number; duration?: number }) {
		if (!containerEl) return;
		const targetScale = opts?.zoom ?? scale;
		const rect = containerEl.getBoundingClientRect();
		const targetTx = rect.width / 2 - x * targetScale;
		const targetTy = ROW_GAP - y * targetScale;

		if (opts?.duration && opts.duration > 0) {
			animating = true;
			tx = targetTx;
			ty = targetTy;
			scale = targetScale;
			setTimeout(() => { animating = false; }, opts.duration);
		} else {
			tx = targetTx;
			ty = targetTy;
			scale = targetScale;
		}
	}

	export function scrollToNode(nodeId: string | null) {
		if (!nodeId || !containerEl) return;
		const node = nodeLookup.get(nodeId);
		if (!node) return;
		setTop(node.x + NODE_WIDTH / 2, node.y, { zoom: 1, duration: 250 });
	}

	export function fitView() {
		if (!containerEl || graph.nodes.length === 0) return;
		const rect = containerEl.getBoundingClientRect();
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		for (const node of graph.nodes) {
			minX = Math.min(minX, node.x);
			minY = Math.min(minY, node.y);
			maxX = Math.max(maxX, node.x + NODE_WIDTH);
			maxY = Math.max(maxY, node.y + node.height);
		}
		const width = maxX - minX;
		const height = maxY - minY;
		const padding = 48;
		const nextScale = Math.min(
			(rect.width - padding * 2) / width,
			(rect.height - padding * 2) / height,
			1
		);
		setCenter(minX + width / 2, minY + height / 2, { zoom: nextScale, duration: 250 });
	}

	export function scrollToTop() {
		const first = graph.nodes[0];
		if (!first || !containerEl) return;
		setTop(first.x + NODE_WIDTH / 2, first.y, { zoom: 1, duration: 250 });
	}

	export function expandSideChat(parentExchangeId: string, targetExchangeId?: string) {
		expandedSideChatParent = parentExchangeId;
		const sideChats = app.chat.getSideChats(tree, parentExchangeId);
		if (targetExchangeId) {
			const idx = sideChats.findIndex((sc) => sc.some((e) => e.id === targetExchangeId));
			sideChatIndex = idx >= 0 ? idx : sideChats.length - 1;
		} else {
			sideChatIndex = 0;
		}
		// Select the tail of the active side chat so the composer submits into it
		const activeSideChat = sideChats[sideChatIndex];
		const tail = activeSideChat?.at(-1);
		if (tail) app.chat.selectExchange(tail.id);
		if (targetExchangeId) {
			requestAnimationFrame(() => scrollToNode(targetExchangeId));
		}
	}

	export function resetUIState() {
		expandedSideChatParent = null;
		sideChatIndex = 0;
		measuredHeights = {};
	}

	function bindNodeCard(element: HTMLDivElement, exchangeId: string) {
		if (typeof ResizeObserver === 'undefined') return;
		const reportHeight = () => {
			const nextHeight = Math.ceil(element.offsetHeight);
			if (nextHeight > 0 && measuredHeights[exchangeId] !== nextHeight) {
				measuredHeights = { ...measuredHeights, [exchangeId]: nextHeight };
			}
		};
		reportHeight();
		const observer = new ResizeObserver(() => reportHeight());
		observer.observe(element);
		return {
			destroy() {
				observer.disconnect();
			}
		};
	}

	function selectNode(exchangeId: string) {
		selectedExchangeId = exchangeId;
		app.chat.selectExchange(exchangeId);
	}

	function handleNodePointerDown(event: PointerEvent, exchangeId: string) {
		event.stopPropagation();
		selectNode(exchangeId);
	}

	function handleNodeMouseDown(event: MouseEvent, exchangeId: string) {
		event.stopPropagation();
		selectNode(exchangeId);
	}

	function copyExchange(exchangeId: string) {
		app.chat.copyChat(exchangeId);
		queueMicrotask(() => scrollToNode(app.chat.getActiveExchangeId()));
	}

	function isSideRoot(exchangeId: string) {
		return app.canvas.isSideRoot(tree, exchangeId);
	}

	function deleteExchange(exchangeId: string) {
		const mode: DeleteMode = app.canvas.getDeleteMode(tree, exchangeId);
		const result = app.chat.deleteExchange(tree, exchangeId, mode, activeExchangeId);
		operationError = result.error;
	}

	function promoteExchange(exchangeId: string) {
		const result = app.chat.promoteExchange(tree, exchangeId);
		operationError = result.error;
	}

	function renderHtml(text: string) {
		return DOMPurify.sanitize(renderRichText(text));
	}

	function toggleSideChat(exchangeId: string) {
		if (expandedSideChatParent === exchangeId) {
			expandedSideChatParent = null;
			sideChatIndex = 0;
			app.chat.selectExchange(exchangeId);
		} else {
			expandedSideChatParent = exchangeId;
			sideChatIndex = app.canvas.getSideChatIndexFromSelection(tree, exchangeId, activeExchangeId);
			const sideChats = app.chat.getSideChats(tree, exchangeId);
			const tail = sideChats[sideChatIndex]?.at(-1);
			if (tail) app.chat.selectExchange(tail.id);
		}
	}

	$effect(() => {
		headerTimer = setTimeout(() => {
			headerVisible = false;
		}, 2000);
		return () => {
			if (headerTimer) clearTimeout(headerTimer);
		};
	});

	onMount(() => {
		if (!containerEl) return;
		const rect = containerEl.getBoundingClientRect();
		tx = rect.width / 2 - (PADDING_X + NODE_WIDTH / 2);
		ty = ROW_GAP - PADDING_Y;
	});
</script>

{#if operationError}
	<div class="error-banner">{operationError}</div>
{/if}

<div class="page-shell">
	<div class="chat-header" class:chat-header-hidden={!headerVisible}>
		<div class="chat-header-label">{activeChat.name}</div>
	</div>

	<Tooltip.Provider>
		<div class="floating-actions">
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<Button
							{...props}
							class="floating-button"
							variant="outline"
							size="icon"
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
							class="floating-button"
							variant="outline"
							size="icon"
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
							class="floating-button"
							variant="outline"
							size="icon"
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
							class="floating-button"
							variant="outline"
							size="icon"
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



	<div
		class="canvas-container"
		bind:this={containerEl}
		onwheel={onWheel}
		style={`--tx:${tx}px;--ty:${ty}px;--scale:${scale};`}
	>
		<div class="canvas-layer" class:canvas-animating={animating} style={`width:${graph.width}px;height:${graph.height}px;--layer-w:${graph.width}px;--layer-h:${graph.height}px;`}>
			{#each graph.nodes as node (node.id)}
				{@const exchange = getExchange(node.id)}
				{#if exchange}
					<div
						class="canvas-node"
						style={`left:${node.x}px;top:${node.y}px;width:${NODE_WIDTH}px;`}
					>
						<div
							use:bindNodeCard={exchange.id}
							class:active-node={exchange.id === selectedExchangeId}
							class="exchange-card flow-node-card"
							role="button"
							tabindex="0"
							aria-label={`Select exchange ${exchange.id}`}
							onclick={() => selectNode(exchange.id)}
							onkeydown={(e) => e.key === 'Enter' && selectNode(exchange.id)}
						>
							<div class="exchange-actions">
								<Tooltip.Root>
									<Tooltip.Trigger>
										{#snippet child({ props })}
											<Button
												{...props}
												class="icon-chip"
												variant="ghost"
												size="icon"
												onclick={(event) => {
													event.stopPropagation();
													copyExchange(exchange.id);
												}}
											>
												<GitFork size={15} />
											</Button>
										{/snippet}
									</Tooltip.Trigger>
									<Tooltip.Content side="bottom">Copy</Tooltip.Content>
								</Tooltip.Root>

								{#if exchange.childIds.length > 1}
									<Tooltip.Root>
										<Tooltip.Trigger>
											{#snippet child({ props })}
												<Button
													{...props}
													class="icon-chip"
													variant="ghost"
													size="icon"
													onclick={(event) => { event.stopPropagation(); toggleSideChat(exchange.id); }}
												>
													<span style="display:inline-flex;transform:scaleY(-1)"><Split size={15} /></span>
												</Button>
											{/snippet}
										</Tooltip.Trigger>
										<Tooltip.Content side="bottom">Side chats</Tooltip.Content>
									</Tooltip.Root>
								{/if}

								{#if isSideRoot(exchange.id)}
									<Tooltip.Root>
										<Tooltip.Trigger>
											{#snippet child({ props })}
												<Button
													{...props}
													class="icon-chip"
													variant="ghost"
													size="icon"
													disabled={!app.chat.canPromoteSideChat(tree, exchange.id)}
													onclick={(event) => {
														event.stopPropagation();
														promoteExchange(exchange.id);
													}}
												>
													<ArrowUp size={15} />
												</Button>
											{/snippet}
										</Tooltip.Trigger>
										<Tooltip.Content side="bottom">Promote</Tooltip.Content>
									</Tooltip.Root>
								{/if}

								<Tooltip.Root>
									<Tooltip.Trigger>
										{#snippet child({ props })}
											<Button
												{...props}
												class="icon-chip delete-chip"
												variant="ghost"
												size="icon"
												onclick={(event) => {
													event.stopPropagation();
													deleteExchange(exchange.id);
												}}
											>
												<Trash2 size={15} />
											</Button>
										{/snippet}
									</Tooltip.Trigger>
									<Tooltip.Content side="bottom">Delete</Tooltip.Content>
								</Tooltip.Root>
							</div>

							<div class="exchange-card-content">
								<div class="exchange-section prompt-section">
									<div class="exchange-kicker">You</div>
									<!-- eslint-disable-next-line svelte/no-at-html-tags -->
									<div class="exchange-prompt">{@html renderHtml(exchange.prompt.text)}</div>
								</div>

								<div class="exchange-section response-section">
									<div class="exchange-card-header">
										<div class="exchange-kicker">
											{#if exchange.provider && PROVIDER_LOGOS[exchange.provider]}
												<img
													src={PROVIDER_LOGOS[exchange.provider]}
													alt={exchange.provider}
													class="exchange-provider-logo"
												/>
											{/if}
											Assistant
											<span class="exchange-model">{exchange.model}</span>
										</div>
									</div>
									{#if exchange.response?.text}
										<!-- eslint-disable-next-line svelte/no-at-html-tags -->
										<div class="exchange-response">{@html renderHtml(exchange.response.text)}</div>
									{:else}
										<div class="exchange-response exchange-response-plain">No response yet</div>
									{/if}
								</div>
							</div>
						</div>
					</div>
				{/if}
			{/each}

			<svg class="edges-svg">
				{#each graph.edges as edge (edge.id)}
					<path d={computeEdgePath(edge)} class="edge-path" />
				{/each}
			</svg>
		</div>
	</div>

</div>

<style>
	.page-shell {
		position: relative;
		height: 100%;
		min-height: 100vh;
	}

	.chat-header {
		position: fixed;
		top: 1rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 30;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.35rem 0.45rem;
		border: 1px solid hsl(var(--border));
		border-radius: 999px;
		background: hsl(var(--card) / 0.94);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
		transition:
			opacity 0.3s ease,
			transform 0.3s ease;
	}

	.chat-header-hidden {
		opacity: 0;
		transform: translateX(-50%) translateY(-1rem);
		pointer-events: none;
	}

	.chat-header-label {
		min-width: 6.5rem;
		text-align: center;
		font-size: 0.9rem;
		color: hsl(var(--muted-foreground));
	}

	.error-banner {
		position: fixed;
		top: 1rem;
		left: 1rem;
		z-index: 35;
		max-width: min(42rem, calc(100vw - 2rem));
		padding: 0.7rem 0.95rem;
		border: 1px solid hsl(var(--destructive) / 0.22);
		border-radius: 999px;
		background: hsl(var(--destructive) / 0.1);
		color: hsl(var(--destructive));
		font-size: 0.875rem;
	}

	.side-chat-nav {
		position: fixed;
		top: 1rem;
		left: 50%;
		transform: translateX(-50%);
		margin-left: 8rem;
		z-index: 30;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.35rem 0.6rem;
		border: 1px solid hsl(var(--border));
		border-radius: 999px;
		background: hsl(var(--card) / 0.94);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
		font-size: 0.8rem;
		color: hsl(var(--muted-foreground));
	}

	.side-chat-nav-btn {
		display: flex;
		align-items: center;
		padding: 0.1rem;
		border: none;
		background: none;
		cursor: pointer;
		color: hsl(var(--foreground));
	}

	.side-chat-nav-btn:disabled {
		opacity: 0.3;
		cursor: default;
	}

	.floating-actions {
		position: fixed;
		right: 1rem;
		top: 50%;
		transform: translateY(-50%);
		z-index: 20;
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}

	:global(.floating-button) {
		height: 2.75rem;
		width: 2.75rem;
		border-radius: 1rem;
		background: hsl(var(--card) / 0.96);
		box-shadow: 0 8px 22px rgba(0, 0, 0, 0.08);
	}

	.canvas-container {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 100vh;
		overflow: hidden;
		cursor: default;
		touch-action: none;
		background-color: hsl(var(--background, 0 0% 100%));
		background-image: radial-gradient(circle, rgba(0, 0, 0, 0.12) 1px, transparent 1px);
		background-size: calc(18px * var(--scale)) calc(18px * var(--scale));
		background-position: var(--tx) var(--ty);
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
		width: var(--layer-w);
		height: var(--layer-h);
		pointer-events: none;
		overflow: visible;
	}

	.edge-path {
		fill: none;
		stroke: hsl(var(--border));
		stroke-width: 1.5;
	}

	.canvas-node {
		position: absolute;
	}

	.exchange-card {
		position: relative;
		overflow: visible;
		cursor: pointer;
		pointer-events: auto;
		border: 1px solid hsl(var(--border));
		border-radius: 0.7rem;
		background: hsl(var(--card));
		color: hsl(var(--card-foreground));
		box-shadow: 0 2px 6px rgba(15, 23, 42, 0.06);
	}

	.flow-node-card {
		width: 100%;
		min-height: 220px;
	}

	.exchange-card-content {
		position: relative;
		z-index: 2;
	}

	.exchange-card:hover,
	.exchange-card:focus-within {
		z-index: 20;
	}

	.active-node {
		border-color: hsl(var(--primary));
		box-shadow:
			0 0 0 2px hsl(var(--background)),
			0 0 0 4px hsl(var(--primary) / 0.3),
			0 8px 24px rgba(15, 23, 42, 0.12);
	}

	.exchange-actions {
		position: absolute;
		top: 0.6rem;
		right: 0.6rem;
		z-index: 3;
		display: flex;
		gap: 0.3rem;
		padding: 0.25rem;
		border: 1px solid hsl(var(--border));
		border-radius: 999px;
		background: hsl(var(--card) / 0.98);
		box-shadow: 0 6px 20px rgba(15, 23, 42, 0.08);
		opacity: 0;
		pointer-events: none;
		transform: translateY(-4px);
		transition:
			opacity 150ms ease,
			transform 150ms ease;
	}

	.exchange-card:hover .exchange-actions,
	.exchange-card:focus-within .exchange-actions {
		opacity: 1;
		pointer-events: auto;
		transform: translateY(0);
	}

	:global(.icon-chip) {
		height: 1.9rem;
		width: 1.9rem;
		border-radius: 999px;
		color: hsl(var(--muted-foreground));
	}

	:global(.delete-chip) {
		color: hsl(var(--destructive));
	}

	.exchange-section {
		padding: 0.85rem 1rem;
	}

	.prompt-section {
		border-bottom: 1px solid hsl(var(--border));
		background: hsl(var(--muted) / 0.65);
		border-top-left-radius: 0.7rem;
		border-top-right-radius: 0.7rem;
	}

	.response-section {
		padding-top: 0.7rem;
		padding-bottom: 0.7rem;
	}

	.exchange-card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.exchange-kicker {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: hsl(var(--muted-foreground));
	}

	.exchange-provider-logo {
		height: 0.85rem;
		width: 0.85rem;
		object-fit: contain;
		flex-shrink: 0;
	}

	.exchange-model {
		margin-left: 0.45rem;
		font-weight: 400;
		letter-spacing: 0;
		text-transform: none;
	}

	.exchange-prompt,
	.exchange-response {
		margin-top: 0.35rem;
		line-height: 1.5;
		word-break: break-word;
	}

	.exchange-prompt {
		font-size: 0.95rem;
	}

	.exchange-response {
		font-size: 16px;
		color: hsl(var(--foreground));
	}

	.exchange-response-plain {
		white-space: pre-wrap;
	}

	:global(.exchange-prompt p),
	:global(.exchange-response p) {
		margin: 0.3em 0;
	}

	:global(.exchange-prompt p:first-child),
	:global(.exchange-response p:first-child) {
		margin-top: 0;
	}

	:global(.exchange-prompt p:last-child),
	:global(.exchange-response p:last-child) {
		margin-bottom: 0;
	}

	:global(.exchange-prompt pre),
	:global(.exchange-response pre) {
		margin: 0.5em 0;
		padding: 0.6em 0.8em;
		border-radius: 0.4rem;
		background: hsl(var(--muted) / 0.6);
		overflow-x: auto;
		font-size: 0.85em;
	}

	:global(.exchange-prompt code),
	:global(.exchange-response code) {
		padding: 0.15em 0.35em;
		border-radius: 0.25rem;
		background: hsl(var(--muted) / 0.6);
		font-size: 0.88em;
	}

	:global(.exchange-prompt pre code),
	:global(.exchange-response pre code) {
		padding: 0;
		background: none;
	}

	:global(.exchange-prompt .katex-display),
	:global(.exchange-response .katex-display) {
		margin: 0.5em 0;
		overflow-x: auto;
		overflow-y: hidden;
	}

	:global(.exchange-prompt .katex),
	:global(.exchange-response .katex) {
		font-size: 20px;
	}

</style>
