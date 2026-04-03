import * as domain from '@/domain';
import * as state from '@/state';
import * as external from '@/external';
import * as documents from '@/app/documents';
import * as chat from '@/app/chat';
import * as providers from '@/app/providers';
import * as workspace from '@/app/workspace';

export type Message = domain.tree.Message;

export interface ToolContext {
	folderId: string | null;
	activeDocumentKey?: { folderId: string; fileId: string } | null;
	onOpenDocument?: (folderId: string, fileId: string) => void;
	onOpenFolder?: (folderId: string) => void;
	onClosePanel?: (index: number) => void;
	onToggleSidebar?: () => void;
}

export interface VerificationRead {
	name: string;
	input: Record<string, unknown>;
}

export interface ToolVerificationPolicy {
	required?: boolean;
	buildReads?: (
		input: Record<string, unknown>,
		execution: ToolExecution,
		ctx: ToolContext
	) => VerificationRead[];
}

export interface ToolExecution {
	result: string;
	pendingContent?: string;
}

export interface CapabilityTool {
	name: string;
	description: string;
	kind: 'read' | 'write' | 'workspace';
	input_schema: Record<string, unknown>;
	execute: (input: Record<string, unknown>, ctx: ToolContext) => ToolExecution;
	verification?: ToolVerificationPolicy;
}

export interface CapabilityModule {
	id: string;
	label: string;
	description: string;
	tools: CapabilityTool[];
}

export function getState() {
	return state.agent.agentState;
}

