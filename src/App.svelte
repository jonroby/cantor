<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { buildInitialExchanges } from '$lib/chat/initialExchanges';
	import { computeCanvasLayout, NODE_WIDTH } from '$lib/chat/layout';
	import type { CanvasNode } from '$lib/chat/layout';
	import { streamClaudeChat } from '$lib/chat/claude';
	import { CLAUDE_MODELS, type ActiveModel, type OllamaStatus } from '$lib/chat/models';
	import Button from '$lib/components/ui/button.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import ExchangeNode from '$lib/components/flow/ExchangeNode.svelte';
	import Canvas from '$lib/components/flow/Canvas.svelte';
	import {
		DEFAULT_OLLAMA_URL,
		fetchAvailableModels,
		fetchModelContextLength,
		streamOllamaChat
	} from '$lib/chat/ollama';
	import { getDefaultItems, searchChats, type SearchResult } from '$lib/chat/search';
	import {
		ROOT_ANCHOR_ID,
		addExchangeResult,
		buildExchangesByParentId,
		canAcceptNewChat,
		canCreateSideChats,
		canPromoteSideChatToMainChat,
		deleteExchangeWithModeResult,
		findSideChatParent,
		getChildExchanges,
		getDescendantExchanges,
		getHistory,
		getMainChatTail,
		getPathTokenTotal,
		promoteSideChatToMainChat,
		type DeleteMode,
		type Exchange,
		type ExchangeMap,
		updateExchangeResponse,
		updateExchangeTokens,
		withExplicitExchangeOrder
	} from '$lib/chat/tree';
	import { clearVault, hasVault, loadApiKey, saveApiKey } from '$lib/chat/vault';

	const STORAGE_KEY = 'chat-tree-store-svelte';

	let roots: ExchangeMap[] = $state([withExplicitExchangeOrder(buildInitialExchanges())]);
	let activeRootIndex = $state(0);
	let activeExchangeId: string | null = $state(null);
	let streamingExchangeIds: string[] = $state([]);
	let operationError: string | null = $state(null);

	let activeModel: ActiveModel | null = $state(null);
	let contextLength: number | null = $state(null);
	let ollamaUrl = $state(DEFAULT_OLLAMA_URL);
	let ollamaStatus: OllamaStatus = $state('disconnected');
	let ollamaModels: string[] = $state([]);
	let claudeApiKey: string | null = $state(null);
	let hasStoredKey = $state(false);

	let composerValue = $state('');
	let searchQuery = $state('');
	let searchAllChats = $state(true);
	let searchOpen = $state(false);
	let paletteOpen = $state(false);
	let claudeMode: 'unlock' | 'setup' | null = $state(null);
	let pendingClaudeModelId: string | null = $state(null);
	let expandedSideChatParent: string | null = $state(null);
	let hasHydrated = $state(false);
	let passwordInput = $state('');
	let confirmPasswordInput = $state('');
	let apiKeyInput = $state('');
	let keyError: string | null = $state(null);
	let deleteTargetId: string | null = $state(null);
	let deleteMode: DeleteMode = $state('exchange');
	let measuredNodeHeights: Record<string, number> = $state({});

	let canvasRef: Canvas | null = $state(null);

	let activeExchanges = $derived(roots[activeRootIndex] ?? roots[0]);
	let exchangesByParentId = $derived(activeExchanges ? buildExchangesByParentId(activeExchanges) : {});
	let collapsedParentIds = $derived(getCollapsedParentIds());
	let hiddenExchangeIds = $derived(getHiddenExchangeIds());
	let canvas = $derived(activeExchanges
		? computeCanvasLayout(activeExchanges, {
				hiddenExchangeIds,
				measuredHeights: measuredNodeHeights
			})
		: computeCanvasLayout({}));
	let nodeLookup = $derived(new Map(canvas.nodes.map((node) => [node.id, node])));
	let usedTokens = $derived(
		activeExchanges && activeExchangeId ? getPathTokenTotal(activeExchanges, activeExchangeId) : 0
	);
	let searchItems = $derived(searchQuery.trim()
		? searchChats(roots, searchQuery.trim(), searchAllChats ? roots.map((_: ExchangeMap, index: number) => index) : [activeRootIndex])
		: getDefaultItems(roots, activeRootIndex, searchAllChats));
	let submitDisabledReason = $derived(
		streamingExchangeIds.length > 0
			? 'Wait for the current response to finish.'
			: !activeModel
				? 'Select a model first.'
				: activeExchangeId && activeExchanges && !canAcceptNewChat(activeExchanges, activeExchangeId, exchangesByParentId)
					? 'Choose a branch tip or main-chain node to continue.'
				: null
	);

	$effect(() => {
		if (hasHydrated) {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({ roots, activeRootIndex })
			);
		}
	});

	$effect(() => {
		if (activeExchanges && (!activeExchangeId || !activeExchanges[activeExchangeId])) {
			activeExchangeId = getMainChatTail(activeExchanges);
		}
	});

	$effect(() => {
		if (activeExchanges) {
			const exchangeIds = new Set(Object.keys(activeExchanges));
			const filteredHeights = Object.fromEntries(
				Object.entries(measuredNodeHeights).filter(([exchangeId]) => exchangeIds.has(exchangeId))
			);
			if (Object.keys(filteredHeights).length !== Object.keys(measuredNodeHeights).length) {
				measuredNodeHeights = filteredHeights;
			}
		}
	});

	$effect(() => {
		if (expandedSideChatParent && activeExchanges && !activeExchanges[expandedSideChatParent]) {
			expandedSideChatParent = null;
		}
	});

	$effect(() => {
		if (activeModel?.provider === 'claude') {
			contextLength =
				CLAUDE_MODELS.find((model) => model.id === activeModel?.modelId)?.contextLength ?? null;
		}
	});

	$effect(() => {
		if (activeModel?.provider === 'ollama') {
			const modelId = activeModel.modelId;
			const url = ollamaUrl;

			(async () => {
				try {
					const length = await fetchModelContextLength(modelId, url);
					if (activeModel?.provider === 'ollama' && activeModel.modelId === modelId && ollamaUrl === url) {
						contextLength = length;
					}
				} catch {
					if (activeModel?.provider === 'ollama' && activeModel.modelId === modelId && ollamaUrl === url) {
						contextLength = null;
					}
				}
			})();
		}
	});

	onMount(() => {
		hasStoredKey = hasVault();

		function handleKeyDown(event: KeyboardEvent) {
			const target = event.target;
			const isEditable =
				target instanceof HTMLElement &&
				(target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

			if (isEditable) return;
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
				event.preventDefault();
				searchOpen = !searchOpen;
			}
		}

		window.addEventListener('keydown', handleKeyDown);

		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			try {
				const parsed = JSON.parse(raw) as {
					roots?: ExchangeMap[];
					activeRootIndex?: number;
				};

				if (parsed.roots?.length) {
					const hydratedRoots = parsed.roots.map((root) => withExplicitExchangeOrder(root));
					if (hasRenderableExchanges(hydratedRoots)) {
						roots = hydratedRoots;
					}
				}

				if (typeof parsed.activeRootIndex === 'number') {
					activeRootIndex = clampRootIndex(parsed.activeRootIndex, roots.length);
				}
			} catch {
				// ignore invalid persisted state
			}
		}

		activeExchangeId = getMainChatTail(roots[activeRootIndex] ?? roots[0]);
		hasHydrated = true;

		(async () => {
			try {
				const models = await fetchAvailableModels(DEFAULT_OLLAMA_URL);
				if (models.length > 0) {
					ollamaUrl = DEFAULT_OLLAMA_URL;
					ollamaModels = models;
					ollamaStatus = 'connected';
					activeModel = { provider: 'ollama', modelId: models[0] };
				}
			} catch {
				// Ollama not running, silently ignore
			}
		})();

		return () => window.removeEventListener('keydown', handleKeyDown);
	});

	function clampRootIndex(index: number, rootCount: number) {
		if (rootCount <= 0) return 0;
		return Math.min(Math.max(index, 0), rootCount - 1);
	}

	function hasRenderableExchanges(rootList: ExchangeMap[]) {
		return rootList.some((root) => Object.values(root).some((exchange) => !exchange.isAnchor));
	}

	function getCollapsedParentIds() {
		if (!activeExchanges) return new Set<string>();

		return new Set(
			Object.values(activeExchanges)
				.filter((exchange) => (exchangesByParentId[exchange.id]?.length ?? 0) > 1)
				.map((exchange) => exchange.id)
				.filter((id) => id !== expandedSideChatParent)
		);
	}

	function getHiddenExchangeIds() {
		if (!activeExchanges) return new Set<string>();

		const hidden = new Set<string>();

		for (const parentId of collapsedParentIds) {
			const children = getChildExchanges(activeExchanges, parentId, exchangesByParentId);
			for (let index = 1; index < children.length; index += 1) {
				const sideRootId = children[index]?.id;
				if (!sideRootId) continue;
				hidden.add(sideRootId);
				for (const descendantId of getDescendantExchanges(activeExchanges, sideRootId)) {
					hidden.add(descendantId);
				}
			}
		}

		return hidden;
	}

	function selectRoot(index: number) {
		activeRootIndex = clampRootIndex(index, roots.length);
		activeExchangeId = getMainChatTail(roots[activeRootIndex]);
		expandedSideChatParent = null;
		measuredNodeHeights = {};
		scrollToNode(activeExchangeId);
	}

	function replaceActiveRoot(nextRoot: ExchangeMap) {
		measuredNodeHeights = {};
		roots = roots.map((root, index) => (index === activeRootIndex ? nextRoot : root));
	}

	function setMeasuredNodeHeight(exchangeId: string, height: number) {
		const roundedHeight = Math.ceil(height);
		if (!Number.isFinite(roundedHeight) || roundedHeight <= 0) return;
		if (measuredNodeHeights[exchangeId] === roundedHeight) return;

		measuredNodeHeights = {
			...measuredNodeHeights,
			[exchangeId]: roundedHeight
		};
	}

	function createSideChat(exchangeId: string) {
		const sourceExchanges = activeExchanges;
		if (!sourceExchanges || activeRootIndex !== 0) return;

		const path: Exchange[] = [];
		let current: Exchange | undefined = sourceExchanges[exchangeId];
		while (current && !current.isAnchor) {
			path.unshift(current);
			current = current.parentId ? sourceExchanges[current.parentId] : undefined;
		}

		const anchorId = `__anchor_${crypto.randomUUID()}__`;
		const copiedExchanges: ExchangeMap = {
			[anchorId]: { id: anchorId, parentId: null, prompt: '', response: '', isAnchor: true }
		};
		const idMap: Record<string, string> = {};

		for (const exchange of path) {
			idMap[exchange.id] = crypto.randomUUID();
		}

		let firstCopiedId = '';
		for (const exchange of path) {
			const copiedId = idMap[exchange.id];
			if (!copiedId) continue;
			if (!firstCopiedId) firstCopiedId = copiedId;
			const copiedParentId =
				exchange.parentId && idMap[exchange.parentId] ? idMap[exchange.parentId] : anchorId;

			copiedExchanges[copiedId] = {
				id: copiedId,
				parentId: copiedParentId,
				prompt: exchange.prompt,
				response: exchange.response,
				promptTokens: exchange.promptTokens,
				responseTokens: exchange.responseTokens,
				model: exchange.model
			};
		}

		roots = [...roots, withExplicitExchangeOrder(copiedExchanges)];
		activeRootIndex = roots.length - 1;
		activeExchangeId = firstCopiedId;
		expandedSideChatParent = null;
		scrollToNode(firstCopiedId);
	}

	function scrollToNode(nodeId: string | null) {
		if (!nodeId || !canvasRef) return;
		const node = nodeLookup.get(nodeId);
		if (node) {
			canvasRef.scrollNodeToTop(node.y, node.x + NODE_WIDTH / 2, { zoom: 1, duration: 250, topOffset: 60 });
		}
	}

	function saveToDisk() {
		const payload = JSON.stringify({ roots, activeRootIndex }, null, 2);
		const blob = new Blob([payload], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `chat-tree-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
		link.click();
		URL.revokeObjectURL(url);
	}

	async function connectOllama(url: string) {
		ollamaStatus = 'connecting';
		try {
			const models = await fetchAvailableModels(url);
			ollamaUrl = url;
			ollamaModels = models;
			ollamaStatus = 'connected';

			if (models.length > 0) {
				activeModel = { provider: 'ollama', modelId: models[0] };
			}
		} catch (error) {
			ollamaStatus = 'error';
			ollamaModels = [];
			operationError = error instanceof Error ? error.message : 'Failed to connect to Ollama.';
		}
	}

	async function unlockClaudeKey() {
		keyError = null;
		try {
			claudeApiKey = await loadApiKey(passwordInput);
			if (pendingClaudeModelId) {
				activeModel = { provider: 'claude', modelId: pendingClaudeModelId };
				paletteOpen = false;
			}
			claudeMode = null;
			passwordInput = '';
		} catch (error) {
			keyError = error instanceof Error ? error.message : 'Failed to unlock Claude key.';
		}
	}

	async function saveClaudeCredentials() {
		keyError = null;
		if (passwordInput.length < 8) {
			keyError = 'Password must be at least 8 characters.';
			return;
		}
		if (passwordInput !== confirmPasswordInput) {
			keyError = 'Passwords do not match.';
			return;
		}

		try {
			await saveApiKey(apiKeyInput.trim(), passwordInput);
			claudeApiKey = apiKeyInput.trim();
			hasStoredKey = true;
			if (pendingClaudeModelId) {
				activeModel = { provider: 'claude', modelId: pendingClaudeModelId };
				paletteOpen = false;
			}
			claudeMode = null;
			passwordInput = '';
			confirmPasswordInput = '';
			apiKeyInput = '';
		} catch (error) {
			keyError = error instanceof Error ? error.message : 'Failed to save Claude key.';
		}
	}

	function forgetClaudeKey() {
		clearVault();
		claudeApiKey = null;
		hasStoredKey = false;
		if (activeModel?.provider === 'claude') {
			activeModel = null;
		}
	}

	function startClaudeFlow(modelId: string) {
		pendingClaudeModelId = modelId;
		keyError = null;
		passwordInput = '';
		confirmPasswordInput = '';
		apiKeyInput = '';

		if (claudeApiKey) {
			activeModel = { provider: 'claude', modelId };
			paletteOpen = false;
			return;
		}

		claudeMode = hasStoredKey ? 'unlock' : 'setup';
	}

	async function submitPrompt() {
		const prompt = composerValue.trim();
		if (!prompt || !activeExchanges || submitDisabledReason || !activeModel) return;

		operationError = null;

		const parentId = activeExchangeId ?? getMainChatTail(activeExchanges) ?? ROOT_ANCHOR_ID;
		if (activeExchangeId && getChildExchanges(activeExchanges, activeExchangeId, exchangesByParentId).length > 0) {
			expandedSideChatParent = activeExchangeId;
		}

		let created: { id: string; exchanges: import('$lib/chat/tree').ExchangeMap };
		try {
			created = addExchangeResult(activeExchanges, parentId, prompt, '', activeModel.modelId);
		} catch (error) {
			operationError = error instanceof Error ? error.message : 'Failed to create exchange.';
			return;
		}

		replaceActiveRoot(created.exchanges);
		activeExchangeId = created.id;
		streamingExchangeIds = [...streamingExchangeIds, created.id];
		composerValue = '';
		await tick();
		scrollToNode(created.id);

		const abortController = new AbortController();

		try {
			const history = getHistory(created.exchanges, created.id);
			const stream =
				activeModel.provider === 'ollama'
					? streamOllamaChat(
							activeModel.modelId,
							history,
							abortController.signal,
							ollamaUrl
						)
					: streamClaudeChat(
							activeModel.modelId,
							history,
							claudeApiKey ?? '',
							abortController.signal
						);

			let response = '';
			for await (const chunk of stream) {
				if (chunk.type === 'delta') {
					response += chunk.delta;
					replaceActiveRoot(updateExchangeResponse(roots[activeRootIndex], created.id, response));
				} else {
					replaceActiveRoot(
						updateExchangeTokens(
							roots[activeRootIndex],
							created.id,
							chunk.promptTokens,
							chunk.responseTokens
						)
					);
				}
			}
		} catch (error) {
			replaceActiveRoot(
				updateExchangeResponse(
					roots[activeRootIndex],
					created.id,
					`Request failed.\n\n${error instanceof Error ? error.message : 'Unknown error.'}`
				)
			);
			operationError = error instanceof Error ? error.message : 'Request failed.';
		} finally {
			streamingExchangeIds = streamingExchangeIds.filter((id) => id !== created.id);
		}
	}

	function openDeleteDialog(exchangeId: string) {
		if (!activeExchanges) return;
		deleteTargetId = exchangeId;
		const children = getChildExchanges(activeExchanges, exchangeId, exchangesByParentId);
		deleteMode = children.length > 1 ? 'exchangeAndSideChats' : 'exchange';
	}

	function confirmDelete() {
		if (!activeExchanges || !deleteTargetId) return;

		try {
			const result = deleteExchangeWithModeResult(activeExchanges, deleteTargetId, deleteMode);
			replaceActiveRoot(result.exchanges);
			if (deleteTargetId === activeExchangeId || !result.exchanges[activeExchangeId ?? '']) {
				activeExchangeId = getMainChatTail(result.exchanges);
			}
			deleteTargetId = null;
			operationError = null;
		} catch (error) {
			operationError = error instanceof Error ? error.message : 'Unable to delete exchange.';
		}
	}

	function promoteActiveExchange() {
		if (!activeExchanges || !activeExchangeId) return;
		try {
			replaceActiveRoot(promoteSideChatToMainChat(activeExchanges, activeExchangeId));
			operationError = null;
		} catch (error) {
			operationError = error instanceof Error ? error.message : 'Unable to promote exchange.';
		}
	}

	function handleSearchSelect(result: SearchResult) {
		const targetRoot = roots[result.rootIndex];
		activeRootIndex = result.rootIndex;
		activeExchangeId = result.exchangeId;
		expandedSideChatParent =
			targetRoot
				? findSideChatParent(targetRoot, result.exchangeId)
				: null;
		scrollToNode(result.exchangeId);
	}

	function toggleSideChildren(exchangeId: string) {
		expandedSideChatParent = expandedSideChatParent === exchangeId ? null : exchangeId;
	}

	function getExchangeNodeData(exchangeId: string) {
		const exchange = activeExchanges?.[exchangeId];
		if (!exchange) return null;
		const children = activeExchanges ? getChildExchanges(activeExchanges, exchangeId, exchangesByParentId) : [];
		const hasSideChildren = canCreateSideChats(activeExchanges, exchangeId, exchangesByParentId) && children.length > 1;
		const isSideRoot = exchange.parentId
			? (getChildExchanges(activeExchanges, exchange.parentId, exchangesByParentId)[0]?.id ?? null) !== exchangeId
			: false;

		return {
			prompt: exchange.prompt,
			response: exchange.response,
			model: exchange.model,
			isActive: activeExchangeId === exchangeId,
			isStreaming: streamingExchangeIds.includes(exchangeId),
			canCreateSideChat: activeRootIndex === 0,
			hasSideChildren,
			isSideRoot,
			canPromote: !!activeExchanges && canPromoteSideChatToMainChat(activeExchanges, exchangeId, exchangesByParentId),
			onMeasure: (height: number) => setMeasuredNodeHeight(exchangeId, height),
			onSelect: () => { activeExchangeId = exchangeId; },
			onCreateSideChat: () => createSideChat(exchangeId),
			onToggleSideChildren: () => toggleSideChildren(exchangeId),
			onPromote: () => { activeExchangeId = exchangeId; promoteActiveExchange(); },
			onDelete: () => openDeleteDialog(exchangeId)
		};
	}
</script>

<svelte:head>
	<title>Superset Svelte</title>
</svelte:head>

<div class="page-shell">
	{#if roots.length > 1}
		<div class="chat-header">
			<Button class="chat-nav" variant="outline" size="icon" disabled={activeRootIndex === 0} onclick={() => selectRoot(activeRootIndex - 1)}>
				<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 2L4 7l5 5" /></svg>
			</Button>
			<div class="chat-header-label">{activeRootIndex === 0 ? 'Main Chat' : `Side Chat ${activeRootIndex}`}</div>
			<Button class="chat-nav" variant="outline" size="icon" disabled={activeRootIndex === roots.length - 1} onclick={() => selectRoot(activeRootIndex + 1)}>
				<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 2l5 5-5 5" /></svg>
			</Button>
		</div>
	{/if}

	{#if operationError}
		<div class="error-banner">{operationError}</div>
	{/if}

	<div class="floating-actions">
		<Button class="floating-button" variant="outline" size="icon" onclick={() => (searchOpen = true)} ariaLabel="Search">
			<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="6.5" cy="6.5" r="4" /><path d="M11 11l2.5 2.5" stroke-linecap="round" /></svg>
		</Button>
		<Button class="floating-button" variant="outline" size="icon" onclick={() => canvasRef?.fitView({ duration: 250, maxZoom: 1 })} ariaLabel="Go to top">
			<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 12V4M8 4 5.5 6.5M8 4l2.5 2.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
		</Button>
		<Button class="floating-button" variant="outline" size="icon" onclick={() => scrollToNode(activeExchangeId)} ariaLabel="Go to active exchange">
			<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="5" /><circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" /></svg>
		</Button>
		<Button class="floating-button" variant="outline" size="icon" onclick={saveToDisk} ariaLabel="Export">
			<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 13h10M8 3v7M5 7l3 3 3-3" stroke-linecap="round" stroke-linejoin="round" /></svg>
		</Button>
	</div>

	<div class="flow-shell">
		<Canvas
			nodes={canvas.nodes}
			edges={canvas.edges}
			canvasWidth={canvas.width}
			canvasHeight={canvas.height}
			nodeWidth={NODE_WIDTH}
			bind:this={canvasRef}
		>
			{#snippet renderNode(n: CanvasNode)}
				{@const nodeData = getExchangeNodeData(n.id)}
				{#if nodeData}
					<ExchangeNode data={nodeData} />
				{/if}
			{/snippet}
		</Canvas>
	</div>

	<form class="composer" onsubmit={(e: Event) => { e.preventDefault(); submitPrompt(); }}>
		<div class="composer-shell">
			<div class="composer-row">
				<Input bind:value={composerValue} class="composer-input" placeholder={submitDisabledReason ?? 'Message...'} />
				<Button class="composer-send" type="submit" size="icon" disabled={!!submitDisabledReason || !composerValue.trim()} ariaLabel="Send message">
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 3v7M5 7l3-3 3 3" stroke-linecap="round" stroke-linejoin="round" /></svg>
				</Button>
			</div>
			<div class="composer-footer">
				<Button class="model-chip" variant="outline" size="sm" onclick={() => (paletteOpen = true)}>
					{activeModel ? activeModel.modelId : 'Connect a model'}
				</Button>
				{#if activeModel}
					<div class="composer-divider"></div>
					<div class="context-meta">
						<span>Context</span>
						{#if contextLength != null}
							<div class="progress-track compact">
								<div class="progress-fill" style={`width: ${Math.min(100, (usedTokens / Math.max(1, contextLength)) * 100)}%`}></div>
							</div>
						{/if}
						<span>{usedTokens.toLocaleString()}{contextLength != null ? ` / ${contextLength.toLocaleString()}` : ''}</span>
					</div>
				{/if}
				{#if submitDisabledReason}
					<span class="composer-hint">{submitDisabledReason}</span>
				{/if}
			</div>
		</div>
	</form>

	{#if paletteOpen}
		<button
			class="modal-scrim"
			type="button"
			aria-label="Close model palette"
			onclick={() => { paletteOpen = false; claudeMode = null; }}
		></button>
		<div class="modal-panel">
				<div class="modal-header">
					<h2>Select a model</h2>
					<Button class="ghost-button" variant="ghost" size="sm" onclick={() => { paletteOpen = false; claudeMode = null; }}>
						Close
					</Button>
				</div>

			{#if claudeMode}
				<div class="modal-section">
					<h3>{claudeMode === 'unlock' ? 'Unlock Claude key' : 'Save Claude key'}</h3>
					{#if claudeMode === 'setup'}
						<Input class="sidebar-input" bind:value={apiKeyInput} placeholder="Claude API key" />
					{/if}
					<Input class="sidebar-input" bind:value={passwordInput} placeholder="Password" type="password" />
					{#if claudeMode === 'setup'}
						<Input
							class="sidebar-input"
							bind:value={confirmPasswordInput}
							placeholder="Confirm password"
							type="password"
						/>
					{/if}
					{#if keyError}
						<div class="error-inline">{keyError}</div>
					{/if}
					<div class="modal-actions">
						<Button class="toolbar-button" variant="outline" size="sm" onclick={() => (claudeMode = null)}>Back</Button>
						<Button
							class="primary-button"
							onclick={claudeMode === 'unlock' ? unlockClaudeKey : saveClaudeCredentials}
						>
							{claudeMode === 'unlock' ? 'Unlock' : 'Save'}
						</Button>
					</div>
				</div>
			{:else}
				<div class="modal-grid">
					<section class="modal-section">
						<h3>Claude</h3>
						{#each CLAUDE_MODELS as model (model.id)}
							<Button class="model-option" variant="outline" onclick={() => startClaudeFlow(model.id)}>
								<span>{model.label}</span>
								<span>{Math.round(model.contextLength / 1000)}k</span>
							</Button>
						{/each}
					</section>

					<section class="modal-section">
						<h3>Ollama</h3>
						<Input class="sidebar-input" bind:value={ollamaUrl} placeholder="http://localhost:11434" />
						<Button class="primary-button" onclick={() => connectOllama(ollamaUrl)}>
							{ollamaStatus === 'connecting' ? 'Connecting…' : 'Connect'}
						</Button>
						{#each ollamaModels as model (model)}
							<Button
								class="model-option"
								variant="outline"
								onclick={() => {
									activeModel = { provider: 'ollama', modelId: model };
									paletteOpen = false;
								}}
							>
								<span>{model}</span>
								<span>local</span>
							</Button>
						{/each}
					</section>
				</div>
			{/if}
		</div>
	{/if}

	{#if searchOpen}
		<button class="modal-scrim" type="button" aria-label="Close search" onclick={() => (searchOpen = false)}></button>
		<div class="search-dialog">
			<div class="search-dialog-header">
				<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="7.5" cy="7.5" r="5" /><path d="M13 13l3 3" stroke-linecap="round" /></svg>
				<Input id="search" bind:value={searchQuery} class="search-input" placeholder="Search chats and projects" />
				<label class="check-row compact">
					<input type="checkbox" bind:checked={searchAllChats} />
					<span>All chats</span>
				</label>
			</div>
			<div class="search-results search-dialog-results">
				{#if searchItems.length === 0}
					<div class="search-empty">{searchQuery.trim().length > 0 ? 'No results found.' : 'No exchanges yet.'}</div>
				{/if}
				{#each searchItems.slice(0, 40) as result (result.rootIndex + ':' + result.exchangeId)}
					<button class="search-result" type="button" onclick={() => { handleSearchSelect(result); searchOpen = false; }}>
						<div class="search-result-title">{result.prompt}</div>
						{#if result.snippets[0]}
							<div class="search-result-snippet">{result.snippets[0].text}</div>
						{/if}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	{#if deleteTargetId}
		{@const children = activeExchanges ? getChildExchanges(activeExchanges, deleteTargetId, exchangesByParentId) : []}
		<button class="modal-scrim" type="button" aria-label="Close delete dialog" onclick={() => (deleteTargetId = null)}></button>
		<div class="modal-panel delete-panel">
			<div class="modal-header">
				<h2>Delete exchange</h2>
				<Button class="ghost-button" variant="ghost" size="sm" onclick={() => (deleteTargetId = null)}>Close</Button>
			</div>
			<div class="modal-section">
				<p class="field-label">
					Choose what should be removed with this exchange.
				</p>
				<label class="delete-option">
					<input type="radio" bind:group={deleteMode} value="exchange" disabled={children.length > 1} />
					<span>Delete this exchange only</span>
				</label>
				<label class="delete-option">
					<input type="radio" bind:group={deleteMode} value="exchangeAndMainChat" />
					<span>Delete this exchange and main chat</span>
				</label>
				{#if children.length > 1}
					<label class="delete-option">
						<input type="radio" bind:group={deleteMode} value="exchangeAndSideChats" />
						<span>Delete this exchange and side chats</span>
					</label>
				{/if}
				<div class="modal-actions">
					<Button class="ghost-button" variant="ghost" size="sm" onclick={() => (deleteTargetId = null)}>Cancel</Button>
					<Button class="primary-button" variant="destructive" onclick={confirmDelete}>Confirm delete</Button>
				</div>
			</div>
		</div>
	{/if}
</div>
