import * as state from '@/state';
import * as external from '@/external';
import { addDocToChat } from '@/app/chat/commands';

interface RestoreResult {
	folderId: string;
	fileId: string;
}

export interface DocumentCommandDeps {
	getActiveChat: typeof state.chats.getActiveChat;
	getFolders: () => state.documents.ChatFolder[];
	newDocInFolder: typeof state.documents.newDocInFolder;
	selectDoc: typeof state.documents.selectDoc;
	closeDoc: typeof state.documents.closeDoc;
	getPersistedLayout: typeof external.persistence.getPersistedLayout;
	setPersistedLayout: typeof external.persistence.setPersistedLayout;
	saveToStorage: typeof external.persistence.saveToStorage;
	addDocToChat: typeof addDocToChat;
}

const defaultDeps: DocumentCommandDeps = {
	getActiveChat: state.chats.getActiveChat,
	getFolders: () => state.documents.docState.folders,
	newDocInFolder: state.documents.newDocInFolder,
	selectDoc: state.documents.selectDoc,
	closeDoc: state.documents.closeDoc,
	getPersistedLayout: external.persistence.getPersistedLayout,
	setPersistedLayout: external.persistence.setPersistedLayout,
	saveToStorage: external.persistence.saveToStorage,
	addDocToChat
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
	deps.setPersistedLayout({ openDocument: { folderId, fileId } });
	deps.saveToStorage();
	return true;
}

export function createDocument(
	folderId: string,
	deps: DocumentCommandDeps = defaultDeps
): RestoreResult | null {
	const fileId = deps.newDocInFolder(folderId);
	if (!fileId) return null;

	deps.selectDoc(folderId, fileId);
	deps.setPersistedLayout({ openDocument: { folderId, fileId } });
	deps.saveToStorage();
	return { folderId, fileId };
}

export function closeDocumentPanel(openDocIndex: number, deps: DocumentCommandDeps = defaultDeps) {
	if (openDocIndex >= 0) {
		deps.closeDoc(openDocIndex);
	}
	deps.setPersistedLayout({});
	deps.saveToStorage();
}

export function clearDocumentLayout(deps: DocumentCommandDeps = defaultDeps) {
	deps.setPersistedLayout({});
	deps.saveToStorage();
}

export function restoreOpenDocument(deps: DocumentCommandDeps = defaultDeps): RestoreResult | null {
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

export function addFolderDocumentToChat(
	folderId: string,
	fileId: string,
	deps: DocumentCommandDeps = defaultDeps
): boolean {
	const folder = deps.getFolders().find((candidate) => candidate.id === folderId);
	const file = folder?.files?.find((candidate) => candidate.id === fileId);
	if (!file) return false;

	const activeChat = deps.getActiveChat();
	const tree = { rootId: activeChat.rootId, exchanges: activeChat.exchanges };
	deps.addDocToChat(tree, activeChat.activeExchangeId, file.content, file.name);
	return true;
}
