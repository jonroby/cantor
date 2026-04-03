import * as domain from '@/domain';
import * as state from '@/state';
import * as external from '@/external';
import * as documents from '@/app/documents';
import * as chat from '@/app/chat';

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

export interface ToolExecution {
	result: string;
	pendingContent?: string;
	suggestedVerificationReads?: VerificationRead[];
}

export interface CapabilityTool {
	name: string;
	description: string;
	kind: 'read' | 'write' | 'workspace';
	input_schema: Record<string, unknown>;
	execute: (input: Record<string, unknown>, ctx: ToolContext) => ToolExecution;
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
		}
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
				folder_id: { type: 'string', description: 'Target folder id. Defaults to current folder context.' },
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

			let targetFolderId = folderId;
			if (subfolder) {
				const folder = documents.getFolder(folderId);
				if (!folder) return { result: 'Error: parent folder not found' };
				const existing = folder.folders?.find((f) => f.name === subfolder);
				if (existing) {
					targetFolderId = existing.id;
				} else {
					targetFolderId = documents.createFolder(folderId);
					documents.renameFolder(targetFolderId, subfolder);
				}
			}

			const created = documents.createDocument(targetFolderId);
			if (!created) return { result: `Error: could not create file "${filename}"` };
			const renameResult = documents.renameDocument(targetFolderId, created.fileId, filename);
			documents.updateOpenDocumentContent(targetFolderId, created.fileId, content);
			const actualName = renameResult.result ?? filename;
			const path = subfolder ? `${subfolder}/${actualName}` : actualName;
			return {
				result:
					actualName === filename
						? `Created "${path}" in folder ${targetFolderId}.`
						: `Created "${path}" in folder ${targetFolderId}. The original name "${filename}" was already taken.`,
				suggestedVerificationReads: [
					{ name: 'inspect_folder', input: { folder_id: targetFolderId } },
					{ name: 'read_document', input: { folder_id: targetFolderId, file_id: created.fileId } }
				]
			};
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
			const folderId = documents.createFolder(parentFolderId);
			documents.renameFolder(folderId, name);
			return {
				result: `Created folder "${name}" (id: ${folderId}).`,
				suggestedVerificationReads: [{ name: 'inspect_folder', input: { folder_id: folderId } }]
			};
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
			return {
				result: `Renamed folder to "${result}".`,
				suggestedVerificationReads: [{ name: 'inspect_folder', input: { folder_id: folderId } }]
			};
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
			return {
				result: `Renamed document to "${result}".`,
				suggestedVerificationReads: [{ name: 'inspect_folder', input: { folder_id: folderId } }]
			};
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
			return {
				result: `Deleted folder ${folderId}.`,
				suggestedVerificationReads: [{ name: 'list_folders', input: {} }]
			};
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
			return {
				result: `Deleted document ${fileId}.`,
				suggestedVerificationReads: [{ name: 'inspect_folder', input: { folder_id: folderId } }]
			};
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
			return {
				result: `Moved document ${fileId} to folder ${toFolderId}.`,
				suggestedVerificationReads: [
					{ name: 'inspect_folder', input: { folder_id: fromFolderId } },
					{ name: 'inspect_folder', input: { folder_id: toFolderId } }
				]
			};
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
			documents.openDocument(folderId, fileId);
			ctx.onOpenDocument(folderId, fileId);
			return {
				result: `Opened document ${fileId}.`,
				suggestedVerificationReads: [{ name: 'inspect_active_document', input: { folder_id: folderId, file_id: fileId } }]
			};
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
			return {
				result: `Opened folder ${folderId}.`,
				suggestedVerificationReads: [{ name: 'inspect_folder', input: { folder_id: folderId } }]
			};
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
			const subfolders = (folder.folders ?? []).map((f) => `${f.name} (${f.id})`).join(', ') || 'none';
			const files = (folder.files ?? []).map((f) => `${f.name} (${f.id})`).join(', ') || 'none';
			return {
				result: `Folder "${folder.name}" (${folder.id})\nSubfolders: ${subfolders}\nFiles: ${files}`
			};
		}
	},
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
			return {
				result: `Created chat "${chats[index].name}" (index: ${index}).`,
				suggestedVerificationReads: [{ name: 'list_chats', input: {} }]
			};
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
			return {
				result: `Selected chat "${chats[index].name}".`,
				suggestedVerificationReads: [{ name: 'inspect_active_chat', input: {} }]
			};
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
			return {
				result: `Renamed chat to "${result}".`,
				suggestedVerificationReads: [{ name: 'list_chats', input: {} }]
			};
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
			return {
				result: `Deleted chat ${index}.`,
				suggestedVerificationReads: [{ name: 'list_chats', input: {} }]
			};
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
		name: 'inspect_chat_branches',
		description: 'Inspect the child exchanges branching off an exchange. Omit exchange_id to use the active exchange.',
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
					const branchKind = index === 0 ? 'main' : `side ${index}`;
					return `${branchKind}: ${child.id} -> ${child.prompt.text}`;
				})
				.filter((line): line is string => line !== null);
			return {
				result:
					children.length > 0
						? `Branches from ${exchangeId}\n${children.join('\n')}`
						: `Exchange ${exchangeId} has no child branches.`
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
			return {
				result: `Deleted exchange ${exchangeId} with mode ${mode}.`,
				suggestedVerificationReads: [
					{ name: 'inspect_active_chat', input: {} },
					{ name: 'inspect_exchange', input: { exchange_id: exchangeId } }
				]
			};
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
			return {
				result: `Promoted exchange ${exchangeId} into the main chat path.`,
				suggestedVerificationReads: [
					{ name: 'inspect_active_chat', input: {} },
					{ name: 'inspect_chat_branches', input: { exchange_id: exchangeId } }
				]
			};
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
			const providerState = state.providers.providerState;
			const activeModel = providerState.activeModel;
			return {
				result:
					`Active model: ${activeModel ? `${activeModel.provider}/${activeModel.modelId}` : 'none'}\n` +
					`Context length: ${providerState.contextLength ?? 'default'}\n` +
					`Ollama URL: ${providerState.ollamaUrl}\n` +
					`Ollama status: ${providerState.ollamaStatus}\n` +
					`WebLLM status: ${providerState.webllmStatus}`
			};
		}
	},
	{
		name: 'inspect_workspace',
		description: 'Inspect high-level workspace context such as active document and sidebar/panel capabilities.',
		kind: 'read',
		input_schema: { type: 'object', properties: {}, required: [] },
		execute(_input, ctx) {
			const activeDocument = ctx.activeDocumentKey
				? `${ctx.activeDocumentKey.folderId}/${ctx.activeDocumentKey.fileId}`
				: 'none';
			return {
				result:
					`Workspace context\n` +
					`Current folder context: ${ctx.folderId ?? 'none'}\n` +
					`Active document: ${activeDocument}\n` +
					`Can open documents: ${ctx.onOpenDocument ? 'yes' : 'no'}\n` +
					`Can open folders: ${ctx.onOpenFolder ? 'yes' : 'no'}\n` +
					`Can close panels: ${ctx.onClosePanel ? 'yes' : 'no'}\n` +
					`Can toggle sidebar: ${ctx.onToggleSidebar ? 'yes' : 'no'}`
			};
		}
	},
	{
		name: 'inspect_exchange',
		description: 'Inspect an exchange in the active chat by id. Omit exchange_id to inspect the active exchange.',
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
			if (!current.exchanges[exchangeId]) return { result: `Error: exchange ${exchangeId} does not exist` };
			chat.selectExchange(exchangeId);
			return {
				result: `Selected exchange ${exchangeId}.`,
				suggestedVerificationReads: [{ name: 'inspect_active_chat', input: {} }]
			};
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
			return {
				result: `Copied the path for exchange ${exchangeId} into a new chat.`,
				suggestedVerificationReads: [{ name: 'list_chats', input: {} }]
			};
		}
	},
	{
		name: 'toggle_sidebar',
		description: 'Toggle the workspace sidebar.',
		kind: 'workspace',
		input_schema: { type: 'object', properties: {}, required: [] },
		execute(_input, ctx) {
			if (!ctx.onToggleSidebar) return { result: 'Error: toggling the sidebar is not available here' };
			ctx.onToggleSidebar();
			return { result: 'Toggled sidebar.' };
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