const DOCUMENT_TOOLS: CapabilityTool[] = [
	{
		name: 'edit_document',
		description:
			'Propose a replacement for the currently active document. The user must accept or reject it.',
		kind: 'write',
		input_schema: {
			type: 'object',
			properties: {
				content: { type: 'string', description: 'The full replacement document content.' }
			},
			required: ['content']
		},
		execute(input) {
			const content = input.content as string;
			if (!content) return { result: 'Error: content is required' };
			state.agent.setPendingContent(content);
			return {
				result: 'Document edit is now pending user approval.',
				pendingContent: content
			};
		},
		verification: { required: false }
	},
	{
		name: 'create_file',
		description:
			'Create a file inside a folder. If subfolder is set, create or reuse that subfolder first.',
		kind: 'write',
		input_schema: {
			type: 'object',
			properties: {
				filename: { type: 'string', description: 'File name such as "notes.md" or "diagram.svg".' },
				content: { type: 'string', description: 'Full file content.' },
				folder_id: {
					type: 'string',
					description: 'Target folder id. Defaults to current folder context.'
				},
				subfolder: { type: 'string', description: 'Optional subfolder name.' }
			},
			required: ['filename', 'content']
		},
		execute(input, ctx) {
			const filename = input.filename as string;
			const content = input.content as string;
			const folderId = (input.folder_id as string | undefined) ?? ctx.folderId;
			const subfolder = input.subfolder as string | undefined;
			if (!filename || content === undefined) {
				return { result: 'Error: filename and content are required' };
			}
			if (!folderId) {
				return { result: 'Error: no folder context is available. Provide folder_id first.' };
			}
			const { result: created, error } = documents.createFileWithContent(
				folderId,
				filename,
				content,
				{ subfolder }
			);
			if (error) return { result: `Error: ${error}` };
			if (!created) return { result: `Error: could not create file "${filename}"` };
			return {
				result:
					created.name === filename
						? `Created "${created.path}" in folder ${created.folderId}.`
						: `Created "${created.path}" in folder ${created.folderId}. The original name "${filename}" was already taken.`
			};
		},
		verification: {
			required: true,
			buildReads(input, _execution, ctx) {
				const folderId = (input.folder_id as string | undefined) ?? ctx.folderId;
				const subfolder = input.subfolder as string | undefined;
				if (!folderId) return [];
				if (!subfolder) return [{ name: 'inspect_folder', input: { folder_id: folderId } }];
				const folder = documents.getFolder(folderId);
				const nested = folder?.folders?.find((candidate) => candidate.name === subfolder);
				return [
					{
						name: 'inspect_folder',
						input: { folder_id: nested?.id ?? folderId }
					}
				];
			}
		}
	},
	{
		name: 'create_folder',
		description: 'Create a folder. Optionally nest it under parent_folder_id.',
		kind: 'write',
		input_schema: {
			type: 'object',
			properties: {
				name: { type: 'string', description: 'Folder name.' },
				parent_folder_id: { type: 'string', description: 'Optional parent folder id.' }
			},
			required: ['name']
		},
		execute(input) {
			const name = input.name as string;
			const parentFolderId = input.parent_folder_id as string | undefined;
			if (!name) return { result: 'Error: name is required' };
			const created = documents.createNamedFolder(name, parentFolderId);
			if (!created) return { result: `Error: could not create folder "${name}"` };
			return { result: `Created folder "${created.name}" (id: ${created.folderId}).` };
		},
		verification: {
			required: true,
			buildReads(_input, execution) {
				const match = execution.result.match(/\(id: ([^)]+)\)/);
				return match ? [{ name: 'inspect_folder', input: { folder_id: match[1] } }] : [];
			}
		}
	},
	{
		name: 'rename_folder',
		description: 'Rename a folder.',
		kind: 'write',
		input_schema: {
			type: 'object',
			properties: {
				folder_id: { type: 'string' },
				name: { type: 'string' }
			},
			required: ['folder_id', 'name']
		},
		execute(input) {
			const folderId = input.folder_id as string;
			const name = input.name as string;
			if (!folderId || !name) return { result: 'Error: folder_id and name are required' };
			const result = documents.renameFolder(folderId, name);
			if (result === null) return { result: `Error: could not rename folder to "${name}"` };
			return { result: `Renamed folder to "${result}".` };
		},
		verification: {
			required: true,
			buildReads(input) {
				return [{ name: 'inspect_folder', input: { folder_id: input.folder_id as string } }];
			}
		}
	},
	{
		name: 'rename_document',
		description: 'Rename a document inside a folder.',
		kind: 'write',
		input_schema: {
			type: 'object',
			properties: {
				folder_id: { type: 'string' },
				file_id: { type: 'string' },
				name: { type: 'string' }
			},
			required: ['folder_id', 'file_id', 'name']
		},
		execute(input) {
			const folderId = input.folder_id as string;
			const fileId = input.file_id as string;
			const name = input.name as string;
			if (!folderId || !fileId || !name) {
				return { result: 'Error: folder_id, file_id, and name are required' };
			}
			const { result, error } = documents.renameDocument(folderId, fileId, name);
			if (error) return { result: `Error: ${error}` };
			if (result === null) return { result: `Error: could not rename document to "${name}"` };
			return { result: `Renamed document to "${result}".` };
		},
		verification: {
			required: true,
			buildReads(input) {
				return [{ name: 'inspect_folder', input: { folder_id: input.folder_id as string } }];
			}
		}
	},
	{
		name: 'delete_folder',
		description: 'Delete a folder and all of its contents.',
		kind: 'write',
		input_schema: {
			type: 'object',
			properties: {
				folder_id: { type: 'string' }
			},
			required: ['folder_id']
		},
		execute(input) {
			const folderId = input.folder_id as string;
			if (!folderId) return { result: 'Error: folder_id is required' };
			documents.deleteFolder(folderId);
			return { result: `Deleted folder ${folderId}.` };
		},
		verification: {
			required: true,
			buildReads() {
				return [{ name: 'list_folders', input: {} }];
			}
		}
	},
	{
		name: 'delete_document',
		description: 'Delete a document from a folder.',
		kind: 'write',
		input_schema: {
			type: 'object',
			properties: {
				folder_id: { type: 'string' },
				file_id: { type: 'string' }
			},
			required: ['folder_id', 'file_id']
		},
		execute(input) {
			const folderId = input.folder_id as string;
			const fileId = input.file_id as string;
			if (!folderId || !fileId) return { result: 'Error: folder_id and file_id are required' };
			documents.deleteDocument(folderId, fileId);
			return { result: `Deleted document ${fileId}.` };
		},
		verification: {
			required: true,
			buildReads(input) {
				return [{ name: 'inspect_folder', input: { folder_id: input.folder_id as string } }];
			}
		}
	},
	{
		name: 'move_document',
		description: 'Move a document from one folder to another.',
		kind: 'write',
		input_schema: {
			type: 'object',
			properties: {
				from_folder_id: { type: 'string' },
				file_id: { type: 'string' },
				to_folder_id: { type: 'string' }
			},
			required: ['from_folder_id', 'file_id', 'to_folder_id']
		},
		execute(input) {
			const fromFolderId = input.from_folder_id as string;
			const fileId = input.file_id as string;
			const toFolderId = input.to_folder_id as string;
			if (!fromFolderId || !fileId || !toFolderId) {
				return { result: 'Error: from_folder_id, file_id, and to_folder_id are required' };
			}
			const ok = documents.moveDocument(fromFolderId, fileId, toFolderId);
			if (!ok) return { result: 'Error: could not move document' };
			return { result: `Moved document ${fileId} to folder ${toFolderId}.` };
		},
		verification: {
			required: true,
			buildReads(input) {
				return [
					{ name: 'inspect_folder', input: { folder_id: input.from_folder_id as string } },
					{ name: 'inspect_folder', input: { folder_id: input.to_folder_id as string } }
				];
			}
		}
	},
	{
		name: 'read_document',
		description: 'Read the content of a document by folder_id and file_id.',
		kind: 'read',
		input_schema: {
			type: 'object',
			properties: {
				folder_id: { type: 'string' },
				file_id: { type: 'string' }
			},
			required: ['folder_id', 'file_id']
		},
		execute(input) {
			const folderId = input.folder_id as string;
			const fileId = input.file_id as string;
			if (!folderId || !fileId) return { result: 'Error: folder_id and file_id are required' };
			const result = documents.getDocument(folderId, fileId);
			if (!result) return { result: 'Error: document not found' };
			return { result: `File: ${result.file.name}\n\n${result.file.content}` };
		}
	},
	{
		name: 'add_document_to_chat',
		description:
			'Add a document into the active chat as a new exchange. Defaults to the active document when available.',
		kind: 'write',
		input_schema: {
			type: 'object',
			properties: {
				folder_id: { type: 'string' },
				file_id: { type: 'string' }
			},
			required: []
		},
		execute(input, ctx) {
			const folderId = (input.folder_id as string | undefined) ?? ctx.activeDocumentKey?.folderId;
			const fileId = (input.file_id as string | undefined) ?? ctx.activeDocumentKey?.fileId;
			if (!folderId || !fileId) {
				return {
					result: 'Error: folder_id and file_id are required when there is no active document.'
				};
			}
			const result = documents.getDocument(folderId, fileId);
			if (!result) return { result: 'Error: document not found' };
			const exchangeId = documents.addDocumentToChat(folderId, fileId);
			if (!exchangeId) return { result: 'Error: could not add document to chat' };
			return {
				result: `Added document "${result.file.name}" to the chat as exchange ${exchangeId}.`
			};
		},
		verification: {
			required: true,
			buildReads(_input, execution) {
				const match = execution.result.match(/exchange ([^.]+)\.$/);
				return match ? [{ name: 'inspect_exchange', input: { exchange_id: match[1] } }] : [];
			}
		}
	},
	{
		name: 'open_document',
		description: 'Open a document in the workspace.',
		kind: 'workspace',
		input_schema: {
			type: 'object',
			properties: {
				folder_id: { type: 'string' },
				file_id: { type: 'string' }
			},
			required: ['folder_id', 'file_id']
		},
		execute(input, ctx) {
			const folderId = input.folder_id as string;
			const fileId = input.file_id as string;
			if (!folderId || !fileId) return { result: 'Error: folder_id and file_id are required' };
			if (!ctx.onOpenDocument) return { result: 'Error: opening documents is not available here' };
			ctx.onOpenDocument(folderId, fileId);
			return { result: `Opened document ${fileId}.` };
		},
		verification: {
			required: true,
			buildReads(input) {
				return [
					{
						name: 'inspect_active_document',
						input: {
							folder_id: input.folder_id as string,
							file_id: input.file_id as string
						}
					},
					{ name: 'inspect_open_documents', input: {} }
				];
			}
		}
	},
	{
		name: 'open_folder',
		description: 'Open a folder in the workspace.',
		kind: 'workspace',
		input_schema: {
			type: 'object',
			properties: {
				folder_id: { type: 'string' }
			},
			required: ['folder_id']
		},
		execute(input, ctx) {
			const folderId = input.folder_id as string;
			if (!folderId) return { result: 'Error: folder_id is required' };
			if (!ctx.onOpenFolder) return { result: 'Error: opening folders is not available here' };
			ctx.onOpenFolder(folderId);
			return { result: `Opened folder ${folderId}.` };
		},
		verification: {
			required: true,
			buildReads(input) {
				return [
					{ name: 'inspect_folder', input: { folder_id: input.folder_id as string } },
					{ name: 'inspect_workspace', input: {} }
				];
			}
		}
	},
	{
		name: 'list_folders',
		description: 'List all folders and files.',
		kind: 'read',
		input_schema: { type: 'object', properties: {}, required: [] },
		execute() {
			return { result: describeFolders(documents.getState().folders) };
		}
	},
	{
		name: 'inspect_folder',
		description: 'Inspect a folder and its immediate contents.',
		kind: 'read',
		input_schema: {
			type: 'object',
			properties: {
				folder_id: { type: 'string' }
			},
			required: ['folder_id']
		},
		execute(input) {
			const folderId = input.folder_id as string;
			if (!folderId) return { result: 'Error: folder_id is required' };
			const folder = documents.getFolder(folderId);
			if (!folder) return { result: `Folder ${folderId} was not found.` };
			const subfolders =
				(folder.folders ?? []).map((f) => `${f.name} (${f.id})`).join(', ') || 'none';
			const files = (folder.files ?? []).map((f) => `${f.name} (${f.id})`).join(', ') || 'none';
			return {
				result: `Folder "${folder.name}" (${folder.id})\nSubfolders: ${subfolders}\nFiles: ${files}`
			};
		}
	}
];

