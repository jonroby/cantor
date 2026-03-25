<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { buildInitialExchanges } from '$lib/chat/initialExchanges';
	import { computeCanvasLayout, NODE_WIDTH } from '$lib/chat/layout';
	import type { CanvasNode } from '$lib/chat/layout';
	import { streamClaudeChat } from '$lib/chat/claude';
	import { streamGeminiChat } from '$lib/chat/gemini';
	import { streamOpenAICompatChat } from '$lib/chat/openai-compat';
	import { CLAUDE_MODELS, PROVIDER_CONFIG, PROVIDER_MODELS, getModelContextLength, getProviderForModelId, isKeyBasedProvider, type ActiveModel, type OllamaStatus, type Provider } from '$lib/chat/models';
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
	import { clearVault, clearProviderKey, hasVault, loadAllApiKeys, migrateVault, saveApiKey, storedProviders as getStoredProviders } from '$lib/chat/vault';
	import * as SidebarPrimitive from '@/components/ui/sidebar/index.js';
	import * as Tooltip from '@/components/ui/tooltip/index.js';
	import AppSidebar from '$lib/components/AppSidebar.svelte';
	import ModelPalette from '$lib/components/ModelPalette.svelte';
	import type { ChatSession } from '$lib/chat/tree';

	const STORAGE_KEY = 'chat-tree-store-svelte';

	function makeSession(roots: ExchangeMap[], name?: string): ChatSession {
		return {
			id: crypto.randomUUID(),
			name: name ?? `Chat ${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`,
			roots,
			activeRootIndex: 0
		};
	}

	let sessions: ChatSession[] = $state([makeSession([withExplicitExchangeOrder(buildInitialExchanges())], 'Chat 1')]);
	let activeSessionIndex = $state(0);

	let roots: ExchangeMap[] = $derived(sessions[activeSessionIndex]?.roots ?? sessions[0]?.roots ?? []);
	let activeRootIndex = $derived(sessions[activeSessionIndex]?.activeRootIndex ?? 0);
	let activeExchangeId: string | null = $state(null);
	let streamingExchangeIds: string[] = $state([]);
	let operationError: string | null = $state(null);

	let activeModel: ActiveModel | null = $state(null);
	let contextLength: number | null = $state(null);
	let ollamaUrl = $state(DEFAULT_OLLAMA_URL);
	let ollamaStatus: OllamaStatus = $state('disconnected');
	let ollamaModels: string[] = $state([]);
	let apiKeys: Record<string, string> = $state({});
	let vaultProviders: string[] = $state([]);

	let composerValue = $state('');
	let searchQuery = $state('');
	let searchAllChats = $state(true);
	let searchOpen = $state(false);
	let paletteOpen = $state(false);
	let expandedSideChatParent: string | null = $state(null);
	let hasHydrated = $state(false);
	let headerVisible = $state(true);
	let headerTimer: ReturnType<typeof setTimeout> | null = null;

	function handleCanvasWheel(e: WheelEvent) {
		if (e.deltaY < 0) {
			// Scrolling up — show header
			headerVisible = true;
			if (headerTimer) clearTimeout(headerTimer);
			headerTimer = setTimeout(() => { headerVisible = false; }, 2000);
		} else if (e.deltaY > 0) {
			// Scrolling down — hide header
			if (headerTimer) clearTimeout(headerTimer);
			headerVisible = false;
		}
	}
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
				JSON.stringify({ sessions, activeSessionIndex })
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
		if (activeModel && isKeyBasedProvider(activeModel.provider)) {
			contextLength = getModelContextLength(activeModel.provider, activeModel.modelId);
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
		migrateVault();
		vaultProviders = getStoredProviders();

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

		// Auto-hide header after initial display
		headerTimer = setTimeout(() => { headerVisible = false; }, 2000);

		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			try {
				const parsed = JSON.parse(raw) as {
					// new format
					sessions?: ChatSession[];
					activeSessionIndex?: number;
					// legacy format
					roots?: ExchangeMap[];
					activeRootIndex?: number;
				};

				if (parsed.sessions?.length) {
					const hydratedSessions = parsed.sessions.map((s) => ({
						...s,
						roots: s.roots.map((r) => withExplicitExchangeOrder(r))
					}));
					if (hydratedSessions.some((s) => hasRenderableExchanges(s.roots))) {
						sessions = hydratedSessions;
					}
					if (typeof parsed.activeSessionIndex === 'number') {
						activeSessionIndex = Math.min(Math.max(parsed.activeSessionIndex, 0), sessions.length - 1);
					}
				} else if (parsed.roots?.length) {
					// migrate legacy format
					const hydratedRoots = parsed.roots.map((root) => withExplicitExchangeOrder(root));
					if (hasRenderableExchanges(hydratedRoots)) {
						sessions = [makeSession(hydratedRoots, 'Chat 1')];
						activeSessionIndex = 0;
					}
				}
			} catch {
				// ignore invalid persisted state
			}
		}

		activeExchangeId = getMainChatTail(sessions[activeSessionIndex]?.roots[sessions[activeSessionIndex]?.activeRootIndex ?? 0] ?? sessions[0]?.roots[0]);
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

	function updateActiveSession(patch: Partial<Pick<ChatSession, 'roots' | 'activeRootIndex'>>) {
		sessions = sessions.map((s, i) =>
			i === activeSessionIndex ? { ...s, ...patch } : s
		);
	}

	function selectRoot(index: number) {
		const clamped = clampRootIndex(index, roots.length);
		updateActiveSession({ activeRootIndex: clamped });
		activeExchangeId = getMainChatTail(roots[clamped]);
		expandedSideChatParent = null;
		measuredNodeHeights = {};
		scrollToNode(activeExchangeId);
	}

	function replaceActiveRoot(nextRoot: ExchangeMap) {
		measuredNodeHeights = {};
		updateActiveSession({ roots: roots.map((root, index) => (index === activeRootIndex ? nextRoot : root)) });
	}

	function newChat() {
		const session = makeSession([withExplicitExchangeOrder(buildInitialExchanges())]);
		sessions = [...sessions, session];
		activeSessionIndex = sessions.length - 1;
		activeExchangeId = getMainChatTail(session.roots[0]);
		expandedSideChatParent = null;
		measuredNodeHeights = {};
	}

	function selectSession(index: number) {
		activeSessionIndex = Math.min(Math.max(index, 0), sessions.length - 1);
		const session = sessions[activeSessionIndex];
		activeExchangeId = getMainChatTail(session.roots[session.activeRootIndex ?? 0]);
		expandedSideChatParent = null;
		measuredNodeHeights = {};
	}

	function deleteSession(index: number) {
		if (sessions.length <= 1) return;
		sessions = sessions.filter((_, i) => i !== index);
		activeSessionIndex = Math.min(activeSessionIndex, sessions.length - 1);
		const session = sessions[activeSessionIndex];
		activeExchangeId = getMainChatTail(session.roots[session.activeRootIndex ?? 0]);
		expandedSideChatParent = null;
		measuredNodeHeights = {};
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

	function forkChat(exchangeId: string) {
		const sourceExchanges = activeExchanges;
		if (!sourceExchanges) return;

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

		const newRoots = [...roots, withExplicitExchangeOrder(copiedExchanges)];
		updateActiveSession({ roots: newRoots, activeRootIndex: newRoots.length - 1 });
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
		const payload = JSON.stringify({ sessions, activeSessionIndex }, null, 2);
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
		} catch (error) {
			ollamaStatus = 'error';
			ollamaModels = [];
			operationError = error instanceof Error ? error.message : 'Failed to connect to Ollama.';
		}
	}

	async function handleUnlockKeys(password: string) {
		apiKeys = await loadAllApiKeys(password);
	}

	async function handleSaveKey(provider: string, apiKey: string, password: string) {
		await saveApiKey(provider, apiKey, password);
		apiKeys = { ...apiKeys, [provider]: apiKey };
		vaultProviders = getStoredProviders();
	}

	function handleForgetKey(provider: string) {
		clearProviderKey(provider);
		const { [provider]: _, ...rest } = apiKeys;
		apiKeys = rest;
		vaultProviders = getStoredProviders();
		if (activeModel?.provider === provider) {
			activeModel = null;
		}
	}

	function handleSelectModel(model: ActiveModel) {
		activeModel = model;
	}

	function getProviderStream(model: ActiveModel, history: import('$lib/chat/tree').Message[], signal: AbortSignal) {
		const key = apiKeys[model.provider] ?? '';
		if (model.provider === 'ollama') {
			return streamOllamaChat(model.modelId, history, signal, ollamaUrl);
		}
		if (model.provider === 'claude') {
			return streamClaudeChat(model.modelId, history, key, signal);
		}
		if (model.provider === 'gemini') {
			return streamGeminiChat(model.modelId, history, key, signal);
		}
		// All others: OpenAI-compatible
		const config = PROVIDER_CONFIG[model.provider as Exclude<Provider, 'ollama'>];
		return streamOpenAICompatChat(config.baseUrl, model.modelId, history, key, signal);
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
			const stream = getProviderStream(activeModel, history, abortController.signal);

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
			provider: exchange.model ? (getProviderForModelId(exchange.model) ?? 'ollama') : null,
			isActive: activeExchangeId === exchangeId,
			isStreaming: streamingExchangeIds.includes(exchangeId),
			canFork: true,
			hasSideChildren,
			isSideRoot,
			canPromote: !!activeExchanges && canPromoteSideChatToMainChat(activeExchanges, exchangeId, exchangesByParentId),
			onMeasure: (height: number) => setMeasuredNodeHeight(exchangeId, height),
			onSelect: () => { activeExchangeId = exchangeId; },
			onFork: () => forkChat(exchangeId),
			onToggleSideChildren: () => toggleSideChildren(exchangeId),
			onPromote: () => { activeExchangeId = exchangeId; promoteActiveExchange(); },
			onDelete: () => openDeleteDialog(exchangeId)
		};
	}
