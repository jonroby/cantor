import * as state from '@/state';
import * as external from '@/external';
import * as lib from '@/lib';
import JSZip from 'jszip';
import { addDocumentToChat as appendDocumentToChat } from '@/app/chat';

export const getState = () => state.documents.docState;
export const createFolder = state.documents.newFolder;
export const closeDocument = state.documents.closeDoc;
export const deleteFolder = state.documents.deleteFolder;

export interface DocumentCommandDeps {
	getActiveChat: typeof state.chats.getActiveChat;
	getFolders: () => state.documents.ChatFolder[];
	newDocInFolder: typeof state.documents.newDocInFolder;
	selectDoc: typeof state.documents.selectDoc;
	appendDocumentToChat: typeof appendDocumentToChat;
}

export interface DocumentTransferFeedback {
	success?: (message: string) => void;
	error?: (message: string) => void;
}

const NOOP_FEEDBACK: DocumentTransferFeedback = {};

const defaultDeps: DocumentCommandDeps = {
	getActiveChat: state.chats.getActiveChat,
	getFolders: () => state.documents.docState.folders,
	newDocInFolder: state.documents.newDocInFolder,
	selectDoc: state.documents.selectDoc,
	appendDocumentToChat
};

export function openDocument(
	folderId: string,
	fileId: string,
	deps: DocumentCommandDeps = defaultDeps
): boolean {
	const folder = deps.getFolders().find((candidate) => candidate.id === folderId);
	const file = folder?.files?.find((candidate) => candidate.id === fileId);
	if (!file) return false;

	deps.selectDoc(folderId, fileId);
	return true;
}

export function createDocument(
	folderId: string,
	deps: DocumentCommandDeps = defaultDeps
): { folderId: string; fileId: string } | null {
	const fileId = deps.newDocInFolder(folderId);
	if (!fileId) return null;

	deps.selectDoc(folderId, fileId);
	return { folderId, fileId };
}

export function addDocumentToChat(
	folderId: string,
	fileId: string,
	deps: DocumentCommandDeps = defaultDeps
): boolean {
	const folder = deps.getFolders().find((candidate) => candidate.id === folderId);
	const file = folder?.files?.find((candidate) => candidate.id === fileId);
	if (!file) return false;

	const activeChat = deps.getActiveChat();
	const tree = { rootId: activeChat.rootId, exchanges: activeChat.exchanges };
	deps.appendDocumentToChat(tree, activeChat.activeExchangeId, file.content, file.name);
	return true;
}

export function renameFolder(folderId: string, name: string): string | null {
	const trimmed = name.trim();
	if (!trimmed) return null;

	let candidate = trimmed;
	let i = 1;
	while (!state.documents.renameFolder(folderId, candidate)) {
		candidate = `${trimmed} (${i})`;
		i++;
	}
	return candidate;
}
export const deleteDocument = state.documents.deleteDocFromFolder;
export function renameDocument(folderId: string, fileId: string, name: string): string | null {
	const trimmed = name.trim();
	if (!trimmed) return null;

	let candidate = trimmed;
	let i = 1;
	while (!state.documents.renameDocInFolder(folderId, fileId, candidate)) {
		candidate = `${trimmed} (${i})`;
		i++;
	}
	return candidate;
}
export const moveDocument = state.documents.moveDocToFolder;
export const updateDocumentContent = state.documents.updateDocContent;
export const validateDocumentMarkdown = lib.validateMd.validate;

export function importDocument(
	folderId: string,
	feedback: DocumentTransferFeedback = NOOP_FEEDBACK
) {
	const input = document.createElement('input');
	input.type = 'file';
	input.accept = '.md';
	input.onchange = () => {
		const file = input.files?.[0];
		if (!file) return;
		const folder = state.documents.docState.folders.find((candidate) => candidate.id === folderId);
		if (!folder) {
			feedback.error?.('Folder not found');
			return;
		}
		const reader = new FileReader();
		reader.onload = () => {
			if (typeof reader.result !== 'string') return;
			const errors = lib.validateMd.validate(reader.result);
			if (errors.length > 0) {
				feedback.error?.(`Invalid markdown: ${errors.join('; ')}`);
				return;
			}
			const existingNames = (folder.files ?? []).map((candidate) => candidate.name);
			const name = external.files.deduplicateName(file.name, existingNames);
			const document: state.documents.DocFile = {
				id: crypto.randomUUID(),
				name,
				content: reader.result
			};
			state.documents.docState.folders = state.documents.docState.folders.map((candidate) =>
				candidate.id === folderId
					? { ...candidate, files: [...(candidate.files ?? []), document] }
					: candidate
			);
			feedback.success?.(`Uploaded ${file.name}`);
		};
		reader.readAsText(file);
	};
	input.click();
}

