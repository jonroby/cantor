import * as domain from '@/domain';
import * as providers from '../providers/index';
import * as external from '@/external';
import * as state from '@/state';

interface RestoredDocument {
	folderId: string;
	fileId: string;
}

function restoreOpenDocument(): RestoredDocument | null {
	const openDocument = external.persistence.getPersistedLayout().openDocument;
	if (!openDocument) return null;

	const folder = state.documents.docState.folders.find((candidate) => candidate.id === openDocument.folderId);
	const file = folder?.files?.find((candidate) => candidate.id === openDocument.fileId);
	if (!file) {
		external.persistence.setPersistedLayout({});
		return null;
	}

	state.documents.selectDoc(openDocument.folderId, openDocument.fileId);
	return openDocument;
}

export function initialize() {
	let hadDuplicateRenames = false;

	try {
		external.persistence.loadFromStorage();
	} catch {
		hadDuplicateRenames = domain.constraints.enforceUniqueNames(
			state.chats.chatState.chats,
			state.documents.docState.folders
		);
	}

	const restoredDocument = restoreOpenDocument();
	void providers.initialize();

	return { restoredDocument, hadDuplicateRenames };
}

export function rememberOpenDocument(folderId: string, fileId: string) {
	external.persistence.setPersistedLayout({ openDocument: { folderId, fileId } });
	external.persistence.saveToStorage();
}

export function clearOpenDocument() {
	external.persistence.setPersistedLayout({});
	external.persistence.saveToStorage();
}

export function save() {
	external.persistence.saveToStorage();
}