const CHAT_TOOLS: CapabilityTool[] = [
	{
		name: 'create_chat',
		description: 'Create a new chat conversation.',
		kind: 'write',
		input_schema: {
			type: 'object',
			properties: {
				name: { type: 'string' }
			},
			required: []
		},
		execute(input) {
			const name = input.name as string | undefined;
			const index = chat.createChat();
			if (name) chat.renameChat(index, name);
			const chats = chat.getChats();
			return { result: `Created chat "${chats[index].name}" (index: ${index}).` };
		},
		verification: {
			required: true,
			buildReads() {
				return [{ name: 'list_chats', input: {} }];
			}
		}
	},
	{
		name: 'select_chat',
		description: 'Switch to a different chat by index.',
		kind: 'workspace',
		input_schema: {
			type: 'object',
			properties: {
				index: { type: 'number' }
			},
			required: ['index']
		},
		execute(input) {
			const index = input.index as number;
			const chats = chat.getChats();
			if (index === undefined || index < 0 || index >= chats.length) {
				return { result: `Error: invalid chat index ${String(index)}` };
			}
			chat.selectChat(index);
			return { result: `Selected chat "${chats[index].name}".` };
		},
		verification: {
			required: true,
			buildReads() {
				return [{ name: 'inspect_active_chat', input: {} }];
			}
		}
	},
	{
		name: 'rename_chat',
		description: 'Rename a chat.',
		kind: 'write',
		input_schema: {
			type: 'object',
			properties: {
				index: { type: 'number' },
				name: { type: 'string' }
			},
			required: ['index', 'name']
		},
		execute(input) {
			const index = input.index as number;
			const name = input.name as string;
			if (index === undefined || !name) return { result: 'Error: index and name are required' };
			const result = chat.renameChat(index, name);
			if (result === null) return { result: `Error: could not rename chat to "${name}"` };
			return { result: `Renamed chat to "${result}".` };
		},
		verification: {
			required: true,
			buildReads() {
				return [{ name: 'list_chats', input: {} }];
			}
		}
	},
	{
		name: 'delete_chat',
		description: 'Delete a chat by index.',
		kind: 'write',
		input_schema: {
			type: 'object',
			properties: {
				index: { type: 'number' }
			},
			required: ['index']
		},
		execute(input) {
			const index = input.index as number;
			if (index === undefined) return { result: 'Error: index is required' };
			chat.removeChat(index);
			return { result: `Deleted chat ${index}.` };
		},
		verification: {
			required: true,
			buildReads() {
				return [{ name: 'list_chats', input: {} }];
			}
		}
	},
	{
		name: 'list_chats',
		description: 'List all chats.',
		kind: 'read',
		input_schema: { type: 'object', properties: {}, required: [] },
		execute() {
			const chats = chat.getChats();
			if (chats.length === 0) return { result: 'No chats exist.' };
			return { result: chats.map((c, i) => `${i}: ${c.name}`).join('\n') };
		}
	},
	{
		name: 'inspect_active_chat',
		description: 'Inspect the current active chat.',
		kind: 'read',
		input_schema: { type: 'object', properties: {}, required: [] },
		execute() {
			const current = chat.getChat();
			return {
				result: `Active chat: "${current.name}" (${current.id})\nActive exchange: ${current.activeExchangeId ?? 'none'}\nMode: ${current.mode}`
			};
		}
	},
	{
		name: 'inspect_child_exchanges',
		description:
			'Inspect the child exchanges (main and side chats) off an exchange. Omit exchange_id to use the active exchange.',
		kind: 'read',
		input_schema: {
			type: 'object',
			properties: {
				exchange_id: { type: 'string' }
			},
			required: []
		},
		execute(input) {
			const current = chat.getChat();
			const exchangeId = (input.exchange_id as string | undefined) ?? current.activeExchangeId;
			if (!exchangeId) return { result: 'There is no active exchange.' };
			const exchange = current.exchanges[exchangeId];
			if (!exchange) return { result: `Exchange ${exchangeId} was not found.` };
			const children = exchange.childIds
				.map((childId, index) => {
					const child = current.exchanges[childId];
					if (!child) return null;
					const chatKind = index === 0 ? 'main' : `side chat ${index}`;
					return `${chatKind}: ${child.id} -> ${child.prompt.text}`;
				})
				.filter((line): line is string => line !== null);
			return {
				result:
					children.length > 0
						? `Children of ${exchangeId}\n${children.join('\n')}`
						: `Exchange ${exchangeId} has no child exchanges.`
			};
		}
	},
	{
		name: 'delete_exchange',
		description:
			'Delete an exchange using one of the supported modes: exchange, exchangeAndMainChat, or exchangeAndSideChats.',
		kind: 'write',
		input_schema: {
			type: 'object',
			properties: {
				exchange_id: { type: 'string' },
				mode: {
					type: 'string',
					enum: ['exchange', 'exchangeAndMainChat', 'exchangeAndSideChats']
				}
			},
			required: ['exchange_id', 'mode']
		},
		execute(input) {
			const exchangeId = input.exchange_id as string;
			const mode = input.mode as chat.DeleteMode;
			if (!exchangeId || !mode) return { result: 'Error: exchange_id and mode are required' };
			const current = chat.getChat();
			const result = chat.deleteExchange(
				{ rootId: current.rootId, exchanges: current.exchanges },
				exchangeId,
				mode,
				current.activeExchangeId
			);
			if (result.error) return { result: `Error: ${result.error}` };
			return { result: `Deleted exchange ${exchangeId} with mode ${mode}.` };
		},
		verification: {
			required: true,
			buildReads(input) {
				return [
					{ name: 'inspect_active_chat', input: {} },
					{ name: 'inspect_exchange', input: { exchange_id: input.exchange_id as string } }
				];
			}
		}
	},
	{
		name: 'promote_exchange',
		description: 'Promote a side-chat root exchange into the main chat path.',
		kind: 'write',
		input_schema: {
			type: 'object',
			properties: {
				exchange_id: { type: 'string' }
			},
			required: ['exchange_id']
		},
		execute(input) {
			const exchangeId = input.exchange_id as string;
			if (!exchangeId) return { result: 'Error: exchange_id is required' };
			const current = chat.getChat();
			const result = chat.promoteExchange(
				{ rootId: current.rootId, exchanges: current.exchanges },
				exchangeId
			);
			if (result.error) return { result: `Error: ${result.error}` };
			return { result: `Promoted exchange ${exchangeId} into the main chat path.` };
		},
		verification: {
			required: true,
			buildReads(input) {
				return [
					{ name: 'inspect_active_chat', input: {} },
					{ name: 'inspect_child_exchanges', input: { exchange_id: input.exchange_id as string } }
				];
			}
		}
	}
];