export async function exportFolder(
	folderId: string,
	feedback: DocumentTransferFeedback = NOOP_FEEDBACK
) {
	const folder = state.documents.docState.folders.find((candidate) => candidate.id === folderId);
	if (!folder || !folder.files?.length) {
		feedback.error?.('Folder is empty');
		return;
	}
	const zip = new JSZip();
	for (const file of folder.files) {
		zip.file(file.name, file.content);
	}
	const blob = await zip.generateAsync({ type: 'blob' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = `${folder.name}.zip`;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	setTimeout(() => URL.revokeObjectURL(url), 100);
}

function importDocumentsIntoFolder(
	folderId: string,
	mdFiles: File[],
	feedback: DocumentTransferFeedback = NOOP_FEEDBACK
) {
	const folder = state.documents.docState.folders.find((candidate) => candidate.id === folderId);
	if (!folder) {
		feedback.error?.('Folder not found');
		return;
	}

	let imported = 0;
	let processed = 0;
	const existingNames = (folder.files ?? []).map((candidate) => candidate.name);

	for (const file of mdFiles) {
		const reader = new FileReader();
		reader.onload = () => {
			if (typeof reader.result !== 'string') return;
			const errors = lib.validateMd.validate(reader.result);
			if (errors.length > 0) {
				feedback.error?.(`Skipped ${file.name}: ${errors.join('; ')}`);
			} else {
				const name = external.files.deduplicateName(file.name, existingNames);
				existingNames.push(name);
				const document: state.documents.DocFile = {
					id: crypto.randomUUID(),
					name,
					content: reader.result
				};
				state.documents.docState.folders = state.documents.docState.folders.map((candidate) =>
					candidate.id === folderId
						? { ...candidate, files: [...(candidate.files ?? []), document] }
						: candidate
				);
				imported++;
			}

			processed++;
			if (processed === mdFiles.length && imported > 0) {
				feedback.success?.(`Uploaded ${imported} file${imported === 1 ? '' : 's'}`);
			}
		};
		reader.readAsText(file);
	}
}

export function importFolder(feedback: DocumentTransferFeedback = NOOP_FEEDBACK) {
	const input = document.createElement('input');
	input.type = 'file';
	input.webkitdirectory = true;
	input.onchange = () => {
		const files = input.files;
		if (!files || files.length === 0) return;

		const mdFiles = Array.from(files).filter((file) => file.name.endsWith('.md'));
		if (mdFiles.length === 0) {
			feedback.error?.('No .md files found in the selected folder');
			return;
		}

		const dirName = mdFiles[0].webkitRelativePath?.split('/')[0] ?? 'Uploaded Folder';
		const folderName = external.files.deduplicateName(
			dirName,
			state.documents.docState.folders.map((folder) => folder.name)
		);

		const folderId = crypto.randomUUID();
		const folder: state.documents.ChatFolder = { id: folderId, name: folderName, files: [] };
		state.documents.docState.folders = [...state.documents.docState.folders, folder];

		importDocumentsIntoFolder(folderId, mdFiles, feedback);
	};
	input.click();
}

export function importFolderIntoFolder(
	folderId: string,
	feedback: DocumentTransferFeedback = NOOP_FEEDBACK
) {
	const input = document.createElement('input');
	input.type = 'file';
	input.webkitdirectory = true;
	input.onchange = () => {
		const files = input.files;
		if (!files || files.length === 0) return;

		const mdFiles = Array.from(files).filter((file) => file.name.endsWith('.md'));
		if (mdFiles.length === 0) {
			feedback.error?.('No .md files found in the selected folder');
			return;
		}

		importDocumentsIntoFolder(folderId, mdFiles, feedback);
	};
	input.click();
}

export function getDocument(
	folders: state.documents.ChatFolder[],
	folderId: string,
	fileId: string
): { folder: state.documents.ChatFolder; file: state.documents.DocFile } | null {
	const folder = folders.find((candidate) => candidate.id === folderId);
	const file = folder?.files?.find((candidate) => candidate.id === fileId);
	if (!folder || !file) return null;
	return { folder, file };
}

export type ChatFolder = state.documents.ChatFolder;
export type DocFile = state.documents.DocFile;
export type OpenDoc = state.documents.OpenDoc;
