export interface DocumentFile {
	id: string;
	name: string;
	content: string;
}

export interface ChatFolder {
	id: string;
	name: string;
	files?: DocumentFile[];
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
	folders: [] as ChatFolder[],
	openDocuments: [
		{ id: crypto.randomUUID(), content: DEFAULT_DOCUMENT_CONTENT, documentKey: null }
	] as OpenDocument[]
});

export function newFolder(): string {
	const existingNames = documentState.folders.map((f) => f.name);
	let name = 'New Folder';
	let i = 2;
	while (existingNames.includes(name)) {
		name = `New Folder ${i}`;
		i++;
	}
	const folder: ChatFolder = { id: crypto.randomUUID(), name };
	documentState.folders = [...documentState.folders, folder];
	return folder.id;
}

export function createDocumentInFolder(folderId: string): string | null {
	const folder = documentState.folders.find((f) => f.id === folderId);
	if (!folder) return null;
	const existingNames = (folder.files ?? []).map((f) => f.name);
	let name = 'Untitled.md';
	let i = 2;
	while (existingNames.includes(name)) {
		name = `Untitled ${i}.md`;
		i++;
	}
	const documentFile: DocumentFile = { id: crypto.randomUUID(), name, content: '' };
	folder.files = [...(folder.files ?? []), documentFile];
	return documentFile.id;
}

export function deleteFolder(folderId: string) {
	documentState.folders = documentState.folders.filter((f) => f.id !== folderId);
}

export function renameFolder(folderId: string, name: string): boolean {
	const conflict = documentState.folders.some((f) => f.id !== folderId && f.name === name);
	if (conflict) return false;
	const folder = documentState.folders.find((f) => f.id === folderId);
	if (folder) folder.name = name;
	return true;
}

export function selectDocument(folderId: string, fileId: string) {
	const folder = documentState.folders.find((f) => f.id === folderId);
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
	const folder = documentState.folders.find((f) => f.id === folderId);
	if (folder?.files?.some((f) => f.id !== fileId && f.name === name)) return false;
	const file = folder?.files?.find((f) => f.id === fileId);
	if (file) file.name = name;
	return true;
}

export function deleteDocumentFromFolder(folderId: string, fileId: string) {
	const folder = documentState.folders.find((f) => f.id === folderId);
	if (folder) folder.files = (folder.files ?? []).filter((d) => d.id !== fileId);
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
	const fromFolder = documentState.folders.find((f) => f.id === fromFolderId);
	const toFolder = documentState.folders.find((f) => f.id === toFolderId);
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
	return true;
}

export function updateDocumentContent(index: number, content: string) {
	const openDocument = documentState.openDocuments[index];
	if (!openDocument) return;
	openDocument.content = content;
	if (openDocument.documentKey) {
		const { folderId, fileId } = openDocument.documentKey;
		const file = documentState.folders
			.find((f) => f.id === folderId)
			?.files?.find((f) => f.id === fileId);
		if (file) file.content = content;
	}
}

export function closeDocument(index: number) {
	documentState.openDocuments = documentState.openDocuments.filter((_, i) => i !== index);
}