const WORKSPACE_TOOLS: CapabilityTool[] = [
	{
		name: 'inspect_active_document',
		description: 'Inspect the current active document context or verify a specific document.',
		kind: 'read',
		input_schema: {
			type: 'object',
			properties: {
				folder_id: { type: 'string' },
				file_id: { type: 'string' }
			},
			required: []
		},
		execute(input, ctx) {
			const folderId = (input.folder_id as string | undefined) ?? ctx.activeDocumentKey?.folderId;
			const fileId = (input.file_id as string | undefined) ?? ctx.activeDocumentKey?.fileId;
			if (!folderId || !fileId) return { result: 'No active document is available.' };
			const result = documents.getDocument(folderId, fileId);
			if (!result) return { result: `Document ${fileId} was not found in folder ${folderId}.` };
			return {
				result: `Active document: ${result.file.name} (${result.file.id}) in folder "${result.folder.name}" (${result.folder.id})`
			};
		}
	},
	{
		name: 'inspect_open_documents',
		description: 'Inspect all currently open documents and their document keys.',
		kind: 'read',
		input_schema: { type: 'object', properties: {}, required: [] },
		execute() {
			const openDocuments = documents.getState().openDocuments;
			if (openDocuments.length === 0) return { result: 'There are no open documents.' };
			return {
				result: openDocuments
					.map((document, index) => {
						const key = document.documentKey;
						return `${index}: ${key ? `${key.folderId}/${key.fileId}` : 'unsaved scratch document'}`;
					})
					.join('\n')
			};
		}
	},
	{
		name: 'inspect_provider_state',
		description: 'Inspect the currently selected model and provider runtime state.',
		kind: 'read',
		input_schema: { type: 'object', properties: {}, required: [] },
		execute() {
			const providerState = providers.getState();
			const activeModel = providerState.activeModel;
			const ollamaProvider = providerState.providers.find((provider) => provider.id === 'ollama');
			const webllmProvider = providerState.providers.find((provider) => provider.id === 'webllm');
			const ollamaUrl =
				ollamaProvider?.kind === 'local' && ollamaProvider.connection
					? ollamaProvider.connection.value
					: 'unknown';
			const ollamaStatus =
				ollamaProvider?.kind === 'local' && ollamaProvider.connection
					? ollamaProvider.connection.status
					: 'unknown';
			const webllmStatus =
				webllmProvider?.kind === 'embedded' && webllmProvider.loadState
					? webllmProvider.loadState.status
					: 'unknown';
			return {
				result:
					`Active model: ${activeModel ? `${activeModel.provider}/${activeModel.modelId}` : 'none'}\n` +
					`Context length: ${providerState.contextLength ?? 'default'}\n` +
					`Ollama URL: ${ollamaUrl}\n` +
					`Ollama status: ${ollamaStatus}\n` +
					`WebLLM status: ${webllmStatus}`
			};
		}
	},
	{
		name: 'inspect_workspace',
		description:
			'Inspect high-level workspace context such as active document and sidebar/panel capabilities.',
		kind: 'read',
		input_schema: { type: 'object', properties: {}, required: [] },
		execute(_input, ctx) {
			const workspaceState = workspace.getState();
			const activeDocument = ctx.activeDocumentKey
				? `${ctx.activeDocumentKey.folderId}/${ctx.activeDocumentKey.fileId}`
				: 'none';
			return {
				result:
					`Workspace context\n` +
					`Current folder context: ${ctx.folderId ?? 'none'}\n` +
					`Active document: ${activeDocument}\n` +
					`Sidebar open: ${workspaceState.sidebarOpen ? 'yes' : 'no'}\n` +
					`Panels: ${workspaceState.panels.map((panel, index) => `${index}:${panel.type}`).join(', ') || 'none'}\n` +
					`Expanded folders: ${
						Object.keys(workspaceState.expandedFolders)
							.filter((id) => workspaceState.expandedFolders[id])
							.join(', ') || 'none'
					}\n` +
					`Can open documents: ${ctx.onOpenDocument ? 'yes' : 'no'}\n` +
					`Can open folders: ${ctx.onOpenFolder ? 'yes' : 'no'}\n` +
					`Can close panels: ${ctx.onClosePanel ? 'yes' : 'no'}\n` +
					`Can toggle sidebar: ${ctx.onToggleSidebar ? 'yes' : 'no'}`
			};
		}
	},
	{
		name: 'inspect_exchange',
		description:
			'Inspect an exchange in the active chat by id. Omit exchange_id to inspect the active exchange.',
		kind: 'read',
		input_schema: {
			type: 'object',
			properties: {
				exchange_id: { type: 'string' }
			},
			required: []
		},
		execute(input) {
			const current = chat.getChat();
			const exchangeId = (input.exchange_id as string | undefined) ?? current.activeExchangeId;
			if (!exchangeId) return { result: 'There is no active exchange.' };
			const exchange = current.exchanges[exchangeId];
			if (!exchange) return { result: `Exchange ${exchangeId} was not found.` };
			return {
				result:
					`Exchange ${exchange.id}\n` +
					`Parent: ${exchange.parentId ?? 'none'}\n` +
					`Children: ${exchange.childIds.join(', ') || 'none'}\n` +
					`Prompt: ${exchange.prompt.text}\n\n` +
					`Response: ${exchange.response?.text ?? '(none)'}`
			};
		}
	},
	{
		name: 'select_exchange',
		description: 'Select an exchange in the active chat by id.',
		kind: 'workspace',
		input_schema: {
			type: 'object',
			properties: {
				exchange_id: { type: 'string' }
			},
			required: ['exchange_id']
		},
		execute(input) {
			const exchangeId = input.exchange_id as string;
			if (!exchangeId) return { result: 'Error: exchange_id is required' };
			const current = chat.getChat();
			if (!current.exchanges[exchangeId])
				return { result: `Error: exchange ${exchangeId} does not exist` };
			chat.selectExchange(exchangeId);
			return { result: `Selected exchange ${exchangeId}.` };
		},
		verification: {
			required: true,
			buildReads() {
				return [{ name: 'inspect_active_chat', input: {} }];
			}
		}
	},
	{
		name: 'copy_chat_path',
		description: 'Copy the path to an exchange into a new chat.',
		kind: 'write',
		input_schema: {
			type: 'object',
			properties: {
				exchange_id: { type: 'string' }
			},
			required: ['exchange_id']
		},
		execute(input) {
			const exchangeId = input.exchange_id as string;
			if (!exchangeId) return { result: 'Error: exchange_id is required' };
			chat.copyChat(exchangeId);
			return { result: `Copied the path for exchange ${exchangeId} into a new chat.` };
		},
		verification: {
			required: true,
			buildReads() {
				return [{ name: 'list_chats', input: {} }];
			}
		}
	},
	{
		name: 'toggle_sidebar',
		description: 'Toggle the workspace sidebar.',
		kind: 'workspace',
		input_schema: { type: 'object', properties: {}, required: [] },
		execute(_input, ctx) {
			if (!ctx.onToggleSidebar)
				return { result: 'Error: toggling the sidebar is not available here' };
			ctx.onToggleSidebar();
			return { result: 'Toggled sidebar.' };
		},
		verification: {
			required: true,
			buildReads() {
				return [{ name: 'inspect_workspace', input: {} }];
			}
		}
	},
	{
		name: 'close_panel',
		description: 'Close a workspace panel by index.',
		kind: 'workspace',
		input_schema: {
			type: 'object',
			properties: {
				index: { type: 'number' }
			},
			required: ['index']
		},
		execute(input, ctx) {
			const index = input.index as number;
			if (index === undefined) return { result: 'Error: index is required' };
			if (!ctx.onClosePanel) return { result: 'Error: closing panels is not available here' };
			ctx.onClosePanel(index);
			return { result: `Closed panel ${index}.` };
		},
		verification: {
			required: true,
			buildReads() {
				return [{ name: 'inspect_workspace', input: {} }];
			}
		}
	}
];

