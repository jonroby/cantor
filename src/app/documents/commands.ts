import { getActiveChat } from '@/state';
import { docState, newDocInFolder, selectDoc, closeDoc, type ChatFolder } from '@/state';
import { getPersistedLayout, saveToStorage, setPersistedLayout } from '@/external';
import { addDocToChat } from '@/app/chat/commands';

interface RestoreResult {
	folderId: string;
	fileId: string;
}

export interface DocumentCommandDeps {
	getActiveChat: typeof getActiveChat;
	getFolders: () => ChatFolder[];
	newDocInFolder: typeof newDocInFolder;
	selectDoc: typeof selectDoc;
	closeDoc: typeof closeDoc;
	getPersistedLayout: typeof getPersistedLayout;
	setPersistedLayout: typeof setPersistedLayout;
	saveToStorage: typeof saveToStorage;
	addDocToChat: typeof addDocToChat;
}

const defaultDeps: DocumentCommandDeps = {
	getActiveChat,
	getFolders: () => docState.folders,
	newDocInFolder,
	selectDoc,
	closeDoc,
	getPersistedLayout,
	setPersistedLayout,
	saveToStorage,
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
