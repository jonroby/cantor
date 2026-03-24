<svelte:options runes={false} />

<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount, tick } from 'svelte';
	import { buildInitialExchanges } from '$lib/chat/initialExchanges';
	import { computeCanvasLayout, NODE_HEIGHT, NODE_WIDTH } from '$lib/chat/layout';
	import { streamClaudeChat } from '$lib/chat/claude';
	import { CLAUDE_MODELS, type ActiveModel, type OllamaStatus } from '$lib/chat/models';
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

	let roots: ExchangeMap[] = [withExplicitExchangeOrder(buildInitialExchanges())];
	let activeRootIndex = 0;
	let activeExchangeId: string | null = null;
	let streamingExchangeIds: string[] = [];
	let operationError: string | null = null;

	let activeModel: ActiveModel | null = null;
	let contextLength: number | null = null;
	let ollamaUrl = DEFAULT_OLLAMA_URL;
	let ollamaStatus: OllamaStatus = 'disconnected';
	let ollamaModels: string[] = [];
	let claudeApiKey: string | null = null;
	let hasStoredKey = false;

	let composerValue = '';
	let searchQuery = '';
	let searchAllChats = true;
	let paletteOpen = false;
	let claudeMode: 'unlock' | 'setup' | null = null;
	let pendingClaudeModelId: string | null = null;
	let expandedSideChatParent: string | null = null;
	let passwordInput = '';
	let confirmPasswordInput = '';
	let apiKeyInput = '';
	let keyError: string | null = null;
	let deleteTargetId: string | null = null;
	let deleteMode: DeleteMode = 'exchange';

	let scrollViewport: HTMLDivElement | null = null;
	const nodeElements = new Map<string, HTMLElement>();

	$: activeExchanges = roots[activeRootIndex] ?? roots[0];
	$: exchangesByParentId = activeExchanges ? buildExchangesByParentId(activeExchanges) : {};
	$: collapsedParentIds = getCollapsedParentIds();
	$: hiddenExchangeIds = getHiddenExchangeIds();
	$: canvas = activeExchanges
		? computeCanvasLayout(activeExchanges, { hiddenExchangeIds })
		: computeCanvasLayout({});
	$: nodeLookup = new Map(canvas.nodes.map((node) => [node.id, node]));
	$: usedTokens =
		activeExchanges && activeExchangeId ? getPathTokenTotal(activeExchanges, activeExchangeId) : 0;
	$: searchItems = searchQuery.trim()
		? searchChats(roots, searchQuery.trim(), searchAllChats ? roots.map((_, index) => index) : [activeRootIndex])
		: getDefaultItems(roots, activeRootIndex, searchAllChats);
	$: submitDisabledReason =
		streamingExchangeIds.length > 0
			? 'Wait for the current response to finish.'
			: !activeModel
				? 'Select a model first.'
				: activeExchangeId && activeExchanges && !canAcceptNewChat(activeExchanges, activeExchangeId, exchangesByParentId)
					? 'Choose a branch tip or main-chain node to continue.'
				: null;

	$: if (browser) {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				roots,
				activeRootIndex
			})
		);
	}

	$: if (activeExchanges && (!activeExchangeId || !activeExchanges[activeExchangeId])) {
		activeExchangeId = getMainChatTail(activeExchanges);
	}

	$: if (expandedSideChatParent && activeExchanges && !activeExchanges[expandedSideChatParent]) {
		expandedSideChatParent = null;
	}

	$: if (browser && activeModel?.provider === 'claude') {
		contextLength =
			CLAUDE_MODELS.find((model) => model.id === activeModel?.modelId)?.contextLength ?? null;
	}

	$: if (browser && activeModel?.provider === 'ollama') {
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

	onMount(() => {
		hasStoredKey = hasVault();

		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			activeExchangeId = getMainChatTail(roots[0]);
			return;
		}

		try {
			const parsed = JSON.parse(raw) as {
				roots?: ExchangeMap[];
				activeRootIndex?: number;
			};

			if (parsed.roots?.length) {
				roots = parsed.roots.map((root) => withExplicitExchangeOrder(root));
			}

			if (typeof parsed.activeRootIndex === 'number') {
				activeRootIndex = clampRootIndex(parsed.activeRootIndex, roots.length);
			}

			activeExchangeId = getMainChatTail(roots[activeRootIndex]);
		} catch {
			activeExchangeId = getMainChatTail(roots[0]);
		}
	});

	function bindNode(node: HTMLElement, nodeId: string) {
		nodeElements.set(nodeId, node);
		return {
			destroy() {
				nodeElements.delete(nodeId);
			}
		};
	}

	function clampRootIndex(index: number, rootCount: number) {
		if (rootCount <= 0) return 0;
		return Math.min(Math.max(index, 0), rootCount - 1);
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
		void scrollToNode(activeExchangeId);
	}

	function replaceActiveRoot(nextRoot: ExchangeMap) {
		roots = roots.map((root, index) => (index === activeRootIndex ? nextRoot : root));
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
		void scrollToNode(firstCopiedId);
	}

	async function scrollToNode(nodeId: string | null) {
		if (!nodeId) return;
		await tick();
		const node = nodeElements.get(nodeId);
		node?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
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
		const created = addExchangeResult(activeExchanges, parentId, prompt, '', activeModel.modelId);
		replaceActiveRoot(created.exchanges);
		activeExchangeId = created.id;
		streamingExchangeIds = [...streamingExchangeIds, created.id];
		composerValue = '';
		await scrollToNode(created.id);

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

	function deleteActiveExchange() {
		if (!activeExchanges || !activeExchangeId) return;
		try {
			const result = deleteExchangeWithModeResult(activeExchanges, activeExchangeId, 'exchange');
			replaceActiveRoot(result.exchanges);
			activeExchangeId = getMainChatTail(result.exchanges);
			operationError = null;
		} catch (error) {
			operationError = error instanceof Error ? error.message : 'Unable to delete exchange.';
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
		void scrollToNode(result.exchangeId);
	}

	function toggleSideChildren(exchangeId: string) {
		expandedSideChatParent = expandedSideChatParent === exchangeId ? null : exchangeId;
	}

	function getExchangeState(exchangeId: string) {
		const exchange = activeExchanges?.[exchangeId];
		const children = exchange && activeExchanges ? getChildExchanges(activeExchanges, exchangeId, exchangesByParentId) : [];
		const hasSideChildren = canCreateSideChats(activeExchanges, exchangeId, exchangesByParentId) && children.length > 1;
		const isSideRoot = exchange?.parentId
			? (getChildExchanges(activeExchanges, exchange.parentId, exchangesByParentId)[0]?.id ?? null) !== exchangeId
			: false;

		return {
			exchange,
			children,
			hasSideChildren,
			isSideRoot,
			canPromote:
				!!activeExchanges && canPromoteSideChatToMainChat(activeExchanges, exchangeId, exchangesByParentId)
		};
	}
</script>

<svelte:head>
	<title>Superset Svelte</title>
</svelte:head>

<div class="app-shell">
	<aside class="sidebar">
		<div class="sidebar-section">
			<div class="sidebar-title-row">
				<h2>Chats</h2>
				<button class="ghost-button" type="button" on:click={saveToDisk}>Export</button>
			</div>

			<div class="root-switcher">
				<button type="button" class="ghost-button" on:click={() => selectRoot(activeRootIndex - 1)}>
					Prev
				</button>
				<div class="root-label">
					{activeRootIndex === 0 ? 'Main chat' : `Side chat ${activeRootIndex}`}
				</div>
				<button type="button" class="ghost-button" on:click={() => selectRoot(activeRootIndex + 1)}>
					Next
				</button>
			</div>
		</div>

		<div class="sidebar-section">
			<label class="field-label" for="search">Search</label>
			<input id="search" bind:value={searchQuery} class="sidebar-input" placeholder="Search prompts and responses" />
			<label class="check-row">
				<input type="checkbox" bind:checked={searchAllChats} />
				<span>Search all chats</span>
			</label>
			<div class="search-results">
				{#each searchItems.slice(0, 40) as result (result.rootIndex + ':' + result.exchangeId)}
					<button class="search-result" type="button" on:click={() => handleSearchSelect(result)}>
						<div class="search-result-title">{result.prompt}</div>
						{#if result.snippets[0]}
							<div class="search-result-snippet">{result.snippets[0].text}</div>
						{/if}
					</button>
				{/each}
			</div>
		</div>

		<div class="sidebar-section">
			<div class="sidebar-title-row">
				<h2>Model</h2>
				<button class="ghost-button" type="button" on:click={() => (paletteOpen = true)}>Select</button>
			</div>
			<div class="model-pill">
				{#if activeModel}
					<span>{activeModel.provider}:{activeModel.modelId}</span>
				{:else}
					<span>No model selected</span>
				{/if}
			</div>
			{#if contextLength}
				<div class="token-meta">{usedTokens.toLocaleString()} / {contextLength.toLocaleString()} tokens</div>
				<div class="progress-track">
					<div
						class="progress-fill"
						style={`width: ${Math.min(100, (usedTokens / Math.max(1, contextLength)) * 100)}%`}
					></div>
				</div>
			{/if}
			{#if claudeApiKey || hasStoredKey}
				<button class="ghost-button danger-text" type="button" on:click={forgetClaudeKey}>
					Forget Claude key
				</button>
			{/if}
		</div>
	</aside>

	<main class="canvas-shell">
		{#if operationError}
			<div class="error-banner">{operationError}</div>
		{/if}

		<div class="toolbar">
			<button class="toolbar-button" type="button" on:click={() => scrollViewport?.scrollTo({ top: 0, left: 0, behavior: 'smooth' })}>
				Top
			</button>
			<button class="toolbar-button" type="button" on:click={() => scrollToNode(activeExchangeId)}>
				Active
			</button>
			<button class="toolbar-button" type="button" disabled={!activeExchangeId} on:click={deleteActiveExchange}>
				Delete
			</button>
			<button
				class="toolbar-button"
				type="button"
				disabled={!activeExchangeId || !activeExchanges || !canPromoteSideChatToMainChat(activeExchanges, activeExchangeId)}
				on:click={promoteActiveExchange}
			>
				Promote
			</button>
		</div>

		<div class="canvas-viewport" bind:this={scrollViewport}>
			<div class="canvas-surface" style={`width:${canvas.width}px; height:${canvas.height}px;`}>
				<svg class="edges-layer" width={canvas.width} height={canvas.height}>
					{#each canvas.edges as edge (edge.id)}
						{@const fromNode = nodeLookup.get(edge.from)}
						{@const toNode = nodeLookup.get(edge.to)}
						{#if fromNode && toNode}
							<path
								d={`M ${fromNode.x + NODE_WIDTH} ${fromNode.y + NODE_HEIGHT / 2} C ${fromNode.x + NODE_WIDTH + 36} ${fromNode.y + NODE_HEIGHT / 2}, ${toNode.x - 36} ${toNode.y + NODE_HEIGHT / 2}, ${toNode.x} ${toNode.y + NODE_HEIGHT / 2}`}
								class="edge-path"
							></path>
						{/if}
					{/each}
				</svg>

				{#each canvas.nodes as node (node.id)}
					{@const exchange = activeExchanges[node.id]}
					{@const state = getExchangeState(node.id)}
					<div
						class:active-node={activeExchangeId === node.id}
						class="exchange-card"
						style={`transform: translate(${node.x}px, ${node.y}px); width:${NODE_WIDTH}px;`}
						role="button"
						tabindex="0"
						use:bindNode={node.id}
						on:click={() => (activeExchangeId = node.id)}
						on:keydown={(event) => {
							if (event.key === 'Enter' || event.key === ' ') {
								event.preventDefault();
								activeExchangeId = node.id;
							}
						}}
					>
						<div class="exchange-card-header">
							<div>
								<div class="exchange-card-kicker">Depth {node.depth + 1}</div>
								<h3>{exchange.model ?? 'Unsaved prompt'}</h3>
							</div>
							{#if streamingExchangeIds.includes(node.id)}
								<div class="streaming-dot"></div>
							{/if}
						</div>
						<div class="exchange-actions">
							{#if activeRootIndex === 0}
								<button class="chip-button" type="button" on:click|stopPropagation={() => createSideChat(node.id)}>
									Side chat
								</button>
							{/if}
							{#if state.hasSideChildren}
								<button class="chip-button" type="button" on:click|stopPropagation={() => toggleSideChildren(node.id)}>
									{collapsedParentIds.has(node.id) ? 'Show branches' : 'Hide branches'}
								</button>
							{/if}
							{#if state.isSideRoot}
								<button
									class="chip-button"
									type="button"
									disabled={!state.canPromote}
									on:click|stopPropagation={() => {
										activeExchangeId = node.id;
										promoteActiveExchange();
									}}
								>
									Promote
								</button>
							{/if}
							<button class="chip-button danger-text" type="button" on:click|stopPropagation={() => openDeleteDialog(node.id)}>
								Delete
							</button>
						</div>
						<div class="exchange-prompt">{exchange.prompt}</div>
						<div class="exchange-response">{exchange.response || 'Waiting for response…'}</div>
					</div>
				{/each}
			</div>
		</div>

		<form
			class="composer"
			on:submit|preventDefault={submitPrompt}
		>
			<div class="composer-row">
				<input
					bind:value={composerValue}
					class="composer-input"
					placeholder={submitDisabledReason ?? 'Message the selected branch'}
				/>
				<button class="composer-button" type="submit" disabled={!!submitDisabledReason || !composerValue.trim()}>
					Send
				</button>
			</div>
			<div class="composer-meta">
				<span>{activeExchangeId ? `Selected: ${activeExchangeId}` : 'Starting a new main-chain exchange'}</span>
				{#if activeExchangeId && activeExchanges && !canAcceptNewChat(activeExchanges, activeExchangeId, exchangesByParentId)}
					<span>Choose a branch tip or main-chain node to continue.</span>
				{/if}
				{#if submitDisabledReason}
					<span>{submitDisabledReason}</span>
				{/if}
			</div>
		</form>
	</main>

	{#if paletteOpen}
		<button
			class="modal-scrim"
			type="button"
			aria-label="Close model palette"
			on:click={() => ((paletteOpen = false), (claudeMode = null))}
		></button>
		<div class="modal-panel">
			<div class="modal-header">
				<h2>Select a model</h2>
				<button class="ghost-button" type="button" on:click={() => ((paletteOpen = false), (claudeMode = null))}>
					Close
				</button>
			</div>

			{#if claudeMode}
				<div class="modal-section">
					<h3>{claudeMode === 'unlock' ? 'Unlock Claude key' : 'Save Claude key'}</h3>
					{#if claudeMode === 'setup'}
						<input class="sidebar-input" bind:value={apiKeyInput} placeholder="Claude API key" />
					{/if}
					<input class="sidebar-input" bind:value={passwordInput} placeholder="Password" type="password" />
					{#if claudeMode === 'setup'}
						<input
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
						<button class="toolbar-button" type="button" on:click={() => (claudeMode = null)}>Back</button>
						<button
							class="primary-button"
							type="button"
							on:click={claudeMode === 'unlock' ? unlockClaudeKey : saveClaudeCredentials}
						>
							{claudeMode === 'unlock' ? 'Unlock' : 'Save'}
						</button>
					</div>
				</div>
			{:else}
				<div class="modal-grid">
					<section class="modal-section">
						<h3>Claude</h3>
						{#each CLAUDE_MODELS as model (model.id)}
							<button class="model-option" type="button" on:click={() => startClaudeFlow(model.id)}>
								<span>{model.label}</span>
								<span>{Math.round(model.contextLength / 1000)}k</span>
							</button>
						{/each}
					</section>

					<section class="modal-section">
						<h3>Ollama</h3>
						<input class="sidebar-input" bind:value={ollamaUrl} placeholder="http://localhost:11434" />
						<button class="primary-button" type="button" on:click={() => connectOllama(ollamaUrl)}>
							{ollamaStatus === 'connecting' ? 'Connecting…' : 'Connect'}
						</button>
						{#each ollamaModels as model (model)}
							<button
								class="model-option"
								type="button"
								on:click={() => {
									activeModel = { provider: 'ollama', modelId: model };
									paletteOpen = false;
								}}
							>
								<span>{model}</span>
								<span>local</span>
							</button>
						{/each}
					</section>
				</div>
			{/if}
		</div>
	{/if}

	{#if deleteTargetId}
		{@const children = activeExchanges ? getChildExchanges(activeExchanges, deleteTargetId, exchangesByParentId) : []}
		<button class="modal-scrim" type="button" aria-label="Close delete dialog" on:click={() => (deleteTargetId = null)}></button>
		<div class="modal-panel delete-panel">
			<div class="modal-header">
				<h2>Delete exchange</h2>
				<button class="ghost-button" type="button" on:click={() => (deleteTargetId = null)}>Close</button>
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
					<button class="ghost-button" type="button" on:click={() => (deleteTargetId = null)}>Cancel</button>
					<button class="primary-button" type="button" on:click={confirmDelete}>Confirm delete</button>
				</div>
			</div>
		</div>
	{/if}
</div>
