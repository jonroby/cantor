<script lang="ts">
	import { onMount, tick } from 'svelte';
	import JSZip from 'jszip';
	import { toast } from 'svelte-sonner';
	import Toaster from '@/shadcn/ui/sonner/sonner.svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { buildInitialExchanges } from '@/lib/chat/initialExchanges';
	import { computeCanvasLayout, NODE_WIDTH } from '@/lib/chat/layout';
	import type { CanvasNode } from '@/lib/chat/layout';
	import { streamClaudeChat } from '@/lib/chat/claude';
	import { streamGeminiChat } from '@/lib/chat/gemini';
	import { streamOpenAICompatChat } from '@/lib/chat/openai-compat';
	import {
		PROVIDER_CONFIG,
		getModelContextLength,
		getProviderForModelId,
		isKeyBasedProvider,
		type ActiveModel,
		type OllamaStatus,
		type Provider
	} from '@/lib/chat/models';
	import Button from '@/components/ui/button.svelte';
	import ExchangeNode from '@/components/canvas/ExchangeNode.svelte';
	import CodeEditor from '@/components/canvas/CodeEditor.svelte';
	import PythonEditor from '@/components/canvas/PythonEditor.svelte';
	import Canvas from '@/components/canvas/Canvas.svelte';
	import DrawingBoard from '@/components/canvas/DrawingBoard.svelte';
	import DocsPanel from '@/components/canvas/DocsPanel.svelte';
	import type { Shape } from '@/lib/drawing/types';
	import {
		DEFAULT_OLLAMA_URL,
		fetchAvailableModels,
		fetchModelContextLength,
		streamOllamaChat
	} from '@/lib/chat/ollama';
	import {
		getWebLLMModels,
		loadWebLLMModel,
		streamWebLLMChat,
		deleteModelCache,
		deleteAllModelCaches,
		WEBLLM_CONTEXT_OPTIONS,
		type WebLLMStatus,
		type WebLLMModelEntry,
		type WebLLMContextSize
	} from '@/lib/chat/webllm';
	import { getDefaultItems, searchChats, type SearchResult } from '@/lib/chat/search';
	import {
		ROOT_ANCHOR_ID,
		addExchangeResult,
		buildEmptyExchanges,
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
		hasExplicitExchangeOrder,
		promoteSideChatToMainChat,
		type DeleteMode,
		type Exchange,
		type ExchangeMap,
		updateExchangeResponse,
		updateExchangeTokens,
		withExplicitExchangeOrder,
		type DocFile
	} from '@/lib/chat/tree';
	import {
		clearProviderKey,
		loadAllApiKeys,
		migrateVault,
		saveApiKey,
		storedProviders as getStoredProviders
	} from '@/lib/chat/vault';
	import * as SidebarPrimitive from '@/shadcn/ui/sidebar/index.js';
	import { AppSidebar } from '@/components/app-sidebar';
	import { ModelPalette } from '@/components/model-palette';
	import { FloatingActions } from '@/components/floating-actions';
	import { SearchDialog } from '@/components/search-dialog';
	import { ChatHeader } from '@/components/chat-header';
	import { Composer } from '@/components/composer';
	import type { ChatSession, ChatFolder } from '@/lib/chat/tree';
	import { validateChatSessionUpload } from '@/lib/chat/tree';

	const STORAGE_KEY = 'chat-tree-store-svelte';

	function makeSession(roots: ExchangeMap[], name?: string): ChatSession {
		return {
			id: crypto.randomUUID(),
			name: name ?? `Chat ${sessions.length + 1}`,
			roots,
			activeRootIndex: 0
		};
	}

	let sessions: ChatSession[] = $state([
		makeSession([withExplicitExchangeOrder(buildInitialExchanges())], 'Chat 1')
	]);
	let activeSessionIndex = $state(0);
	let folders: ChatFolder[] = $state([]);

	interface OpenDoc {
		id: string;
		content: string;
		docKey: { folderId: string; fileId: string } | null;
	}

	let openDocs: OpenDoc[] = $state([
		{
			id: crypto.randomUUID(),
			content: `# Superset Svelte

Welcome to the documentation.

## Getting Started

This is a visual canvas for exploring branching chat conversations.

## Math Support

Inline math: $E = mc^2$

Display math:

$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$

## Features

- **Sessions** — top-level chat sessions
- **Forks** — copy conversation into a new root
- **Side Chats** — sibling branches off existing nodes`,
			docKey: null
		}
	]);

	let roots: ExchangeMap[] = $derived(
		sessions[activeSessionIndex]?.roots ?? sessions[0]?.roots ?? []
	);
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

	let webllmStatus: WebLLMStatus = $state('idle');
	let webllmProgress = $state(0);
	let webllmProgressText = $state('');
	let webllmModels: WebLLMModelEntry[] = $state([]);
	let webllmError: string | null = $state(null);
	let webllmContextSize: WebLLMContextSize = $state(4_096);

	let composerValue = $state('');
	let canvasMode = $state(false);
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
			headerTimer = setTimeout(() => {
				headerVisible = false;
			}, 2000);
		} else if (e.deltaY > 0) {
			// Scrolling down — hide header
			if (headerTimer) clearTimeout(headerTimer);
			headerVisible = false;
		}
	}
	let deleteTargetId: string | null = $state(null);
	let deleteMode: DeleteMode = $state('exchange');
	let measuredNodeHeights: Record<string, number> = $state({});

	let drawingShapes: Shape[] = $state([]);
	let canvasRef: Canvas | null = $state(null);

	let activeExchanges = $derived(roots[activeRootIndex] ?? roots[0]);
	let exchangesByParentId = $derived(
		activeExchanges ? buildExchangesByParentId(activeExchanges) : {}
	);
	let collapsedParentIds = $derived(getCollapsedParentIds());
	let hiddenExchangeIds = $derived(getHiddenExchangeIds());
	let canvas = $derived(
		activeExchanges
			? computeCanvasLayout(activeExchanges, {
					hiddenExchangeIds,
					measuredHeights: measuredNodeHeights,
					docsPanelCount: openDocs.length
				})
			: computeCanvasLayout({}, { docsPanelCount: openDocs.length })
	);
	let nodeLookup = $derived(new Map(canvas.nodes.map((node) => [node.id, node])));
	let usedTokens = $derived(
		activeExchanges && activeExchangeId ? getPathTokenTotal(activeExchanges, activeExchangeId) : 0
	);
	let searchItems = $derived(
		searchQuery.trim()
			? searchChats(
					roots,
					searchQuery.trim(),
					searchAllChats ? roots.map((_: ExchangeMap, index: number) => index) : [activeRootIndex]
				)
			: getDefaultItems(roots, activeRootIndex, searchAllChats)
	);
	let submitDisabledReason = $derived(
		streamingExchangeIds.length > 0
			? 'Wait for the current response to finish.'
			: !activeModel
				? 'Select a model first.'
				: activeExchangeId &&
					  activeExchanges &&
					  !canAcceptNewChat(activeExchanges, activeExchangeId, exchangesByParentId)
					? 'Choose a branch tip or main-chain node to continue.'
					: null
	);

	$effect(() => {
		if (hasHydrated) {
			localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessions, activeSessionIndex, folders }));
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
					if (
						activeModel?.provider === 'ollama' &&
						activeModel.modelId === modelId &&
						ollamaUrl === url
					) {
						contextLength = length;
					}
				} catch {
					if (
						activeModel?.provider === 'ollama' &&
						activeModel.modelId === modelId &&
						ollamaUrl === url
					) {
						contextLength = null;
					}
				}
			})();
		}
	});

	onMount(() => {
		migrateVault();
		vaultProviders = getStoredProviders();
		webllmModels = getWebLLMModels();

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

		function hasFiles(dt: DataTransfer | null): boolean {
			if (!dt) return false;
			return Array.from(dt.types).includes('Files');
		}

		function handleWindowDragOver(e: DragEvent) {
			if (!hasFiles(e.dataTransfer)) return;
			e.preventDefault();
			e.dataTransfer!.dropEffect = 'copy';
		}

		function handleWindowDrop(e: DragEvent) {
			if (!hasFiles(e.dataTransfer)) return;
			e.preventDefault();
		}

		window.addEventListener('dragover', handleWindowDragOver);
		window.addEventListener('drop', handleWindowDrop);

		// Auto-hide header after initial display
		headerTimer = setTimeout(() => {
			headerVisible = false;
		}, 2000);

		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			try {
				const parsed = JSON.parse(raw) as {
					// new format
					sessions?: ChatSession[];
					activeSessionIndex?: number;
					folders?: ChatFolder[];
					// legacy format
					roots?: ExchangeMap[];
					activeRootIndex?: number;
				};

				if (parsed.sessions?.length) {
					const hydratedSessions = parsed.sessions.map((s) => ({
						...s,
						roots: s.roots.map((r) =>
							hasExplicitExchangeOrder(r) ? r : withExplicitExchangeOrder(r)
						)
					}));
					if (hydratedSessions.some((s) => hasRenderableExchanges(s.roots))) {
						sessions = hydratedSessions;
					}
					if (typeof parsed.activeSessionIndex === 'number') {
						activeSessionIndex = Math.min(
							Math.max(parsed.activeSessionIndex, 0),
							sessions.length - 1
						);
					}
				} else if (parsed.roots?.length) {
					// migrate legacy format
					const hydratedRoots = parsed.roots.map((root) => withExplicitExchangeOrder(root));
					if (hasRenderableExchanges(hydratedRoots)) {
						sessions = [makeSession(hydratedRoots, 'Chat 1')];
						activeSessionIndex = 0;
					}
				}
				if (parsed.folders?.length) {
					folders = parsed.folders;
				}
			} catch {
				// ignore invalid persisted state
			}
		}

		activeExchangeId = getMainChatTail(
			sessions[activeSessionIndex]?.roots[sessions[activeSessionIndex]?.activeRootIndex ?? 0] ??
				sessions[0]?.roots[0]
		);
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

		return () => {
			window.removeEventListener('keydown', handleKeyDown);
			if (headerTimer) clearTimeout(headerTimer);
		};
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
		if (!activeExchanges) return new SvelteSet<string>();

		const hidden = new SvelteSet<string>();

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
		sessions = sessions.map((s, i) => (i === activeSessionIndex ? { ...s, ...patch } : s));
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
		updateActiveSession({
			roots: roots.map((root, index) => (index === activeRootIndex ? nextRoot : root))
		});
	}

	function newChat(): number {
		const session = makeSession([buildEmptyExchanges()]);
		sessions = [...sessions, session];
		activeSessionIndex = sessions.length - 1;
		activeExchangeId = getMainChatTail(session.roots[0]);
		expandedSideChatParent = null;
		measuredNodeHeights = {};
		return sessions.length - 1;
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

	function renameSession(index: number, name: string) {
		sessions[index].name = name;
		sessions = sessions;
	}

	function downloadSession(index: number) {
		const session = sessions[index];
		const payload = JSON.stringify(session, null, 2);
		const blob = new Blob([payload], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `${session.name.replace(/[^a-zA-Z0-9-_ ]/g, '')}.json`;
		link.click();
		URL.revokeObjectURL(url);
	}

	function uploadChat() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) return;
			try {
				const text = await file.text();
				const data = JSON.parse(text);
				const session = validateChatSessionUpload(data);
				session.id = crypto.randomUUID();
				const baseName = file.name.replace(/\.json$/i, '');
				const existingNames = new Set(sessions.map((s) => s.name));
				let name = baseName;
				let i = 1;
				while (existingNames.has(name)) {
					name = `${baseName} (${i})`;
					i++;
				}
				session.name = name;
				sessions = [...sessions, session];
				activeSessionIndex = sessions.length - 1;
				const s = sessions[activeSessionIndex];
				activeExchangeId = getMainChatTail(s.roots[s.activeRootIndex ?? 0]);
				expandedSideChatParent = null;
				measuredNodeHeights = {};
				toast.success(`Imported "${session.name}"`);
			} catch (e) {
				toast.error(e instanceof Error ? e.message : 'Invalid chat file');
			}
		};
		input.click();
	}

	function newFolder(): string {
		const existingNames = new Set(folders.map((f) => f.name));
		let name = 'New Folder';
		let i = 2;
		while (existingNames.has(name)) {
			name = `New Folder ${i}`;
			i++;
		}
		const folder: ChatFolder = {
			id: crypto.randomUUID(),
			name
		};
		folders = [...folders, folder];
		return folder.id;
	}

	function deleteFolder(folderId: string) {
		sessions = sessions.map((s) => (s.folderId === folderId ? { ...s, folderId: null } : s));
		folders = folders.filter((f) => f.id !== folderId);
	}

	function renameFolder(folderId: string, name: string): boolean {
		const conflict = folders.some((f) => f.id !== folderId && f.name === name);
		if (conflict) return false;
		folders = folders.map((f) => (f.id === folderId ? { ...f, name } : f));
		return true;
	}

	async function downloadFolder(folderId: string) {
		const folder = folders.find((f) => f.id === folderId);
		if (!folder || !folder.files?.length) {
			toast.error('Folder is empty');
			return;
		}
		const zip = new JSZip();
		for (const file of folder.files) {
			zip.file(file.name, file.content);
		}
		const blob = await zip.generateAsync({ type: 'blob' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${folder.name}.zip`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		setTimeout(() => URL.revokeObjectURL(url), 100);
	}

	function uploadDocToFolder(folderId: string) {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.md';
		input.onchange = () => {
			const file = input.files?.[0];
			if (!file) return;
			const reader = new FileReader();
			reader.onload = () => {
				if (typeof reader.result === 'string') {
					const folder = folders.find((f) => f.id === folderId);
					const existingNames = new Set((folder?.files ?? []).map((f) => f.name));
					let name = file.name;
					if (existingNames.has(name)) {
						const ext = name.lastIndexOf('.') !== -1 ? name.slice(name.lastIndexOf('.')) : '';
						const base = ext ? name.slice(0, name.lastIndexOf('.')) : name;
						let i = 1;
						while (existingNames.has(`${base} (${i})${ext}`)) i++;
						name = `${base} (${i})${ext}`;
					}
					const docFile: DocFile = {
						id: crypto.randomUUID(),
						name,
						content: reader.result as string
					};
					folders = folders.map((f) =>
						f.id === folderId ? { ...f, files: [...(f.files ?? []), docFile] } : f
					);
					toast.success(`Uploaded ${file.name}`);
				}
			};
			reader.readAsText(file);
		};
		input.click();
	}

	function uploadFolder() {
		const input = document.createElement('input');
		input.type = 'file';
		input.webkitdirectory = true;
		input.onchange = () => {
			const files = input.files;
			if (!files || files.length === 0) return;

			const mdFiles = Array.from(files).filter((f) => f.name.endsWith('.md'));
			if (mdFiles.length === 0) {
				toast.error('No .md files found in the selected folder');
				return;
			}

			// Derive folder name from the directory path
			const dirName = mdFiles[0].webkitRelativePath?.split('/')[0] ?? 'Uploaded Folder';
			const existingFolderNames = new Set(folders.map((f) => f.name));
			let folderName = dirName;
			let n = 2;
			while (existingFolderNames.has(folderName)) {
				folderName = `${dirName} (${n})`;
				n++;
			}

			const folderId = crypto.randomUUID();
			const newFolder: ChatFolder = { id: folderId, name: folderName, files: [] };
			folders = [...folders, newFolder];

			uploadDocsIntoFolder(folderId, mdFiles);
		};
		input.click();
	}

	function uploadDocsIntoFolder(folderId: string, mdFiles: File[]) {
		let imported = 0;
		const folder = folders.find((f) => f.id === folderId);
		const existingNames = new Set((folder?.files ?? []).map((f) => f.name));

		for (const file of mdFiles) {
			const reader = new FileReader();
			reader.onload = () => {
				if (typeof reader.result === 'string') {
					let name = file.name;
					if (existingNames.has(name)) {
						const ext = name.lastIndexOf('.') !== -1 ? name.slice(name.lastIndexOf('.')) : '';
						const base = ext ? name.slice(0, name.lastIndexOf('.')) : name;
						let i = 1;
						while (existingNames.has(`${base} (${i})${ext}`)) i++;
						name = `${base} (${i})${ext}`;
					}
					existingNames.add(name);
					const docFile: DocFile = {
						id: crypto.randomUUID(),
						name,
						content: reader.result as string
					};
					folders = folders.map((f) =>
						f.id === folderId ? { ...f, files: [...(f.files ?? []), docFile] } : f
					);
					imported++;
					if (imported === mdFiles.length) {
						toast.success(`Uploaded ${imported} file${imported === 1 ? '' : 's'}`);
					}
				}
			};
			reader.readAsText(file);
		}
	}

	function uploadFolderToFolder(folderId: string) {
		const input = document.createElement('input');
		input.type = 'file';
		input.webkitdirectory = true;
		input.onchange = () => {
			const files = input.files;
			if (!files || files.length === 0) return;

			const mdFiles = Array.from(files).filter((f) => f.name.endsWith('.md'));
			if (mdFiles.length === 0) {
				toast.error('No .md files found in the selected folder');
				return;
			}

			uploadDocsIntoFolder(folderId, mdFiles);
		};
		input.click();
	}

	function selectDoc(folderId: string, fileId: string) {
		const folder = folders.find((f) => f.id === folderId);
		const file = folder?.files?.find((f) => f.id === fileId);
		if (!file) return;
		// If already open, don't duplicate
		const existing = openDocs.find(
			(d) => d.docKey?.folderId === folderId && d.docKey?.fileId === fileId
		);
		if (existing) return;
		openDocs = [
			...openDocs,
			{ id: crypto.randomUUID(), content: file.content, docKey: { folderId, fileId } }
		];
	}

	function renameDocInFolder(folderId: string, fileId: string, name: string): boolean {
		const folder = folders.find((f) => f.id === folderId);
		if (folder?.files?.some((f) => f.id !== fileId && f.name === name)) return false;
		folders = folders.map((f) =>
			f.id === folderId
				? { ...f, files: (f.files ?? []).map((d) => (d.id === fileId ? { ...d, name } : d)) }
				: f
		);
		return true;
	}

	function deleteDocFromFolder(folderId: string, fileId: string) {
		folders = folders.map((f) =>
			f.id === folderId ? { ...f, files: (f.files ?? []).filter((d) => d.id !== fileId) } : f
		);
		openDocs = openDocs.filter(
			(d) => !(d.docKey?.folderId === folderId && d.docKey?.fileId === fileId)
		);
	}

	function moveDocToFolder(fromFolderId: string, fileId: string, toFolderId: string): boolean {
		const fromFolder = folders.find((f) => f.id === fromFolderId);
		const toFolder = folders.find((f) => f.id === toFolderId);
		const file = fromFolder?.files?.find((f) => f.id === fileId);
		if (!file || !toFolder) return false;
		if (toFolder.files?.some((f) => f.name === file.name)) return false;
		folders = folders.map((f) => {
			if (f.id === fromFolderId)
				return { ...f, files: (f.files ?? []).filter((d) => d.id !== fileId) };
			if (f.id === toFolderId) return { ...f, files: [...(f.files ?? []), file] };
			return f;
		});
		openDocs = openDocs.map((d) =>
			d.docKey?.folderId === fromFolderId && d.docKey?.fileId === fileId
				? { ...d, docKey: { folderId: toFolderId, fileId } }
				: d
		);
		return true;
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
			canvasRef.scrollNodeToTop(node.y, node.x + NODE_WIDTH / 2, {
				zoom: 1,
				duration: 250,
				topOffset: 60
			});
		}
	}

	function saveToDisk() {
		const payload = JSON.stringify({ sessions, activeSessionIndex, folders }, null, 2);
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

	async function handleLoadWebLLMModel(modelId: string) {
		webllmStatus = 'loading';
		webllmProgress = 0;
		webllmProgressText = '';
		webllmError = null;
		try {
			await loadWebLLMModel(modelId, webllmContextSize, (report) => {
				webllmProgress = report.progress;
				webllmProgressText = report.text;
			});
			webllmStatus = 'ready';
			activeModel = { provider: 'webllm', modelId };
			contextLength = webllmContextSize;
		} catch (error) {
			webllmStatus = 'error';
			webllmError = error instanceof Error ? error.message : 'Failed to load model.';
		}
	}

	async function handleDeleteWebLLMCache(modelId: string) {
		await deleteModelCache(modelId);
		if (activeModel?.provider === 'webllm' && activeModel.modelId === modelId) {
			activeModel = null;
			webllmStatus = 'idle';
		}
	}

	async function handleDeleteAllWebLLMCaches() {
		await deleteAllModelCaches();
		if (activeModel?.provider === 'webllm') {
			activeModel = null;
		}
		webllmStatus = 'idle';
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
		void _;
		apiKeys = rest;
		vaultProviders = getStoredProviders();
		if (activeModel?.provider === provider) {
			activeModel = null;
		}
	}

	function handleSelectModel(model: ActiveModel) {
		activeModel = model;
	}

	function getProviderStream(
		model: ActiveModel,
		history: import('@/lib/chat/tree').Message[],
		signal: AbortSignal
	) {
		const key = apiKeys[model.provider] ?? '';
		if (model.provider === 'webllm') {
			return streamWebLLMChat(history, signal);
		}
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
		const config = PROVIDER_CONFIG[model.provider as Exclude<Provider, 'ollama' | 'webllm'>];
		return streamOpenAICompatChat(config.baseUrl, model.modelId, history, key, signal);
	}

	async function submitPrompt() {
		const prompt = composerValue.trim();
		if (!prompt || !activeExchanges || submitDisabledReason || !activeModel) return;

		operationError = null;

		const parentId = activeExchangeId ?? getMainChatTail(activeExchanges) ?? ROOT_ANCHOR_ID;
		if (
			activeExchangeId &&
			getChildExchanges(activeExchanges, activeExchangeId, exchangesByParentId).length > 0
		) {
			expandedSideChatParent = activeExchangeId;
		}

		let created: { id: string; exchanges: import('@/lib/chat/tree').ExchangeMap };
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

		// CLEANUP: Store the AbortController in component state and expose a "Stop" button in the
		// composer while streaming. Also abort on session/root switch.
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
		updateActiveSession({ activeRootIndex: result.rootIndex });
		activeExchangeId = result.exchangeId;
		expandedSideChatParent = targetRoot ? findSideChatParent(targetRoot, result.exchangeId) : null;
		scrollToNode(result.exchangeId);
	}

	function toggleSideChildren(exchangeId: string) {
		expandedSideChatParent = expandedSideChatParent === exchangeId ? null : exchangeId;
	}

	function getExchangeNodeData(exchangeId: string) {
		try {
			const exchange = activeExchanges?.[exchangeId];
			if (!exchange) return null;
			const children = activeExchanges
				? getChildExchanges(activeExchanges, exchangeId, exchangesByParentId)
				: [];
			const hasSideChildren =
				canCreateSideChats(activeExchanges, exchangeId, exchangesByParentId) && children.length > 1;
			const isSideRoot = exchange.parentId
				? (getChildExchanges(activeExchanges, exchange.parentId, exchangesByParentId)[0]?.id ??
						null) !== exchangeId
				: false;

			return {
				prompt: exchange.prompt,
				response: exchange.response,
				model: exchange.model,
				provider: exchange.model ? getProviderForModelId(exchange.model) : null,
				isActive: activeExchangeId === exchangeId,
				isStreaming: streamingExchangeIds.includes(exchangeId),
				canFork: true,
				hasSideChildren,
				isSideRoot,
				canPromote:
					!!activeExchanges &&
					canPromoteSideChatToMainChat(activeExchanges, exchangeId, exchangesByParentId),
				onMeasure: (height: number) => setMeasuredNodeHeight(exchangeId, height),
				onSelect: () => {
					activeExchangeId = exchangeId;
				},
				onFork: () => forkChat(exchangeId),
				onToggleSideChildren: () => toggleSideChildren(exchangeId),
				onPromote: () => {
					activeExchangeId = exchangeId;
					promoteActiveExchange();
				},
				onDelete: () => openDeleteDialog(exchangeId)
			};
		} catch (error) {
			console.error(`Failed to render exchange "${exchangeId}":`, error);
			return null;
		}
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
		onRenameSession={renameSession}
		onDownloadSession={downloadSession}
		onUploadChat={uploadChat}
		{folders}
		onNewFolder={newFolder}
		onDeleteFolder={deleteFolder}
		onDownloadFolder={downloadFolder}
		onRenameFolder={renameFolder}
		onUploadDoc={uploadDocToFolder}
		onUploadFolder={uploadFolderToFolder}
		onUploadNewFolder={uploadFolder}
		onSelectDoc={selectDoc}
		onDeleteDoc={deleteDocFromFolder}
		onRenameDoc={renameDocInFolder}
		onMoveDoc={moveDocToFolder}
	/>
	<SidebarPrimitive.Inset>
		<div class="page-shell" onwheel={handleCanvasWheel}>
			<ChatHeader
				visible={headerVisible}
				rootCount={roots.length}
				{activeRootIndex}
				onSelectRoot={selectRoot}
			/>

			{#if operationError}
				<div class="error-banner">{operationError}</div>
			{/if}

			<FloatingActions
				onSearch={() => (searchOpen = true)}
				onFitView={() => canvasRef?.fitView({ duration: 250, maxZoom: 1 })}
				onGoToTop={() => {
					const first = canvas.nodes[0];
					if (first && canvasRef)
						canvasRef.scrollNodeToTop(first.y, first.x + NODE_WIDTH / 2, {
							zoom: 1,
							duration: 250,
							topOffset: 60
						});
				}}
				onGoToActive={() => scrollToNode(activeExchangeId)}
				onDownload={saveToDisk}
			/>

			<div class="flow-shell">
				<Canvas
					nodes={canvas.nodes}
					edges={canvas.edges}
					canvasWidth={canvas.width}
					canvasHeight={canvas.height}
					nodeWidth={NODE_WIDTH}
					codeEditor={canvas.codeEditor}
					pythonEditor={canvas.pythonEditor}
					drawingBoard={canvas.drawingBoard}
					docsPanels={canvas.docsPanels}
					bind:this={canvasRef}
				>
					{#snippet renderNode(n: CanvasNode)}
						{@const nodeData = getExchangeNodeData(n.id)}
						{#if nodeData}
							<ExchangeNode data={nodeData} />
						{/if}
					{/snippet}
					{#snippet renderCodeEditor()}
						<CodeEditor />
					{/snippet}
					{#snippet renderPythonEditor()}
						<PythonEditor />
					{/snippet}
					{#snippet renderDrawingBoard()}
						<DrawingBoard shapes={drawingShapes} onShapesChange={(s) => (drawingShapes = s)} />
					{/snippet}
					{#snippet renderDocsPanel(index: number)}
						{@const doc = openDocs[index]}
						{#if doc}
							{@const docFile = doc.docKey
								? folders
										.find((f) => f.id === doc.docKey!.folderId)
										?.files?.find((f) => f.id === doc.docKey!.fileId)
								: null}
							<DocsPanel
								title={docFile?.name}
								content={doc.content}
								onContentChange={(c) => {
									openDocs = openDocs.map((d, i) => (i === index ? { ...d, content: c } : d));
									if (doc.docKey) {
										const { folderId, fileId } = doc.docKey;
										folders = folders.map((f) =>
											f.id === folderId
												? {
														...f,
														files: (f.files ?? []).map((d) =>
															d.id === fileId ? { ...d, content: c } : d
														)
													}
												: f
										);
									}
								}}
								onClose={() => {
									openDocs = openDocs.filter((_, i) => i !== index);
								}}
							/>
						{/if}
					{/snippet}
				</Canvas>
			</div>

			<Composer
				bind:composerValue
				bind:canvasMode
				{submitDisabledReason}
				activeModelId={activeModel?.modelId ?? null}
				{usedTokens}
				{contextLength}
				onSubmit={submitPrompt}
				onToggleCanvasMode={() => (canvasMode = !canvasMode)}
				onOpenPalette={() => (paletteOpen = true)}
			/>

			<ModelPalette
				open={paletteOpen}
				onClose={() => {
					paletteOpen = false;
				}}
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
				{webllmStatus}
				{webllmProgress}
				{webllmProgressText}
				{webllmModels}
				{webllmError}
				{webllmContextSize}
				webllmContextOptions={WEBLLM_CONTEXT_OPTIONS}
				onWebLLMContextSizeChange={(size) => {
					webllmContextSize = size;
				}}
				onLoadWebLLMModel={handleLoadWebLLMModel}
				onDeleteWebLLMCache={handleDeleteWebLLMCache}
				onDeleteAllWebLLMCaches={handleDeleteAllWebLLMCaches}
			/>

			{#if searchOpen}
				<SearchDialog
					bind:searchQuery
					bind:searchAllChats
					{searchItems}
					onClose={() => (searchOpen = false)}
					onSelect={handleSearchSelect}
				/>
			{/if}

			{#if deleteTargetId}
				{@const children = activeExchanges
					? getChildExchanges(activeExchanges, deleteTargetId, exchangesByParentId)
					: []}
				<button
					class="modal-scrim"
					type="button"
					aria-label="Close delete dialog"
					onclick={() => (deleteTargetId = null)}
				></button>
				<div class="modal-panel delete-panel">
					<div class="modal-header">
						<h2>Delete exchange</h2>
						<Button
							class="ghost-button"
							variant="ghost"
							size="sm"
							onclick={() => (deleteTargetId = null)}>Close</Button
						>
					</div>
					<div class="modal-section">
						<p class="field-label">Choose what should be removed with this exchange.</p>
						<label class="delete-option">
							<input
								type="radio"
								bind:group={deleteMode}
								value="exchange"
								disabled={children.length > 1}
							/>
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
							<Button
								class="ghost-button"
								variant="ghost"
								size="sm"
								onclick={() => (deleteTargetId = null)}>Cancel</Button
							>
							<Button class="primary-button" variant="destructive" onclick={confirmDelete}
								>Confirm delete</Button
							>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</SidebarPrimitive.Inset>
</SidebarPrimitive.Provider>
<Toaster position="top-center" />
