import { getActiveChat } from '@/state';
import { docState, newDocInFolder, selectDoc, closeDoc, type ChatFolder } from '@/state';
import {
	getPersistedLayout,
	saveToStorage,
	setPersistedLayout
} from '@/external/persistence/database';
import { performAddDocToChat } from './chat-actions';
export { getFolderFile } from '@/app/documents/queries';

interface RestoreResult {
	folderId: string;
	fileId: string;
}

export interface DocumentActionDeps {
	getActiveChat: typeof getActiveChat;
	getFolders: () => ChatFolder[];
	newDocInFolder: typeof newDocInFolder;
	selectDoc: typeof selectDoc;
	closeDoc: typeof closeDoc;
	getPersistedLayout: typeof getPersistedLayout;
	setPersistedLayout: typeof setPersistedLayout;
	saveToStorage: typeof saveToStorage;
	performAddDocToChat: typeof performAddDocToChat;
}

const defaultDeps: DocumentActionDeps = {
	getActiveChat,
	getFolders: () => docState.folders,
	newDocInFolder,
	selectDoc,
	closeDoc,
	getPersistedLayout,
	setPersistedLayout,
	saveToStorage,
	performAddDocToChat
};

export function performOpenDocument(
	folderId: string,
	fileId: string,
	deps: DocumentActionDeps = defaultDeps
): boolean {
	const folder = deps.getFolders().find((candidate) => candidate.id === folderId);
	const file = folder?.files?.find((candidate) => candidate.id === fileId);
	if (!file) return false;

	deps.selectDoc(folderId, fileId);
	deps.setPersistedLayout({ openDocument: { folderId, fileId } });
	deps.saveToStorage();
	return true;
}

export function performCreateDocument(
	folderId: string,
	deps: DocumentActionDeps = defaultDeps
): RestoreResult | null {
	const fileId = deps.newDocInFolder(folderId);
	if (!fileId) return null;

	deps.selectDoc(folderId, fileId);
	deps.setPersistedLayout({ openDocument: { folderId, fileId } });
	deps.saveToStorage();
	return { folderId, fileId };
}

export function performCloseDocumentPanel(
	openDocIndex: number,
	deps: DocumentActionDeps = defaultDeps
) {
	if (openDocIndex >= 0) {
		deps.closeDoc(openDocIndex);
	}
	deps.setPersistedLayout({});
	deps.saveToStorage();
}

export function clearDocumentLayout(deps: DocumentActionDeps = defaultDeps) {
	deps.setPersistedLayout({});
	deps.saveToStorage();
}

export function restoreOpenDocument(deps: DocumentActionDeps = defaultDeps): RestoreResult | null {
	const layout = deps.getPersistedLayout();
	const openDocument = layout.openDocument;
	if (!openDocument) return null;

	const folder = deps.getFolders().find((candidate) => candidate.id === openDocument.folderId);
	const file = folder?.files?.find((candidate) => candidate.id === openDocument.fileId);
	if (!file) {
		deps.setPersistedLayout({});
		return null;
	}

	deps.selectDoc(openDocument.folderId, openDocument.fileId);
	return openDocument;
}

export function performAddFolderDocumentToChat(
	folderId: string,
	fileId: string,
	deps: DocumentActionDeps = defaultDeps
): boolean {
	const folder = deps.getFolders().find((candidate) => candidate.id === folderId);
	const file = folder?.files?.find((candidate) => candidate.id === fileId);
	if (!file) return false;

	const activeChat = deps.getActiveChat();
	const tree = { rootId: activeChat.rootId, exchanges: activeChat.exchanges };
	deps.performAddDocToChat(tree, activeChat.activeExchangeId, file.content, file.name);
	return true;
}
