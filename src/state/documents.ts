export interface DocFile {
	id: string;
	name: string;
	content: string;
}

export interface ChatFolder {
	id: string;
	name: string;
	files?: DocFile[];
}

export interface OpenDoc {
	id: string;
	content: string;
	docKey: { folderId: string; fileId: string } | null;
}

const DEFAULT_DOC_CONTENT = `# Superset Svelte

Welcome to the documentation.

## Getting Started

This is a visual canvas for exploring branching chat conversations.

## Math Support

Inline math: $E = mc^2$

Display math:

$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$

## Features

- **Chats** — top-level chat conversations
- **Copies** — copy conversation into a new chat
- **Side Chats** — sibling branches off existing nodes`;

export const docState = $state({
	folders: [] as ChatFolder[],
	openDocs: [{ id: crypto.randomUUID(), content: DEFAULT_DOC_CONTENT, docKey: null }] as OpenDoc[]
});

export function newFolder(): string {
	const existingNames = docState.folders.map((f) => f.name);
	let name = 'New Folder';
	let i = 2;
	while (existingNames.includes(name)) {
		name = `New Folder ${i}`;
		i++;
	}
	const folder: ChatFolder = { id: crypto.randomUUID(), name };
	docState.folders = [...docState.folders, folder];
	return folder.id;
}

export function newDocInFolder(folderId: string): string | null {
	const folder = docState.folders.find((f) => f.id === folderId);
	if (!folder) return null;
	const existingNames = (folder.files ?? []).map((f) => f.name);
	let name = 'Untitled.md';
	let i = 2;
	while (existingNames.includes(name)) {
		name = `Untitled ${i}.md`;
		i++;
	}
	const docFile: DocFile = { id: crypto.randomUUID(), name, content: '' };
	folder.files = [...(folder.files ?? []), docFile];
	return docFile.id;
}

export function deleteFolder(folderId: string) {
	docState.folders = docState.folders.filter((f) => f.id !== folderId);
}

export function renameFolder(folderId: string, name: string): boolean {
	const conflict = docState.folders.some((f) => f.id !== folderId && f.name === name);
	if (conflict) return false;
	const folder = docState.folders.find((f) => f.id === folderId);
	if (folder) folder.name = name;
	return true;
}

export function selectDoc(folderId: string, fileId: string) {
	const folder = docState.folders.find((f) => f.id === folderId);
	const file = folder?.files?.find((f) => f.id === fileId);
	if (!file) return;
	const existing = docState.openDocs.find(
		(d) => d.docKey?.folderId === folderId && d.docKey?.fileId === fileId
	);
	if (existing) return;
	docState.openDocs = [
		...docState.openDocs,
		{ id: crypto.randomUUID(), content: file.content, docKey: { folderId, fileId } }
	];
}

export function renameDocInFolder(folderId: string, fileId: string, name: string): boolean {
	const folder = docState.folders.find((f) => f.id === folderId);
	if (folder?.files?.some((f) => f.id !== fileId && f.name === name)) return false;
	const file = folder?.files?.find((f) => f.id === fileId);
	if (file) file.name = name;
	return true;
}

export function deleteDocFromFolder(folderId: string, fileId: string) {
	const folder = docState.folders.find((f) => f.id === folderId);
	if (folder) folder.files = (folder.files ?? []).filter((d) => d.id !== fileId);
	docState.openDocs = docState.openDocs.filter(
		(d) => !(d.docKey?.folderId === folderId && d.docKey?.fileId === fileId)
	);
}

export function moveDocToFolder(fromFolderId: string, fileId: string, toFolderId: string): boolean {
	const fromFolder = docState.folders.find((f) => f.id === fromFolderId);
	const toFolder = docState.folders.find((f) => f.id === toFolderId);
	const file = fromFolder?.files?.find((f) => f.id === fileId);
	if (!file || !toFolder) return false;
	if (toFolder.files?.some((f) => f.name === file.name)) return false;
	fromFolder!.files = (fromFolder!.files ?? []).filter((d) => d.id !== fileId);
	toFolder.files = [...(toFolder.files ?? []), file];
	const openDoc = docState.openDocs.find(
		(d) => d.docKey?.folderId === fromFolderId && d.docKey?.fileId === fileId
	);
	if (openDoc?.docKey) openDoc.docKey = { folderId: toFolderId, fileId };
	return true;
}

export function updateDocContent(index: number, content: string) {
	const doc = docState.openDocs[index];
	if (!doc) return;
	doc.content = content;
	if (doc.docKey) {
		const { folderId, fileId } = doc.docKey;
		const file = docState.folders
			.find((f) => f.id === folderId)
			?.files?.find((f) => f.id === fileId);
		if (file) file.content = content;
	}
}

export function closeDoc(index: number) {
	docState.openDocs = docState.openDocs.filter((_, i) => i !== index);
}