const CAPABILITIES: CapabilityModule[] = [
	{
		id: 'documents',
		label: 'Documents',
		description: 'Create, inspect, edit, rename, move, and delete files and folders.',
		tools: DOCUMENT_TOOLS
	},
	{
		id: 'chats',
		label: 'Chats',
		description: 'Create, inspect, select, rename, and delete chats.',
		tools: CHAT_TOOLS
	},
	{
		id: 'workspace',
		label: 'Workspace',
		description: 'Inspect active workspace context and perform safe workspace actions.',
		tools: WORKSPACE_TOOLS
	}
];

const TOOLS_REGISTRY: CapabilityTool[] = CAPABILITIES.flatMap((capability) => capability.tools);

export const TOOLS: external.providers.stream.ToolDefinition[] = TOOLS_REGISTRY.map((tool) => ({
	name: tool.name,
	description: tool.description,
	input_schema: tool.input_schema
}));

export function getCapabilities(): CapabilityModule[] {
	return CAPABILITIES;
}

export function getToolDefinition(name: string): CapabilityTool | undefined {
	return TOOLS_REGISTRY.find((tool) => tool.name === name);
}

export function describeCapabilities(): string {
	return CAPABILITIES.map((capability) => {
		const toolLines = capability.tools
			.map((tool) => `- ${tool.name}: ${tool.description}`)
			.join('\n');
		return `${capability.label}:\n${toolLines}`;
	}).join('\n\n');
}

