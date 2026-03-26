import { toast } from 'svelte-sonner';
import type { ChatFolder, DocFile } from '$lib/chat/tree';

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

- **Sessions** — top-level chat sessions
- **Forks** — copy conversation into a new root
- **Side Chats** — sibling branches off existing nodes`;

export function createDocumentState() {
	let folders: ChatFolder[] = $state([]);
	let openDocs: OpenDoc[] = $state([
		{ id: crypto.randomUUID(), content: DEFAULT_DOC_CONTENT, docKey: null }
	]);

	function newFolder(): string {
		const existingNames = folders.map((f) => f.name);
		let name = 'New Folder';
		let i = 2;
		while (existingNames.includes(name)) {
			name = `New Folder ${i}`;
			i++;
		}
		const folder: ChatFolder = { id: crypto.randomUUID(), name };
		folders = [...folders, folder];
		return folder.id;
	}

	function deleteFolder(folderId: string, sessions: { folderId?: string | null }[]) {
		// Returns updated sessions with folder unassigned
		folders = folders.filter((f) => f.id !== folderId);
		return sessions.map((s) => (s.folderId === folderId ? { ...s, folderId: null } : s));
	}

	function renameFolder(folderId: string, name: string): boolean {
		const conflict = folders.some((f) => f.id !== folderId && f.name === name);
		if (conflict) return false;
		folders = folders.map((f) => (f.id === folderId ? { ...f, name } : f));
		return true;
	}

	function uploadDocToFolder(folderId: string) {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.md';
		input.onchange = () => {
			const file = input.files?.[0];
			if (!file) return;
			const reader = new FileReader();
			reader.onload = () => {
				if (typeof reader.result === 'string') {
					const folder = folders.find((f) => f.id === folderId);
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
					folders = folders.map((f) =>
						f.id === folderId ? { ...f, files: [...(f.files ?? []), docFile] } : f
					);
					toast.success(`Uploaded ${file.name}`);
				}
			};
			reader.readAsText(file);
		};
		input.click();
	}

	function selectDoc(folderId: string, fileId: string) {
		const folder = folders.find((f) => f.id === folderId);
		const file = folder?.files?.find((f) => f.id === fileId);
		if (!file) return;
		const existing = openDocs.find(
			(d) => d.docKey?.folderId === folderId && d.docKey?.fileId === fileId
		);
		if (existing) return;
		openDocs = [
			...openDocs,
			{ id: crypto.randomUUID(), content: file.content, docKey: { folderId, fileId } }
		];
	}

	function renameDocInFolder(folderId: string, fileId: string, name: string): boolean {
		const folder = folders.find((f) => f.id === folderId);
		if (folder?.files?.some((f) => f.id !== fileId && f.name === name)) return false;
		folders = folders.map((f) =>
			f.id === folderId
				? { ...f, files: (f.files ?? []).map((d) => (d.id === fileId ? { ...d, name } : d)) }
				: f
		);
		return true;
	}

	function deleteDocFromFolder(folderId: string, fileId: string) {
		folders = folders.map((f) =>
			f.id === folderId ? { ...f, files: (f.files ?? []).filter((d) => d.id !== fileId) } : f
		);
		openDocs = openDocs.filter(
			(d) => !(d.docKey?.folderId === folderId && d.docKey?.fileId === fileId)
		);
	}

	function moveDocToFolder(fromFolderId: string, fileId: string, toFolderId: string): boolean {
		const fromFolder = folders.find((f) => f.id === fromFolderId);
		const toFolder = folders.find((f) => f.id === toFolderId);
		const file = fromFolder?.files?.find((f) => f.id === fileId);
		if (!file || !toFolder) return false;
		if (toFolder.files?.some((f) => f.name === file.name)) return false;
		folders = folders.map((f) => {
			if (f.id === fromFolderId)
				return { ...f, files: (f.files ?? []).filter((d) => d.id !== fileId) };
			if (f.id === toFolderId) return { ...f, files: [...(f.files ?? []), file] };
			return f;
		});
		openDocs = openDocs.map((d) =>
			d.docKey?.folderId === fromFolderId && d.docKey?.fileId === fileId
				? { ...d, docKey: { folderId: toFolderId, fileId } }
				: d
		);
		return true;
	}

	return {
		get folders() {
			return folders;
		},
		set folders(v: ChatFolder[]) {
			folders = v;
		},
		get openDocs() {
			return openDocs;
		},
		set openDocs(v: OpenDoc[]) {
			openDocs = v;
		},
		newFolder,
		deleteFolder,
		renameFolder,
		uploadDocToFolder,
		selectDoc,
		renameDocInFolder,
		deleteDocFromFolder,
		moveDocToFolder
	};
}
