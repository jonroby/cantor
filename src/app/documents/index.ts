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
export const deleteFolder = state.documents.deleteFolder;

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

export function addDocumentToChat(
	folderId: string,
	fileId: string,
	deps: DocumentCommandDeps = defaultDeps
): boolean {
	const folder = deps.findFolder(folderId);
	const file = folder?.files?.find((candidate) => candidate.id === fileId);
	if (!file) return false;

	const activeChat = deps.getActiveChat();
	const tree = { rootId: activeChat.rootId, exchanges: activeChat.exchanges };
	deps.appendDocumentToChat(tree, activeChat.activeExchangeId, file.content, file.name);
	return true;
}

export function renameFolder(folderId: string, name: string): string | null {
	return lib.rename.renameWithDedup(name, (candidate) =>
		state.documents.renameFolder(folderId, candidate)
	);
}
export const deleteDocument = state.documents.deleteDocumentFromFolder;
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

export function importDocument(
	folderId: string,
	feedback: DocumentTransferFeedback = NOOP_FEEDBACK
) {
	void external.io.pickFile('.md,.svg').then(async (file) => {
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
	});
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

export function importFolder(feedback: DocumentTransferFeedback = NOOP_FEEDBACK) {
	void external.io.pickDirectory().then((files) => {
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

		importDocumentsIntoFolder(folderId, supportedFiles, feedback);
	});
}

export function importFolderIntoFolder(
	folderId: string,
	feedback: DocumentTransferFeedback = NOOP_FEEDBACK
) {
	void external.io.pickDirectory().then((files) => {
		if (files.length === 0) return;
		const supportedFiles = files.filter(
			(file) => file.name.endsWith('.md') || file.name.endsWith('.svg')
		);
		if (supportedFiles.length === 0) {
			feedback.error?.('No .md or .svg files found in the selected folder');
			return;
		}

		importDocumentsIntoFolder(folderId, supportedFiles, feedback);
	});
}

export function getDocument(
	folderId: string,
	fileId: string
): { folder: state.documents.Folder; file: state.documents.DocumentFile } | null {
	const folder = state.documents.findFolder(folderId);
	const file = folder?.files?.find((candidate) => candidate.id === fileId);
	if (!folder || !file) return null;
	return { folder, file };
}

export type Folder = state.documents.Folder;
export type DocumentFile = state.documents.DocumentFile;
export type OpenDocument = state.documents.OpenDocument;
