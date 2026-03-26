import JSZip from 'jszip';
import { toast } from 'svelte-sonner';
import type { ChatFolder, DocFile } from '@/lib/chat/tree';

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
- **Forks** — copy conversation into a new chat
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

export function deleteFolder(folderId: string) {
	docState.folders = docState.folders.filter((f) => f.id !== folderId);
}

export function renameFolder(folderId: string, name: string): boolean {
	const conflict = docState.folders.some((f) => f.id !== folderId && f.name === name);
	if (conflict) return false;
	docState.folders = docState.folders.map((f) => (f.id === folderId ? { ...f, name } : f));
	return true;
}

export function uploadDocToFolder(folderId: string) {
	const input = document.createElement('input');
	input.type = 'file';
	input.accept = '.md';
	input.onchange = () => {
		const file = input.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			if (typeof reader.result === 'string') {
				const folder = docState.folders.find((f) => f.id === folderId);
				const existingNames = (folder?.files ?? []).map((f) => f.name);
				let name = file.name;
				if (existingNames.includes(name)) {
					const ext = name.lastIndexOf('.') !== -1 ? name.slice(name.lastIndexOf('.')) : '';
					const base = ext ? name.slice(0, name.lastIndexOf('.')) : name;
					let i = 1;
					while (existingNames.includes(`${base} (${i})${ext}`)) i++;
					name = `${base} (${i})${ext}`;
				}
				const docFile: DocFile = {
					id: crypto.randomUUID(),
					name,
					content: reader.result as string
				};
				docState.folders = docState.folders.map((f) =>
					f.id === folderId ? { ...f, files: [...(f.files ?? []), docFile] } : f
				);
				toast.success(`Uploaded ${file.name}`);
			}
		};
		reader.readAsText(file);
	};
	input.click();
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
	docState.folders = docState.folders.map((f) =>
		f.id === folderId
			? { ...f, files: (f.files ?? []).map((d) => (d.id === fileId ? { ...d, name } : d)) }
			: f
	);
	return true;
}

export function deleteDocFromFolder(folderId: string, fileId: string) {
	docState.folders = docState.folders.map((f) =>
		f.id === folderId ? { ...f, files: (f.files ?? []).filter((d) => d.id !== fileId) } : f
	);
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
	docState.folders = docState.folders.map((f) => {
		if (f.id === fromFolderId)
			return { ...f, files: (f.files ?? []).filter((d) => d.id !== fileId) };
		if (f.id === toFolderId) return { ...f, files: [...(f.files ?? []), file] };
		return f;
	});
	docState.openDocs = docState.openDocs.map((d) =>
		d.docKey?.folderId === fromFolderId && d.docKey?.fileId === fileId
			? { ...d, docKey: { folderId: toFolderId, fileId } }
			: d
	);
	return true;
}

export async function downloadFolder(folderId: string) {
	const folder = docState.folders.find((f) => f.id === folderId);
	if (!folder || !folder.files?.length) {
		toast.error('Folder is empty');
		return;
	}
	const zip = new JSZip();
	for (const file of folder.files) {
		zip.file(file.name, file.content);
	}
	const blob = await zip.generateAsync({ type: 'blob' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `${folder.name}.zip`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	setTimeout(() => URL.revokeObjectURL(url), 100);
}

function uploadDocsIntoFolder(folderId: string, mdFiles: File[]) {
	let imported = 0;
	const folder = docState.folders.find((f) => f.id === folderId);
	const existingNames = (folder?.files ?? []).map((f) => f.name);

	for (const file of mdFiles) {
		const reader = new FileReader();
		reader.onload = () => {
			if (typeof reader.result === 'string') {
				let name = file.name;
				if (existingNames.includes(name)) {
					const ext = name.lastIndexOf('.') !== -1 ? name.slice(name.lastIndexOf('.')) : '';
					const base = ext ? name.slice(0, name.lastIndexOf('.')) : name;
					let i = 1;
					while (existingNames.includes(`${base} (${i})${ext}`)) i++;
					name = `${base} (${i})${ext}`;
				}
				existingNames.push(name);
				const docFile: DocFile = {
					id: crypto.randomUUID(),
					name,
					content: reader.result as string
				};
				docState.folders = docState.folders.map((f) =>
					f.id === folderId ? { ...f, files: [...(f.files ?? []), docFile] } : f
				);
				imported++;
				if (imported === mdFiles.length) {
					toast.success(`Uploaded ${imported} file${imported === 1 ? '' : 's'}`);
				}
			}
		};
		reader.readAsText(file);
	}
}

export function uploadFolder() {
	const input = document.createElement('input');
	input.type = 'file';
	input.webkitdirectory = true;
	input.onchange = () => {
		const files = input.files;
		if (!files || files.length === 0) return;

		const mdFiles = Array.from(files).filter((f) => f.name.endsWith('.md'));
		if (mdFiles.length === 0) {
			toast.error('No .md files found in the selected folder');
			return;
		}

		const dirName = mdFiles[0].webkitRelativePath?.split('/')[0] ?? 'Uploaded Folder';
		const existingFolderNames = docState.folders.map((f) => f.name);
		let folderName = dirName;
		let n = 2;
		while (existingFolderNames.includes(folderName)) {
			folderName = `${dirName} (${n})`;
			n++;
		}

		const folderId = crypto.randomUUID();
		const newFolderObj: ChatFolder = { id: folderId, name: folderName, files: [] };
		docState.folders = [...docState.folders, newFolderObj];

		uploadDocsIntoFolder(folderId, mdFiles);
	};
	input.click();
}

export function uploadFolderToFolder(folderId: string) {
	const input = document.createElement('input');
	input.type = 'file';
	input.webkitdirectory = true;
	input.onchange = () => {
		const files = input.files;
		if (!files || files.length === 0) return;

		const mdFiles = Array.from(files).filter((f) => f.name.endsWith('.md'));
		if (mdFiles.length === 0) {
			toast.error('No .md files found in the selected folder');
			return;
		}

		uploadDocsIntoFolder(folderId, mdFiles);
	};
	input.click();
}
