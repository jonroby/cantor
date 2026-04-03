import * as domain from '@/domain';
import * as state from '@/state';
import * as external from '@/external';
import * as lib from '@/lib';
import * as agent from '@/app/agent';
import { selectExchanges, type ContextBudget } from './context';

export type ContextStrategy = state.chats.ContextStrategy;
export type ChatMode = state.chats.ChatMode;
export type ImageAttachment = domain.tree.ImageAttachment;

export interface ChatTransferFeedback {
	success?: (message: string) => void;
	error?: (message: string) => void;
}

const NOOP_FEEDBACK: ChatTransferFeedback = {};

export interface ChatActionDeps {
	replaceActiveTree: (tree: domain.tree.ChatTree) => void;
	setActiveExchangeId: (id: string | null) => void;
	getActiveChat: () => state.chats.ChatRecord;
	addChat: (chat: state.chats.ChatRecord) => number;
	cancelStreamsForExchanges: (ids: string[]) => void;
	isStreaming: (exchangeId: string) => boolean;
}

export type DeleteMode = 'exchange' | 'exchangeAndMainChat' | 'exchangeAndSideChats';

const defaultDeps: ChatActionDeps = {
	replaceActiveTree: state.chats.replaceActiveTree,
	setActiveExchangeId: state.chats.setActiveExchangeId,
	getActiveChat: state.chats.getActiveChat,
	addChat: state.chats.addChat,
	cancelStreamsForExchanges: (ids) => {
		for (const id of ids) stopStream(id);
	},
	isStreaming
};

export const getChats = () => state.chats.chatState.chats;
export const getActiveChatIndex = () => state.chats.chatState.activeChatIndex;
export const getChat = () => state.chats.getActiveChat();
export const getActiveExchangeId = () => state.chats.getActiveExchangeId();

export const getContextStrategy = (): state.chats.ContextStrategy =>
	state.chats.getActiveChat().contextStrategy;
export const setContextStrategy = state.chats.setContextStrategy;
export const getMode = (): state.chats.ChatMode => state.chats.getMode();
export const setMode = state.chats.setMode;

export const createChat = state.chats.newChat;
export const selectChat = state.chats.selectChat;

export function removeChat(index: number) {
	const chat = state.chats.chatState.chats[index];
	if (!chat) return;
	void external.persistence.trashItem({
		id: crypto.randomUUID(),
		type: 'chat',
		name: chat.name,
		deletedAt: Date.now(),
		data: {
			id: chat.id,
			name: chat.name,
			rootId: chat.rootId,
			exchanges: chat.exchanges,
			activeExchangeId: chat.activeExchangeId,
			contextStrategy: chat.contextStrategy,
			mode: chat.mode
		}
	});
	state.chats.deleteChat(index);
}

export function renameChat(index: number, name: string): string | null {
	return lib.rename.renameWithDedup(name, (candidate) => state.chats.renameChat(index, candidate));
}

export const selectExchange = state.chats.setActiveExchangeId;

const agentAbortControllers = new Map<string, AbortController>();
const agentRunChatIds = new Map<string, string>();

export function isStreaming(exchangeId: string): boolean {
	return external.streams.isStreaming(exchangeId) || state.agent.isStreaming(exchangeId);
}

export function stopStream(exchangeId: string): void {
	const agentAbort = agentAbortControllers.get(exchangeId);
	if (agentAbort) {
		agentAbort.abort();
		agentAbortControllers.delete(exchangeId);
		agentRunChatIds.delete(exchangeId);
		state.agent.stopStreaming(exchangeId);
		return;
	}
	external.streams.cancelStream(exchangeId);
}

export function stopChatStreams(chatId: string): void {
	for (const [exchangeId, runningChatId] of agentRunChatIds) {
		if (runningChatId === chatId) {
			stopStream(exchangeId);
		}
	}
	external.streams.cancelStreamsForChat(chatId);
}

export function getMainChat(tree: domain.tree.ChatTree): domain.tree.Exchange[] {
	return domain.tree.getMainChat(tree);
}

