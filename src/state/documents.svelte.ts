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

const DEFAULT_DOCUMENT_CONTENT = `# Cantor

Welcome to the documentation.

## Getting Started

This is a visual canvas for exploring side-chat conversations.

## Math Support

Inline math: $E = mc^2$

Display math:

$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$

## Features

- **Chats** — top-level chat conversations
- **Copies** — copy conversation into a new chat
- **Side Chats** — sibling chats off existing nodes`;

export const documentState = $state({
	folders: [] as Folder[],
	openDocuments: [
		{ id: crypto.randomUUID(), content: DEFAULT_DOCUMENT_CONTENT, documentKey: null }
	] as OpenDocument[]
});

function notifyFoldersChanged() {
	documentState.folders = [...documentState.folders];
}

export function findFolder(folderId: string): Folder | undefined {
	for (const folder of documentState.folders) {
		if (folder.id === folderId) return folder;
		const sub = folder.folders?.find((f) => f.id === folderId);
		if (sub) return sub;
	}
	return undefined;
}

function findParent(folderId: string): Folder | undefined {
	for (const folder of documentState.folders) {
		if (folder.folders?.some((f) => f.id === folderId)) return folder;
	}
	return undefined;
}

function siblings(folderId: string): Folder[] {
	const parent = findParent(folderId);
	if (parent) return parent.folders ?? [];
	return documentState.folders;
}

export function newFolder(parentId?: string): string {
	const container = parentId ? findFolder(parentId) : undefined;
	const list = container ? (container.folders ?? []) : documentState.folders;
	const existingNames = list.map((f) => f.name);
	let name = 'New Folder';
	let i = 2;
	while (existingNames.includes(name)) {
		name = `New Folder ${i}`;
		i++;
	}
	const folder: Folder = { id: crypto.randomUUID(), name };
	if (container) {
		container.folders = [...(container.folders ?? []), folder];
		notifyFoldersChanged();
	} else {
		documentState.folders = [...documentState.folders, folder];
	}
	return folder.id;
}

export function createDocumentInFolder(folderId: string, name?: string): string | null {
	const folder = findFolder(folderId);
	if (!folder) return null;
	const existingNames = (folder.files ?? []).map((f) => f.name);
	let fileName = name ?? 'Untitled.md';
	if (existingNames.includes(fileName)) {
		const ext = fileName.lastIndexOf('.') !== -1 ? fileName.slice(fileName.lastIndexOf('.')) : '';
		const base = ext ? fileName.slice(0, fileName.lastIndexOf('.')) : fileName;
		let i = 2;
		while (existingNames.includes(`${base} ${i}${ext}`)) {
			i++;
		}
		fileName = `${base} ${i}${ext}`;
	}
	const documentFile: DocumentFile = { id: crypto.randomUUID(), name: fileName, content: '' };
	folder.files = [...(folder.files ?? []), documentFile];
	notifyFoldersChanged();
	return documentFile.id;
}

export function deleteFolder(folderId: string) {
	const parent = findParent(folderId);
	if (parent) {
		parent.folders = (parent.folders ?? []).filter((f) => f.id !== folderId);
		notifyFoldersChanged();
	} else {
		documentState.folders = documentState.folders.filter((f) => f.id !== folderId);
	}
}

export function renameFolder(folderId: string, name: string): boolean {
	const sibs = siblings(folderId);
	if (sibs.some((f) => f.id !== folderId && f.name === name)) return false;
	const folder = findFolder(folderId);
	if (folder) folder.name = name;
	notifyFoldersChanged();
	return true;
}

export function selectDocument(folderId: string, fileId: string) {
	const folder = findFolder(folderId);
	const file = folder?.files?.find((f) => f.id === fileId);
	if (!file) return;
	const existing = documentState.openDocuments.find(
		(document) =>
			document.documentKey?.folderId === folderId && document.documentKey?.fileId === fileId
	);
	if (existing) return;
	documentState.openDocuments = [
		...documentState.openDocuments,
		{ id: crypto.randomUUID(), content: file.content, documentKey: { folderId, fileId } }
	];
}

export function renameDocumentInFolder(folderId: string, fileId: string, name: string): boolean {
	const folder = findFolder(folderId);
	if (folder?.files?.some((f) => f.id !== fileId && f.name === name)) return false;
	const file = folder?.files?.find((f) => f.id === fileId);
	if (file) file.name = name;
	notifyFoldersChanged();
	return true;
}

export function deleteDocumentFromFolder(folderId: string, fileId: string) {
	const folder = findFolder(folderId);
	if (folder) folder.files = (folder.files ?? []).filter((d) => d.id !== fileId);
	notifyFoldersChanged();
	documentState.openDocuments = documentState.openDocuments.filter(
		(document) =>
			!(document.documentKey?.folderId === folderId && document.documentKey?.fileId === fileId)
	);
}

export function moveDocumentToFolder(
	fromFolderId: string,
	fileId: string,
	toFolderId: string
): boolean {
	const fromFolder = findFolder(fromFolderId);
	const toFolder = findFolder(toFolderId);
	const file = fromFolder?.files?.find((f) => f.id === fileId);
	if (!file || !toFolder) return false;
	if (toFolder.files?.some((f) => f.name === file.name)) return false;
	fromFolder!.files = (fromFolder!.files ?? []).filter((d) => d.id !== fileId);
	toFolder.files = [...(toFolder.files ?? []), file];
	const openDocument = documentState.openDocuments.find(
		(document) =>
			document.documentKey?.folderId === fromFolderId && document.documentKey?.fileId === fileId
	);
	if (openDocument?.documentKey) openDocument.documentKey = { folderId: toFolderId, fileId };
	notifyFoldersChanged();
	return true;
}

export function updateDocumentContent(index: number, content: string) {
	const openDocument = documentState.openDocuments[index];
	if (!openDocument) return;
	openDocument.content = content;
	if (openDocument.documentKey) {
		const { folderId, fileId } = openDocument.documentKey;
		const file = findFolder(folderId)?.files?.find((f) => f.id === fileId);
		if (file) file.content = content;
	}
}

export function closeDocument(index: number) {
	documentState.openDocuments = documentState.openDocuments.filter((_, i) => i !== index);
}
