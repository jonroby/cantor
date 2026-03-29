import * as state from '@/state';
import * as external from '@/external';
import { performAddDocToChat } from './chat-actions';
export { getFolderFile } from '@/app/documents/queries';

interface RestoreResult {
	folderId: string;
	fileId: string;
}

export interface DocumentActionDeps {
	getActiveChat: typeof state.getActiveChat;
	getFolders: () => state.ChatFolder[];
	newDocInFolder: typeof state.newDocInFolder;
	selectDoc: typeof state.selectDoc;
	closeDoc: typeof state.closeDoc;
	getPersistedLayout: typeof external.getPersistedLayout;
	setPersistedLayout: typeof external.setPersistedLayout;
	saveToStorage: typeof external.saveToStorage;
	performAddDocToChat: typeof performAddDocToChat;
}

const defaultDeps: DocumentActionDeps = {
	getActiveChat: state.getActiveChat,
	getFolders: () => state.documents.docState.folders,
	newDocInFolder: state.newDocInFolder,
	selectDoc: state.selectDoc,
	closeDoc: state.closeDoc,
	getPersistedLayout: external.getPersistedLayout,
	setPersistedLayout: external.setPersistedLayout,
	saveToStorage: external.saveToStorage,
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