export function getSideChats(
	tree: domain.tree.ChatTree,
	parentExchangeId: string
): domain.tree.Exchange[][] {
	const children = domain.tree.getChildren(tree, parentExchangeId);
	if (children.length <= 1) return [];

	const sideChats: domain.tree.Exchange[][] = [];
	for (let i = 1; i < children.length; i++) {
		const sideChat: domain.tree.Exchange[] = [];
		let current: domain.tree.Exchange | undefined = children[i];
		while (current) {
			sideChat.push(current);
			current = domain.tree.getChildren(tree, current.id)[0];
		}
		sideChats.push(sideChat);
	}
	return sideChats;
}

export function canSubmitPrompt(tree: domain.tree.ChatTree, activeExchangeId: string): boolean {
	return domain.tree.constraints.canAcceptNewChat(tree, activeExchangeId);
}

export function getUsedTokens(tree: domain.tree.ChatTree, activeExchangeId: string): number {
	return domain.tree
		.getPath(tree, activeExchangeId)
		.reduce(
			(total, exchange) =>
				total + exchange.prompt.tokenCount + (exchange.response?.tokenCount ?? 0),
			0
		);
}

export function deleteExchange(
	tree: domain.tree.ChatTree,
	deleteTargetId: string,
	deleteMode: DeleteMode,
	activeExchangeId: string | null,
	onResetMeasuredHeights?: () => void,
	deps: Omit<ChatActionDeps, 'isStreaming'> = defaultDeps
): { error: string | null } {
	try {
		const removedExchangeIds = getRemovedExchangeIds(tree, deleteTargetId, deleteMode);
		const result = deleteTree(tree, deleteTargetId, deleteMode);
		deps.cancelStreamsForExchanges(removedExchangeIds);
		onResetMeasuredHeights?.();
		deps.replaceActiveTree(result.tree);
		if (deleteTargetId === activeExchangeId || !result.tree.exchanges[activeExchangeId ?? '']) {
			deps.setActiveExchangeId(domain.tree.getMainChatTail(result.tree));
		}
		return { error: null };
	} catch (error) {
		return { error: error instanceof Error ? error.message : 'Unable to delete exchange.' };
	}
}

function getDescendantIds(tree: domain.tree.ChatTree, exchangeId: string): string[] {
	const children = domain.tree.getChildren(tree, exchangeId);
	const ids: string[] = [];
	for (const child of children) {
		ids.push(child.id, ...getDescendantIds(tree, child.id));
	}
	return ids;
}

function getRemovedExchangeIds(
	tree: domain.tree.ChatTree,
	deleteTargetId: string,
	deleteMode: DeleteMode
): string[] {
	const children = domain.tree.getChildren(tree, deleteTargetId);
	switch (deleteMode) {
		case 'exchange':
			return [deleteTargetId];
		case 'exchangeAndMainChat': {
			const mainChild = children[0];
			return mainChild
				? [deleteTargetId, mainChild.id, ...getDescendantIds(tree, mainChild.id)]
				: [deleteTargetId];
		}
		case 'exchangeAndSideChats': {
			const sideChildren = children.slice(1);
			return [
				deleteTargetId,
				...sideChildren.flatMap((child) => [child.id, ...getDescendantIds(tree, child.id)])
			];
		}
	}
}

function deleteTree(
	tree: domain.tree.ChatTree,
	deleteTargetId: string,
	deleteMode: DeleteMode
): domain.tree.DeleteResult {
	switch (deleteMode) {
		case 'exchange':
			return domain.tree.removeExchange(tree, deleteTargetId);
		case 'exchangeAndMainChat': {
			const mainChild = domain.tree.getChildren(tree, deleteTargetId)[0];
			const withoutMain = mainChild
				? domain.tree.removeExchangeSubtree(tree, mainChild.id).tree
				: tree;
			return domain.tree.removeExchange(withoutMain, deleteTargetId);
		}
		case 'exchangeAndSideChats': {
			const sideChildren = domain.tree.getChildren(tree, deleteTargetId).slice(1);
			const withoutSideChats = sideChildren.reduce(
				(currentTree, child) => domain.tree.removeExchangeSubtree(currentTree, child.id).tree,
				tree
			);
			return domain.tree.removeExchange(withoutSideChats, deleteTargetId);
		}
	}
}