function describeFolders(folders: domain.documents.Folder[]): string {
	if (folders.length === 0) return 'No folders exist yet.';
	function describeFolder(folder: domain.documents.Folder, indent: number): string {
		const prefix = '  '.repeat(indent);
		const files = folder.files ?? [];
		const fileList =
			files.length > 0
				? files.map((f) => `${prefix}  - ${f.name} (id: ${f.id})`).join('\n')
				: `${prefix}  (empty)`;
		let result = `${prefix}${folder.name} (id: ${folder.id})\n${fileList}`;
		for (const sub of folder.folders ?? []) {
			result += '\n' + describeFolder(sub, indent + 1);
		}
		return result;
	}
	return folders.map((folder) => describeFolder(folder, 0)).join('\n\n');
}

export function executeTool(
	name: string,
	input: Record<string, unknown>,
	ctx: ToolContext
): ToolExecution {
	const tool = TOOLS_REGISTRY.find((candidate) => candidate.name === name);
	if (!tool) return { result: `Unknown tool: ${name}` };
	return tool.execute(input, ctx);
}

export function buildSystemPrompt(documentContent: string | undefined): string {
	const documentSection = documentContent
		? `\n\n<current_document>\n${documentContent}\n</current_document>`
		: '\n\nThere is no active document content.';

	return [
		'You are an agent inside a document workspace chat.',
		'Your final user-facing answer should be concise and useful.',
		'Use tools for actions and for inspection.',
		'',
		'Rules:',
		'- Treat this as a chat with tools, not a one-shot completion.',
		'- Verify important writes by using inspection tools after acting.',
		'- If a write did not succeed, try again or explain the failure.',
		'- Text you emit before tool calls is treated as live agent progress, not the final answer.',
		'- The final answer should come after your tool work is done.',
		'',
		'Capabilities:',
		describeCapabilities(),
		'',
		'When working in markdown documents, you can create charts directly with fenced code blocks.',
		'- Use ```plot for function-plot JSON configs.',
		'- Use ```plotly for Plotly JSON configs.',
		'- If a user asks for a chart in a document, prefer editing or creating the document with one of those code blocks.',
		'',
		'When creating diagrams or SVG assets, create the actual file first and then reference it from the document.',
		documentSection
	].join('\n');
}

