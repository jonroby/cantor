import * as providers from '@/app/providers';
import * as external from '@/external';
import * as state from '@/state';
import * as lib from '@/lib';

interface RestoredDocument {
	folderId: string;
	fileId: string;
}

function repairDuplicateNames() {
	let changed = false;

	const chatNames: string[] = [];
	for (const chat of state.chats.chatState.chats) {
		const uniqueName = lib.rename.renameWithDedup(chat.name, (candidate) => {
			if (chatNames.includes(candidate)) return false;
			chatNames.push(candidate);
			return true;
		});
		if (!uniqueName) continue;
		if (uniqueName !== chat.name) {
			chat.name = uniqueName;
			changed = true;
		}
	}

	const folderNames: string[] = [];
	for (const folder of state.documents.documentState.folders) {
		const uniqueName = lib.rename.renameWithDedup(folder.name, (candidate) => {
			if (folderNames.includes(candidate)) return false;
			folderNames.push(candidate);
			return true;
		});
		if (!uniqueName) continue;
		if (uniqueName !== folder.name) {
			folder.name = uniqueName;
			changed = true;
		}

		const fileNames: string[] = [];
		for (const file of folder.files ?? []) {
			const uniqueFileName = lib.rename.renameWithDedup(file.name, (candidate) => {
				if (fileNames.includes(candidate)) return false;
				fileNames.push(candidate);
				return true;
			});
			if (!uniqueFileName) continue;
			if (uniqueFileName !== file.name) {
				file.name = uniqueFileName;
				changed = true;
			}
		}
	}

	return changed;
}

function restoreOpenDocument(): RestoredDocument | null {
	const openDocument = external.persistence.getPersistedLayout().openDocument;
	if (!openDocument) return null;

	const folder = state.documents.documentState.folders.find(
		(candidate) => candidate.id === openDocument.folderId
	);
	const file = folder?.files?.find((candidate) => candidate.id === openDocument.fileId);
	if (!folder || !file) {
		external.persistence.setPersistedLayout({});
		return null;
	}

	state.documents.selectDocument(openDocument.folderId, openDocument.fileId);
	return openDocument;
}

export async function initialize() {
	let hadDuplicateRenames = false;

	try {
		const snapshot = await external.persistence.loadFromStorage();
		if (snapshot) {
			state.chats.hydrate(snapshot);
			state.documents.documentState.folders = snapshot.folders;
		}
	} catch (error) {
		const snapshot =
			error && typeof error === 'object' && 'snapshot' in error ? error.snapshot : null;
		if (snapshot && typeof snapshot === 'object') {
			state.chats.hydrate(
				snapshot as { chats: typeof state.chats.chatState.chats; activeChatIndex: number }
			);
			state.documents.documentState.folders = (
				snapshot as { folders: typeof state.documents.documentState.folders }
			).folders;
		}
		hadDuplicateRenames = repairDuplicateNames();
	}

	const restoredDocument = restoreOpenDocument();
	const layout = external.persistence.getPersistedLayout();
	void providers.initialize();

	return {
		restoredDocument,
		chatPanelOpen: layout.chatPanelOpen,
		sidebarOpen: layout.sidebarOpen,
		hadDuplicateRenames
	};
}

export function rememberOpenDocument(folderId: string, fileId: string) {
	const layout = external.persistence.getPersistedLayout();
	external.persistence.setPersistedLayout({ ...layout, openDocument: { folderId, fileId } });
	void save();
}

export function clearOpenDocument() {
	const layout = external.persistence.getPersistedLayout();
	external.persistence.setPersistedLayout({ ...layout, openDocument: undefined });
	void save();
}

export function setChatPanelOpen(open: boolean) {
	const layout = external.persistence.getPersistedLayout();
	external.persistence.setPersistedLayout({ ...layout, chatPanelOpen: open });
	void save();
}

export function setSidebarOpen(open: boolean) {
	const layout = external.persistence.getPersistedLayout();
	external.persistence.setPersistedLayout({ ...layout, sidebarOpen: open });
	void save();
}

export function save() {
	return external.persistence.saveToStorage({
		chats: state.chats.chatState.chats,
		activeChatIndex: state.chats.chatState.activeChatIndex,
		folders: state.documents.documentState.folders
	});
}