export function promoteExchange(
	tree: domain.tree.ChatTree,
	exchangeId: string,
	onResetMeasuredHeights?: () => void,
	deps: Omit<ChatActionDeps, 'isStreaming'> = defaultDeps
): { error: string | null } {
	try {
		const result = domain.tree.promoteSideChatToMainChat(tree, exchangeId);
		deps.setActiveExchangeId(exchangeId);
		onResetMeasuredHeights?.();
		deps.replaceActiveTree(result.tree);
		return { error: null };
	} catch (error) {
		return { error: error instanceof Error ? error.message : 'Unable to promote exchange.' };
	}
}

export function copyChat(
	exchangeId: string,
	deps: Pick<ChatActionDeps, 'getActiveChat' | 'addChat'> = defaultDeps
) {
	const activeChat = deps.getActiveChat();
	if (!activeChat) return;

	const path = domain.tree.getPath(
		{ rootId: activeChat.rootId, exchanges: activeChat.exchanges },
		exchangeId
	);

	const idMap = new Map<string, string>();
	for (const exchange of path) {
		idMap.set(exchange.id, crypto.randomUUID());
	}

	const copiedExchanges: domain.tree.ExchangeMap = {};
	let copiedRootId: string | null = null;
	for (const exchange of path) {
		const copiedId = idMap.get(exchange.id)!;
		const copiedParentId =
			exchange.parentId === null ? null : (idMap.get(exchange.parentId) ?? null);

		copiedExchanges[copiedId] = {
			id: copiedId,
			parentId: copiedParentId,
			childIds: [],
			prompt: { ...exchange.prompt },
			response: exchange.response ? { ...exchange.response } : null,
			model: exchange.model,
			provider: exchange.provider,
			createdAt: Date.now(),
			label: exchange.label
		};

		if (copiedParentId === null) {
			copiedRootId = copiedId;
		} else {
			copiedExchanges[copiedParentId] = {
				...copiedExchanges[copiedParentId]!,
				childIds: [...copiedExchanges[copiedParentId]!.childIds, copiedId]
			};
		}
	}

	const existingNames = getChats().map((chat) => chat.name);
	const name =
		lib.rename.renameWithDedup(
			'Copy Path (1)',
			(candidate) => !existingNames.includes(candidate)
		) ?? 'Copy Path (1)';

	const copiedTree: domain.tree.ChatTree = { rootId: copiedRootId, exchanges: copiedExchanges };
	deps.addChat({
		id: crypto.randomUUID(),
		name,
		rootId: copiedTree.rootId,
		exchanges: copiedTree.exchanges,
		activeExchangeId: domain.tree.getMainChatTail(copiedTree),
		contextStrategy: 'full',
		mode: 'chat'
	});
}

export interface SubmitOptions {
	liveDocumentContent?: string;
	contextStrategy?: state.chats.ContextStrategy;
	contextLength?: number | null;
	images?: domain.tree.ImageAttachment[];
	agentMode?: boolean;
	activeDocumentKey?: { folderId: string; fileId: string } | null;
	toolCallbacks?: {
		onOpenDocument?: (folderId: string, fileId: string) => void;
		onOpenFolder?: (folderId: string) => void;
		onClosePanel?: (index: number) => void;
		onToggleSidebar?: () => void;
	};
}