export function buildMessages(
	prompt: string,
	documentContent: string | undefined,
	chatTree: domain.tree.ChatTree
): Message[] {
	const systemPrompt = buildSystemPrompt(documentContent);
	const chatHistory = domain.tree
		.getMainChat(chatTree)
		.flatMap((exchange) => [
			{ role: 'user', content: exchange.prompt.text } as Message,
			...(exchange.response?.text
				? ([{ role: 'assistant', content: exchange.response.text }] as Message[])
				: [])
		]);
	return [
		...chatHistory,
		{ role: 'user', content: systemPrompt },
		{ role: 'assistant', content: 'Understood.' },
		{ role: 'user', content: prompt }
	];
}

// ── Agent run ───────────────────────────────────────────────────────────────

export function isRunning(exchangeId: string): boolean {
	return state.agent.isStreaming(exchangeId);
}

export function stopRun(exchangeId: string): void {
	external.streams.cancelStream(exchangeId);
	state.agent.stopStreaming(exchangeId);
}

export function stopRunsForChat(chatId: string): void {
	external.streams.cancelStreamsForChat(chatId);
}

function summarizeInput(input: Record<string, unknown>): string {
	const entries = Object.entries(input);
	if (entries.length === 0) return '{}';
	return entries
		.slice(0, 4)
		.map(
			([key, value]) =>
				`${key}: ${typeof value === 'string' ? JSON.stringify(value) : String(value)}`
		)
		.join(', ');
}

