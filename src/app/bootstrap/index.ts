import * as providers from '../providers/index';
import * as external from '@/external';
import * as state from '@/state';

interface RestoredDocument {
	folderId: string;
	fileId: string;
}

function nextUniqueName(name: string, existing: string[]): string {
	if (!existing.includes(name)) return name;
	let i = 2;
	while (existing.includes(`${name} (${i})`)) i++;
	return `${name} (${i})`;
}

function repairDuplicateNames() {
	let changed = false;

	const chatNames: string[] = [];
	for (const chat of state.chats.chatState.chats) {
		const uniqueName = nextUniqueName(chat.name, chatNames);
		if (uniqueName !== chat.name) {
			chat.name = uniqueName;
			changed = true;
		}
		chatNames.push(uniqueName);
	}

	const folderNames: string[] = [];
	for (const folder of state.documents.documentState.folders) {
		const uniqueName = nextUniqueName(folder.name, folderNames);
		if (uniqueName !== folder.name) {
			folder.name = uniqueName;
			changed = true;
		}
		folderNames.push(uniqueName);

		const fileNames: string[] = [];
		for (const file of folder.files ?? []) {
			const uniqueFileName = nextUniqueName(file.name, fileNames);
			if (uniqueFileName !== file.name) {
				file.name = uniqueFileName;
				changed = true;
			}
			fileNames.push(uniqueFileName);
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
	if (!file) {
		external.persistence.setPersistedLayout({});
		return null;
	}

	state.documents.selectDocument(openDocument.folderId, openDocument.fileId);
	return openDocument;
}

export function initialize() {
	let hadDuplicateRenames = false;

	try {
		external.persistence.loadFromStorage();
	} catch {
		hadDuplicateRenames = repairDuplicateNames();
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