export function submitPrompt(
	chatId: string,
	tree: domain.tree.ChatTree,
	activeExchangeId: string | null,
	prompt: string,
	model: domain.models.ActiveModel,
	options?: SubmitOptions,
	deps: Omit<ChatActionDeps, 'isStreaming'> = defaultDeps
): { id: string; parentId: string; hasSideChildren: boolean } {
	const parentId = activeExchangeId ?? domain.tree.getMainChatTail(tree) ?? '';
	const hasSideChildren =
		activeExchangeId !== null && domain.tree.getChildren(tree, activeExchangeId).length > 0;

	const created = domain.tree.addExchange(
		tree,
		parentId,
		prompt,
		model.modelId,
		model.provider,
		options?.images
	);

	const fullPath = domain.tree.getPath(created.tree, created.id);
	const budget: ContextBudget = {
		contextLength: options?.contextLength ?? null,
		strategy: options?.contextStrategy ?? 'full',
		currentPrompt: prompt
	};
	const selectedPath = selectExchanges(fullPath, budget);

	const history = selectedPath.flatMap((exchange) => {
		const userMsg: domain.tree.Message = { role: 'user', content: exchange.prompt.text };
		if (exchange.prompt.images?.length) userMsg.images = exchange.prompt.images;
		const messages: domain.tree.Message[] = [userMsg];
		if (exchange.response) {
			messages.push({ role: 'assistant', content: exchange.response.text });
		}
		return messages;
	});
	if (options?.liveDocumentContent !== undefined) {
		history.splice(
			history.length - 1,
			0,
			{
				role: 'user',
				content: `The user is working on this document in tandem with this chat. Remember this for context:\n\n${options.liveDocumentContent}`
			},
			{ role: 'assistant', content: 'Understood, I have the document.' }
		);
	}

	deps.replaceActiveTree(created.tree);
	deps.setActiveExchangeId(created.id);

	const toolContext: agent.ToolContext | null = options?.agentMode
		? {
				folderId: options.activeDocumentKey?.folderId ?? null,
				activeDocumentKey: options.activeDocumentKey,
				...options.toolCallbacks
			}
		: null;

	if (toolContext) {
		const systemPrompt = agent.buildSystemPrompt(options!.liveDocumentContent);
		history.splice(
			history.length - 1,
			0,
			{ role: 'user', content: systemPrompt },
			{ role: 'assistant', content: 'Understood.' }
		);
	}

	if (toolContext) {
		startAgentRun(chatId, created.id, model, history, toolContext);
	} else {
		external.streams.startStream(
			{
				exchangeId: created.id,
				chatId,
				model,
				history
			},
			{
				getTreeByChatId: state.chats.getTreeByChatId,
				replaceTreeByChatId: state.chats.replaceTreeByChatId,
				getProviderStream: (activeModel, streamHistory, signal, streamTools) =>
					external.providers.stream.getProviderStream(
						activeModel,
						streamHistory,
						signal,
						{
							apiKey: state.providers.providerState.apiKeys[activeModel.provider] ?? '',
							ollamaUrl: state.providers.providerState.ollamaUrl
						},
						streamTools
					)
			}
		);
	}

	return { id: created.id, parentId, hasSideChildren };
}

function updateExchangeResponse(
	chatId: string,
	exchangeId: string,
	response: string,
	promptTokens = 0,
	responseTokens = 0
) {
	const tree = state.chats.getTreeByChatId(chatId);
	if (!tree) return;
	let exchanges = domain.tree.updateExchangeResponse(tree.exchanges, exchangeId, response);
	if (promptTokens > 0 || responseTokens > 0) {
		exchanges = domain.tree.updateExchangeTokens(exchanges, exchangeId, promptTokens, responseTokens);
	}
	state.chats.replaceTreeByChatId(chatId, { rootId: tree.rootId, exchanges });
}

function summarizeInput(input: Record<string, unknown>): string {
	const entries = Object.entries(input);
	if (entries.length === 0) return '{}';
	return entries
		.slice(0, 4)
		.map(([key, value]) => `${key}: ${typeof value === 'string' ? JSON.stringify(value) : String(value)}`)
		.join(', ');
}

function buildVerificationSummary(reads: agent.VerificationRead[], ctx: agent.ToolContext): string[] {
	return reads.map((read) => {
		const verification = agent.executeTool(read.name, read.input, ctx);
		return `Verification via ${read.name}: ${verification.result}`;
	});
}

