import * as state from '@/state';
import * as lib from '@/lib';

export * from './commands';
export * from './queries';
export const getState = () => state.documents.docState;
export const createFolder = state.documents.newFolder;
export const closeDocument = state.documents.closeDoc;
export const deleteFolder = state.documents.deleteFolder;
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

export type ChatFolder = state.documents.ChatFolder;
export type DocFile = state.documents.DocFile;
export type OpenDoc = state.documents.OpenDoc;
