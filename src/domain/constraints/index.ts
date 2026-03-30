export interface NamedItem {
	name: string;
}

export type NamedFile = NamedItem;

export interface NamedFolder extends NamedItem {
	files?: NamedFile[];
}

export function isUniqueName(name: string, existing: string[]): boolean {
	return !existing.includes(name);
}

export function hasDuplicateNames(chats: NamedItem[], folders: NamedFolder[]): boolean {
	const chatNames: string[] = [];
	for (const chat of chats) {
		if (!isUniqueName(chat.name, chatNames)) return true;
		chatNames.push(chat.name);
	}

	const folderNames: string[] = [];
	for (const folder of folders) {
		if (!isUniqueName(folder.name, folderNames)) return true;
		folderNames.push(folder.name);

		const fileNames: string[] = [];
		for (const file of folder.files ?? []) {
			if (!isUniqueName(file.name, fileNames)) return true;
			fileNames.push(file.name);
		}
	}

	return false;
}