function getVerificationLines(
	toolName: string,
	input: Record<string, unknown>,
	executed: agent.ToolExecution,
	ctx: agent.ToolContext
): string[] {
	const definition = agent.getToolDefinition(toolName);
	const reads = definition?.verification?.buildReads?.(input, executed, ctx) ?? [];
	const lines = reads.length > 0 ? buildVerificationSummary(reads, ctx) : [];
	const verificationRequired =
		definition?.verification?.required ??
		(definition !== undefined && (definition.kind === 'write' || definition.kind === 'workspace'));
	if (verificationRequired && lines.length === 0) {
		lines.push(`Verification missing for action ${toolName}.`);
	}
	return lines;
}

function startAgentRun(
	chatId: string,
	exchangeId: string,
	model: domain.models.ActiveModel,
	history: domain.tree.Message[],
	toolContext: agent.ToolContext
) {
	const abort = new AbortController();
	agentAbortControllers.set(exchangeId, abort);
	agentRunChatIds.set(exchangeId, chatId);
	state.agent.clearThinking(exchangeId);
	state.agent.startStreaming(exchangeId);
	state.agent.setExpanded(exchangeId, true);

	void runAgentLoop(chatId, exchangeId, model, history, toolContext, abort).finally(() => {
		agentAbortControllers.delete(exchangeId);
		agentRunChatIds.delete(exchangeId);
		state.agent.stopStreaming(exchangeId);
	});
}

async function runAgentLoop(
	chatId: string,
	exchangeId: string,
	model: domain.models.ActiveModel,
	history: domain.tree.Message[],
	toolContext: agent.ToolContext,
	abort: AbortController
) {
	try {
		const rawMessages: unknown[] = history.map((message) => ({ ...message }));
		const maxToolTurns = 10;

		for (let turn = 0; turn < maxToolTurns; turn++) {
			let responseText = '';
			let promptTokens = 0;
			let responseTokens = 0;
			let stopReason: string | undefined;
			const toolCalls: external.providers.stream.ToolUseBlock[] = [];

			const stream = external.providers.stream.getProviderStream(
				model,
				rawMessages as domain.tree.Message[],
				abort.signal,
				{
					apiKey: state.providers.providerState.apiKeys[model.provider] ?? '',
					ollamaUrl: state.providers.providerState.ollamaUrl
				},
				agent.TOOLS
			);

			for await (const chunk of stream) {
				if (chunk.type === 'delta') {
					responseText += chunk.delta;
					state.agent.setLiveStatus(exchangeId, responseText);
				} else if (chunk.type === 'tool_use') {
					toolCalls.push(chunk.toolUse);
				} else if (chunk.type === 'done') {
					promptTokens = chunk.promptTokens;
					responseTokens = chunk.responseTokens;
					stopReason = chunk.stopReason;
				}
			}

			if (toolCalls.length === 0) {
				if (responseText) {
					updateExchangeResponse(chatId, exchangeId, responseText, promptTokens, responseTokens);
					state.agent.setLastResponse(responseText);
				}
				state.agent.clearLiveStatus(exchangeId);
				return;
			}

			if (responseText.trim()) {
				state.agent.appendThinkingEvent(exchangeId, 'note', responseText.trim());
			}
			state.agent.clearLiveStatus(exchangeId);

			const assistantContent: unknown[] = [];
			if (responseText) assistantContent.push({ type: 'text', text: responseText });
			const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = [];

			for (const toolCall of toolCalls) {
				assistantContent.push({
					type: 'tool_use',
					id: toolCall.id,
					name: toolCall.name,
					input: toolCall.input
				});
				state.agent.appendThinkingEvent(
					exchangeId,
					'tool_call',
					`${toolCall.name}(${summarizeInput(toolCall.input)})`
				);
				const executed = agent.executeTool(toolCall.name, toolCall.input, toolContext);
				const verificationLines = getVerificationLines(
					toolCall.name,
					toolCall.input,
					executed,
					toolContext
				);
				for (const verificationLine of verificationLines) {
					state.agent.appendThinkingEvent(exchangeId, 'verification', verificationLine);
				}
				const content = [executed.result, ...verificationLines].join('\n');
				state.agent.appendThinkingEvent(exchangeId, 'tool_result', content);
				toolResults.push({ type: 'tool_result', tool_use_id: toolCall.id, content });
			}

			rawMessages.push({ role: 'assistant', content: assistantContent });
			rawMessages.push({ role: 'user', content: toolResults });

			if (stopReason !== 'tool_use') {
				return;
			}
		}

		state.agent.appendThinkingEvent(
			exchangeId,
			'status',
			'Stopped after reaching the maximum tool turns for this run.'
		);
	} catch (error) {
		if (abort.signal.aborted) return;
		const message = error instanceof Error ? error.message : 'Agent run failed.';
		updateExchangeResponse(chatId, exchangeId, `Request failed.\n\n${message}`);
		state.agent.appendThinkingEvent(exchangeId, 'status', `Run failed: ${message}`);
		state.agent.clearLiveStatus(exchangeId);
	}
}

