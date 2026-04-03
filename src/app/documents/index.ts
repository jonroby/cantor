import * as domain from '@/domain';
import * as state from '@/state';
import * as lib from '@/lib';
import * as external from '@/external';
import * as chat from '@/app/chat';
import JSZip from 'jszip';

export const SUPPORTED_EXTENSIONS = ['.md', '.svg'] as const;

export function isSupportedFileName(name: string): boolean {
	return SUPPORTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export function supportedExtensionsLabel(): string {
	return SUPPORTED_EXTENSIONS.join(', ');
}

export const getState = () => state.documents.documentState;
export const createFolder = state.documents.newFolder;
export const closeDocument = state.documents.closeDocument;
export function deleteFolder(folderId: string) {
	const folder = state.documents.findFolder(folderId);
	if (folder) {
		void external.persistence.trashItem({
			id: crypto.randomUUID(),
			type: 'folder',
			name: folder.name,
			deletedAt: Date.now(),
			data: { id: folder.id, name: folder.name, files: folder.files, folders: folder.folders }
		});
	}
	state.documents.deleteFolder(folderId);
}

export interface DocumentCommandDeps {
	getActiveChat: typeof state.chats.getActiveChat;
	findFolder: typeof state.documents.findFolder;
	createDocumentInFolder: typeof state.documents.createDocumentInFolder;
	selectDocument: typeof state.documents.selectDocument;
	appendDocumentToChat: typeof chat.addDocumentToChat;
}

export interface DocumentTransferFeedback {
	success?: (message: string) => void;
	error?: (message: string) => void;
}

const NOOP_FEEDBACK: DocumentTransferFeedback = {};

function deduplicateImportedName(name: string, existingNames: string[]): string {
	const ext = name.lastIndexOf('.') !== -1 ? name.slice(name.lastIndexOf('.')) : '';
	const base = ext ? name.slice(0, name.lastIndexOf('.')) : name;
	const deduplicatedBase =
		lib.rename.renameWithDedup(
			base,
			(candidate) => !existingNames.includes(`${candidate}${ext}`)
		) ?? base;
	return `${deduplicatedBase}${ext}`;
}

const defaultDeps: DocumentCommandDeps = {
	getActiveChat: state.chats.getActiveChat,
	findFolder: state.documents.findFolder,
	createDocumentInFolder: state.documents.createDocumentInFolder,
	selectDocument: state.documents.selectDocument,
	appendDocumentToChat: chat.addDocumentToChat
};

export function openDocument(
	folderId: string,
	fileId: string,
	deps: DocumentCommandDeps = defaultDeps
): boolean {
	const folder = deps.findFolder(folderId);
	const file = folder?.files?.find((candidate) => candidate.id === fileId);
	if (!file) return false;

	deps.selectDocument(folderId, fileId);
	return true;
}

export function createDocument(
	folderId: string,
	deps: DocumentCommandDeps = defaultDeps
): { folderId: string; fileId: string } | null {
	const fileId = deps.createDocumentInFolder(folderId);
	if (!fileId) return null;

	deps.selectDocument(folderId, fileId);
	return { folderId, fileId };
}

export interface CreateNamedFolderResult {
	folderId: string;
	name: string;
}

export function createNamedFolder(
	name: string,
	parentFolderId?: string
): CreateNamedFolderResult | null {
	const folderId = createFolder(parentFolderId);
	const actualName = renameFolder(folderId, name);
	if (actualName === null) return null;
	return { folderId, name: actualName };
}

export interface CreateFileWithContentResult {
	folderId: string;
	fileId: string;
	name: string;
	path: string;
}

export function createFileWithContent(
	folderId: string,
	filename: string,
	content: string,
	options?: { subfolder?: string }
): { result: CreateFileWithContentResult | null; error?: string } {
	if (!isSupportedFileName(filename)) {
		return { result: null, error: `Cantor only supports: ${supportedExtensionsLabel()}` };
	}

	let targetFolderId = folderId;
	const subfolder = options?.subfolder;
	if (subfolder) {
		const folder = getFolder(folderId);
		if (!folder) return { result: null, error: 'Parent folder not found.' };
		const existing = folder.folders?.find((candidate) => candidate.name === subfolder);
		if (existing) {
			targetFolderId = existing.id;
		} else {
			const createdFolder = createNamedFolder(subfolder, folderId);
			if (!createdFolder) return { result: null, error: `Could not create folder "${subfolder}".` };
			targetFolderId = createdFolder.folderId;
		}
	}

	const createdDocument = createDocument(targetFolderId);
	if (!createdDocument) {
		return { result: null, error: `Could not create file "${filename}".` };
	}

	const renameResult = renameDocument(targetFolderId, createdDocument.fileId, filename);
	if (renameResult.error) return { result: null, error: renameResult.error };
	if (renameResult.result === null) {
		return { result: null, error: `Could not rename file to "${filename}".` };
	}

	updateOpenDocumentContent(targetFolderId, createdDocument.fileId, content);
	const path = subfolder ? `${subfolder}/${renameResult.result}` : renameResult.result;
	return {
		result: {
			folderId: targetFolderId,
			fileId: createdDocument.fileId,
			name: renameResult.result,
			path
		}
	};
}

export function addDocumentToChat(
	folderId: string,
	fileId: string,
	deps: DocumentCommandDeps = defaultDeps
): string | null {
	const folder = deps.findFolder(folderId);
	const file = folder?.files?.find((candidate) => candidate.id === fileId);
	if (!file) return null;

	const activeChat = deps.getActiveChat();
	const tree = { rootId: activeChat.rootId, exchanges: activeChat.exchanges };
	return deps.appendDocumentToChat(tree, activeChat.activeExchangeId, file.content, file.name);
}

export function renameFolder(folderId: string, name: string): string | null {
	return lib.rename.renameWithDedup(name, (candidate) =>
		state.documents.renameFolder(folderId, candidate)
	);
}
export function deleteDocument(folderId: string, fileId: string) {
	const folder = state.documents.findFolder(folderId);
	const file = folder?.files?.find((f) => f.id === fileId);
	if (file) {
		void external.persistence.trashItem({
			id: crypto.randomUUID(),
			type: 'document',
			name: file.name,
			deletedAt: Date.now(),
			data: { folderId, file: { id: file.id, name: file.name, content: file.content } }
		});
	}
	state.documents.deleteDocumentFromFolder(folderId, fileId);
}
export function renameDocument(
	folderId: string,
	fileId: string,
	name: string
): { result: string | null; error?: string } {
	if (!isSupportedFileName(name)) {
		return { result: null, error: `Cantor only supports: ${supportedExtensionsLabel()}` };
	}
	const result = lib.rename.renameWithDedup(name, (candidate) =>
		state.documents.renameDocumentInFolder(folderId, fileId, candidate)
	);
	return { result };
}
export const moveDocument = state.documents.moveDocumentToFolder;
export const updateDocumentContent = state.documents.updateDocumentContent;
export const validateDocumentMarkdown = lib.validateMd.validate;

export async function importDocument(
	folderId: string,
	feedback: DocumentTransferFeedback = NOOP_FEEDBACK
): Promise<void> {
	const file = await external.io.pickFile('.md,.svg');
	if (!file) return;
	const folder = state.documents.findFolder(folderId);
	if (!folder) {
		feedback.error?.('Folder not found');
		return;
	}
	const content = await file.text();
	if (file.name.endsWith('.md')) {
		const errors = lib.validateMd.validate(content);
		if (errors.length > 0) {
			feedback.error?.(`Invalid markdown: ${errors.join('; ')}`);
			return;
		}
	}
	const existingNames = (folder.files ?? []).map((candidate) => candidate.name);
	const name = deduplicateImportedName(file.name, existingNames);
	const documentFile: state.documents.DocumentFile = {
		id: crypto.randomUUID(),
		name,
		content
	};
	folder.files = [...(folder.files ?? []), documentFile];
	feedback.success?.(`Uploaded ${file.name}`);
}

export async function exportFolder(
	folderId: string,
	feedback: DocumentTransferFeedback = NOOP_FEEDBACK
) {
	const folder = state.documents.findFolder(folderId);
	if (!folder || !folder.files?.length) {
		feedback.error?.('Folder is empty');
		return;
	}
	const zip = new JSZip();
	for (const file of folder.files) {
		zip.file(file.name, file.content);
	}
	const blob = await zip.generateAsync({ type: 'blob' });
	external.io.downloadBlob(blob, `${folder.name}.zip`);
}

async function importDocumentsIntoFolder(
	folderId: string,
	files: File[],
	feedback: DocumentTransferFeedback = NOOP_FEEDBACK
) {
	const folder = state.documents.findFolder(folderId);
	if (!folder) {
		feedback.error?.('Folder not found');
		return;
	}

	let imported = 0;
	const existingNames = (folder.files ?? []).map((candidate) => candidate.name);

	for (const file of files) {
		const content = await file.text();
		if (file.name.endsWith('.md')) {
			const errors = lib.validateMd.validate(content);
			if (errors.length > 0) {
				feedback.error?.(`Skipped ${file.name}: ${errors.join('; ')}`);
				continue;
			}
		}
		const name = deduplicateImportedName(file.name, existingNames);
		existingNames.push(name);
		const documentFile: state.documents.DocumentFile = {
			id: crypto.randomUUID(),
			name,
			content
		};
		folder.files = [...(folder.files ?? []), documentFile];
		imported++;
	}

	if (imported > 0) {
		feedback.success?.(`Uploaded ${imported} file${imported === 1 ? '' : 's'}`);
	}
}

export async function importFolder(
	feedback: DocumentTransferFeedback = NOOP_FEEDBACK
): Promise<void> {
	const files = await external.io.pickDirectory();
	if (files.length === 0) return;
	const supportedFiles = files.filter(
		(file) => file.name.endsWith('.md') || file.name.endsWith('.svg')
	);
	if (supportedFiles.length === 0) {
		feedback.error?.('No .md or .svg files found in the selected folder');
		return;
	}

	const dirName = supportedFiles[0].webkitRelativePath?.split('/')[0] ?? 'Uploaded Folder';
	const folderName = deduplicateImportedName(
		dirName,
		state.documents.documentState.folders.map((folder) => folder.name)
	);

	const folderId = crypto.randomUUID();
	const folder: state.documents.Folder = { id: folderId, name: folderName, files: [] };
	state.documents.documentState.folders = [...state.documents.documentState.folders, folder];

	await importDocumentsIntoFolder(folderId, supportedFiles, feedback);
}

export async function importFolderIntoFolder(
	folderId: string,
	feedback: DocumentTransferFeedback = NOOP_FEEDBACK
): Promise<void> {
	const files = await external.io.pickDirectory();
	if (files.length === 0) return;
	const supportedFiles = files.filter(
		(file) => file.name.endsWith('.md') || file.name.endsWith('.svg')
	);
	if (supportedFiles.length === 0) {
		feedback.error?.('No .md or .svg files found in the selected folder');
		return;
	}

	await importDocumentsIntoFolder(folderId, supportedFiles, feedback);
}

export function getDocument(
	folderId: string,
	fileId: string
): { folder: domain.documents.Folder; file: domain.documents.DocumentFile } | null {
	const folder = state.documents.findFolder(folderId);
	if (!folder) return null;
	const file = domain.documents.findFile(folder, fileId);
	if (!file) return null;
	return { folder, file };
}

export function getFolder(folderId: string): domain.documents.Folder | undefined {
	return state.documents.findFolder(folderId);
}

export function resolveAsset(folderId: string, name: string): string | null {
	const folder = state.documents.findFolder(folderId);
	if (!folder) return null;
	return domain.documents.resolveAsset(folder, name);
}

export function findOpenDocumentIndex(folderId: string, fileId: string): number {
	return domain.documents.findOpenDocumentIndex(getState().openDocuments, folderId, fileId);
}

export function updateOpenDocumentContent(folderId: string, fileId: string, content: string): void {
	const index = findOpenDocumentIndex(folderId, fileId);
	if (index >= 0) state.documents.updateDocumentContent(index, content);
}

export function closeOpenDocument(folderId: string, fileId: string): void {
	const index = findOpenDocumentIndex(folderId, fileId);
	if (index >= 0) state.documents.closeDocument(index);
}

export type Folder = domain.documents.Folder;
export type DocumentFile = domain.documents.DocumentFile;
export type OpenDocument = domain.documents.OpenDocument;
