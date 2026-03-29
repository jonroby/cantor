import * as documents from '../documents/index';
import * as providers from '../providers/index';
import * as external from '@/external';
import * as state from '@/state';

function deduplicate(name: string, existing: string[]): string {
	if (!existing.includes(name)) return name;
	let i = 2;
	while (existing.includes(`${name} (${i})`)) i++;
	return `${name} (${i})`;
}

function fixDuplicateNames() {
	let changed = false;

	const chatNames: string[] = [];
	for (const chat of state.chats.chatState.chats) {
		const deduped = deduplicate(chat.name, chatNames);
		if (deduped !== chat.name) {
			chat.name = deduped;
			changed = true;
		}
		chatNames.push(deduped);
	}

	const folderNames: string[] = [];
	for (const folder of state.documents.docState.folders) {
		const deduped = deduplicate(folder.name, folderNames);
		if (deduped !== folder.name) {
			folder.name = deduped;
			changed = true;
		}
		folderNames.push(deduped);

		const fileNames: string[] = [];
		for (const file of folder.files ?? []) {
			const dedupedFile = deduplicate(file.name, fileNames);
			if (dedupedFile !== file.name) {
				file.name = dedupedFile;
				changed = true;
			}
			fileNames.push(dedupedFile);
		}
	}

	return changed;
}

export function initialize() {
	let hadDuplicateRenames = false;

	try {
		external.persistence.loadFromStorage();
	} catch {
		hadDuplicateRenames = fixDuplicateNames();
	}

	const restoredDocument = documents.restoreOpenDocument();
	providers.initProviders();
	providers.autoConnectOllama();

	return { restoredDocument, hadDuplicateRenames };
}

export function save() {
	external.persistence.saveToStorage();
}