export function quickAsk(
	chatId: string,
	tree: domain.tree.ChatTree,
	exchangeId: string,
	sourceText: string,
	model: domain.models.ActiveModel,
	deps: Omit<ChatActionDeps, 'isStreaming'> = defaultDeps
): { id: string; parentId: string; hasSideChildren: boolean } {
	return submitPrompt(
		chatId,
		tree,
		exchangeId,
		`Can you explain more:\n\n${sourceText}`,
		model,
		{},
		deps
	);
}

export function addDocumentToChat(
	tree: domain.tree.ChatTree,
	activeExchangeId: string | null,
	content: string,
	fileName: string,
	deps: Omit<ChatActionDeps, 'isStreaming'> = defaultDeps
): string {
	const parentId = activeExchangeId ?? domain.tree.getMainChatTail(tree) ?? '';
	const created = domain.tree.addExchange(tree, parentId, content, '', 'ollama');
	const nextTree = {
		rootId: created.tree.rootId,
		exchanges: {
			...created.tree.exchanges,
			[created.id]: {
				...created.tree.exchanges[created.id]!,
				response: { text: '', tokenCount: 0 },
				label: `${fileName} was added to chat`
			}
		}
	};
	deps.replaceActiveTree(nextTree);
	deps.setActiveExchangeId(created.id);
	return created.id;
}

export function exportState() {
	const payload = JSON.stringify(
		{
			chats: state.chats.chatState.chats,
			activeChatIndex: state.chats.chatState.activeChatIndex,
			folders: state.documents.documentState.folders
		},
		null,
		2
	);
	const blob = new Blob([payload], { type: 'application/json' });
	external.io.downloadBlob(blob, `chat-tree-${Date.now()}.json`);
}

export function exportChat(index: number) {
	const chat = state.chats.chatState.chats[index];
	const payload = JSON.stringify(chat, null, 2);
	const blob = new Blob([payload], { type: 'application/json' });
	external.io.downloadBlob(blob, `${chat.name.replace(/[^a-zA-Z0-9-_ ]/g, '')}.json`);
}

export function importChat(feedback: ChatTransferFeedback = NOOP_FEEDBACK): void {
	void external.io.pickFile('.json').then(async (file) => {
		if (!file) return;
		try {
			const text = await file.text();
			const data = JSON.parse(text);
			const upload = external.io.validateChatUpload(data);
			const baseName = file.name.replace(/\.json$/i, '');
			const existingNames = state.chats.chatState.chats.map((chat) => chat.name);
			const chat: state.chats.ChatRecord = {
				id: crypto.randomUUID(),
				name:
					lib.rename.renameWithDedup(baseName, (candidate) => !existingNames.includes(candidate)) ??
					baseName,
				rootId: upload.tree.rootId,
				exchanges: upload.tree.exchanges,
				activeExchangeId: upload.activeExchangeId,
				contextStrategy: 'full',
				mode: 'chat'
			};
			state.chats.chatState.chats = [...state.chats.chatState.chats, chat];
			state.chats.chatState.activeChatIndex = state.chats.chatState.chats.length - 1;
			feedback.success?.(`Imported "${chat.name}"`);
		} catch (e) {
			feedback.error?.(e instanceof Error ? e.message : 'Invalid chat file');
		}
	});
}

export type Chat = state.chats.ChatRecord;
export type Exchange = domain.tree.Exchange;
export type Message = domain.tree.Message;