function buildVerificationSummary(reads: VerificationRead[], ctx: ToolContext): string[] {
	return reads.map((read) => {
		const verification = executeTool(read.name, read.input, ctx);
		return `Verification via ${read.name}: ${verification.result}`;
	});
}

function getVerificationLines(
	toolName: string,
	input: Record<string, unknown>,
	executed: ToolExecution,
	ctx: ToolContext
): string[] {
	const definition = getToolDefinition(toolName);
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

export function startRun(
	chatId: string,
	exchangeId: string,
	model: domain.models.ActiveModel,
	history: domain.tree.Message[],
	toolContext: ToolContext,
	system?: string
) {
	state.agent.clearThinking(exchangeId);
	state.agent.startStreaming(exchangeId);
	state.agent.setExpanded(exchangeId, true);

	const toolExecutor: external.streams.ToolExecutor = {
		execute(toolCalls) {
			const results: Array<{ tool_use_id: string; content: string }> = [];
			const summary: string[] = [];

			for (const toolCall of toolCalls) {
				state.agent.appendThinkingEvent(
					exchangeId,
					'tool_call',
					`${toolCall.name}(${summarizeInput(toolCall.input)})`
				);
				const executed = executeTool(toolCall.name, toolCall.input, toolContext);
				const verificationLines = getVerificationLines(
					toolCall.name,
					toolCall.input,
					executed,
					toolContext
				);
				for (const line of verificationLines) {
					state.agent.appendThinkingEvent(exchangeId, 'verification', line);
				}
				const content = [executed.result, ...verificationLines].join('\n');
				state.agent.appendThinkingEvent(exchangeId, 'tool_result', content);
				results.push({ tool_use_id: toolCall.id, content });
			}

			return { results, summary };
		}
	};

	external.streams.startStream(
		{
			exchangeId,
			chatId,
			model,
			history,
			tools: TOOLS,
			system,
			toolExecutor,
			callbacks: {
				onDelta: (eid, fullText) => state.agent.setLiveStatus(eid, fullText),
				onToolNote: (eid, text) => state.agent.appendThinkingEvent(eid, 'note', text),
				onComplete: (eid, responseText) => {
					state.agent.clearLiveStatus(eid);
					if (responseText) state.agent.setLastResponse(responseText);
					state.agent.stopStreaming(eid);
				},
				onError: (eid, message) => {
					state.agent.appendThinkingEvent(eid, 'status', `Run failed: ${message}`);
					state.agent.clearLiveStatus(eid);
					state.agent.stopStreaming(eid);
				}
			}
		},
		{
			getTreeByChatId: state.chats.getTreeByChatId,
			replaceTreeByChatId: state.chats.replaceTreeByChatId,
			getProviderStream: (activeModel, streamHistory, signal, streamTools, streamSystem) =>
				external.providers.stream.getProviderStream(
					activeModel,
					streamHistory,
					signal,
					{
						apiKey: state.providers.providerState.apiKeys[activeModel.provider] ?? '',
						ollamaUrl: state.providers.providerState.ollamaUrl
					},
					streamTools,
					streamSystem
				)
		}
	);
}

export function acceptPending(documentKey: { folderId: string; fileId: string } | null) {
	const pending = state.agent.agentState.pendingContent;
	if (pending !== null && documentKey) {
		documents.updateOpenDocumentContent(documentKey.folderId, documentKey.fileId, pending);
	}
	state.agent.setPendingContent(null);
}

export function rejectPending() {
	state.agent.setPendingContent(null);
}

export function dismissResponse() {
	state.agent.setLastResponse(null);
}

export function setThinkingExpanded(exchangeId: string, expanded: boolean) {
	state.agent.setExpanded(exchangeId, expanded);
}

export function stop() {
	for (const exchangeId of [...state.agent.agentState.streamingExchangeIds]) {
		state.agent.stopStreaming(exchangeId);
	}
}

export function reset() {
	state.agent.reset();
}
