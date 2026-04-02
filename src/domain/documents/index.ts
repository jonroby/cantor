export interface DocumentFile {
	id: string;
	name: string;
	content: string;
}

export interface Folder {
	id: string;
	name: string;
	files?: DocumentFile[];
	folders?: Folder[];
}

export interface OpenDocument {
	id: string;
	content: string;
	documentKey: { folderId: string; fileId: string } | null;
}

export function findFolder(folders: Folder[], folderId: string): Folder | undefined {
	for (const folder of folders) {
		if (folder.id === folderId) return folder;
		const sub = folder.folders?.find((f) => f.id === folderId);
		if (sub) return sub;
	}
	return undefined;
}

export function findFile(folder: Folder, fileId: string): DocumentFile | undefined {
	return folder.files?.find((f) => f.id === fileId);
}

export function resolveAsset(folder: Folder, name: string): string | null {
	const parts = name.split('/');
	if (parts.length === 2) {
		const sub = folder.folders?.find((f) => f.name === parts[0]);
		const file = sub?.files?.find((f) => f.name === parts[1]);
		return file?.content ?? null;
	}
	const file = folder.files?.find((f) => f.name === name);
	return file?.content ?? null;
}

export function findOpenDocumentIndex(
	openDocuments: OpenDocument[],
	folderId: string,
	fileId: string
): number {
	return openDocuments.findIndex(
		(d) => d.documentKey?.folderId === folderId && d.documentKey?.fileId === fileId
	);
}
