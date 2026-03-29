export interface NamedItem {
	name: string;
}

export interface NamedFile extends NamedItem {}

export interface NamedFolder extends NamedItem {
	files?: NamedFile[];
}

export function enforceUniqueName(name: string, existing: string[]): string {
	if (!existing.includes(name)) return name;
	let i = 2;
	while (existing.includes(`${name} (${i})`)) i++;
	return `${name} (${i})`;
}

export function enforceUniqueNames(chats: NamedItem[], folders: NamedFolder[]): boolean {
	let changed = false;

	const chatNames: string[] = [];
	for (const chat of chats) {
		const uniqueName = enforceUniqueName(chat.name, chatNames);
		if (uniqueName !== chat.name) {
			chat.name = uniqueName;
			changed = true;
		}
		chatNames.push(uniqueName);
	}

	const folderNames: string[] = [];
	for (const folder of folders) {
		const uniqueName = enforceUniqueName(folder.name, folderNames);
		if (uniqueName !== folder.name) {
			folder.name = uniqueName;
			changed = true;
		}
		folderNames.push(uniqueName);

		const fileNames: string[] = [];
		for (const file of folder.files ?? []) {
			const uniqueFileName = enforceUniqueName(file.name, fileNames);
			if (uniqueFileName !== file.name) {
				file.name = uniqueFileName;
				changed = true;
			}
			fileNames.push(uniqueFileName);
		}
	}

	return changed;
}