</script>

<svelte:head>
	<title>Superset Svelte</title>
</svelte:head>

<SidebarPrimitive.Provider>
<AppSidebar
	{sessions}
	{activeSessionIndex}
	onSelectSession={selectSession}
	onNewChat={newChat}
	onDeleteSession={deleteSession}
/>
<SidebarPrimitive.Inset>
<div class="page-shell" onwheel={handleCanvasWheel}>
	<div class="chat-header" class:chat-header-hidden={!headerVisible}>
		{#if roots.length > 1}
			<Button class="chat-nav" variant="outline" size="icon" disabled={activeRootIndex === 0} onclick={() => selectRoot(activeRootIndex - 1)}>
				<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 2L4 7l5 5" /></svg>
			</Button>
		{/if}
		<div class="chat-header-label">{activeRootIndex === 0 ? 'Main Chat' : `Fork ${activeRootIndex}`}</div>
		{#if roots.length > 1}
			<Button class="chat-nav" variant="outline" size="icon" disabled={activeRootIndex === roots.length - 1} onclick={() => selectRoot(activeRootIndex + 1)}>
				<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 2l5 5-5 5" /></svg>
			</Button>
		{/if}
	</div>

	{#if operationError}
		<div class="error-banner">{operationError}</div>
	{/if}

	<div class="floating-actions">
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<Button {...props} class="floating-button" variant="outline" size="icon" onclick={() => (searchOpen = true)} ariaLabel="Search">
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="6.5" cy="6.5" r="4" /><path d="M11 11l2.5 2.5" stroke-linecap="round" /></svg>
					</Button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="left" class="bg-neutral-900 text-white text-xs border-none">Search</Tooltip.Content>
		</Tooltip.Root>
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<Button {...props} class="floating-button" variant="outline" size="icon" onclick={() => canvasRef?.fitView({ duration: 250, maxZoom: 1 })} ariaLabel="Fit view">
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="10" height="10" rx="1.5" /><path d="M6 6h4M6 8h4M6 10h2" stroke-linecap="round" /></svg>
					</Button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="left" class="bg-neutral-900 text-white text-xs border-none">Fit view</Tooltip.Content>
		</Tooltip.Root>
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<Button {...props} class="floating-button" variant="outline" size="icon" onclick={() => { const first = canvas.nodes[0]; if (first && canvasRef) canvasRef.scrollNodeToTop(first.y, first.x + NODE_WIDTH / 2, { zoom: 1, duration: 250, topOffset: 60 }); }} ariaLabel="Go to top">
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 12V4M8 4 5.5 6.5M8 4l2.5 2.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
					</Button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="left" class="bg-neutral-900 text-white text-xs border-none">Go to top</Tooltip.Content>
		</Tooltip.Root>
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<Button {...props} class="floating-button" variant="outline" size="icon" onclick={() => scrollToNode(activeExchangeId)} ariaLabel="Go to active">
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="5" /><circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" /></svg>
					</Button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="left" class="bg-neutral-900 text-white text-xs border-none">Go to active</Tooltip.Content>
		</Tooltip.Root>
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<Button {...props} class="floating-button" variant="outline" size="icon" onclick={saveToDisk} ariaLabel="Download chat">
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 13h10M8 3v7M5 7l3 3 3-3" stroke-linecap="round" stroke-linejoin="round" /></svg>
					</Button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="left" class="bg-neutral-900 text-white text-xs border-none">Download chat</Tooltip.Content>
		</Tooltip.Root>
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

	<ModelPalette
		open={paletteOpen}
		onClose={() => { paletteOpen = false; }}
		{activeModel}
		onSelectModel={handleSelectModel}
		{ollamaUrl}
		{ollamaStatus}
		{ollamaModels}
		onConnectOllama={connectOllama}
		{apiKeys}
		{vaultProviders}
		onUnlockKeys={handleUnlockKeys}
		onSaveKey={handleSaveKey}
		onForgetKey={handleForgetKey}
	/>

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
</SidebarPrimitive.Inset>
</SidebarPrimitive.Provider>
