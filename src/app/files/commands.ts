import JSZip from 'jszip';
import { toast } from 'svelte-sonner';
import { chatState, docState, type ChatFolder, type DocFile } from '@/state';
import { validate } from '@/lib/validate-md';
import { validateChatUpload, deduplicateName } from '@/external/files/io';

export function downloadToFile() {
	const payload = JSON.stringify(
		{
			chats: chatState.chats,
			activeChatIndex: chatState.activeChatIndex,
			folders: docState.folders
		},
		null,
		2
	);
	const blob = new Blob([payload], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = `chat-tree-${Date.now()}.json`;
	link.click();
	URL.revokeObjectURL(url);
}

export function downloadChat(index: number) {
	const chat = chatState.chats[index];
	const payload = JSON.stringify(chat, null, 2);
	const blob = new Blob([payload], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = `${chat.name.replace(/[^a-zA-Z0-9-_ ]/g, '')}.json`;
	link.click();
	URL.revokeObjectURL(url);
}

export function uploadChat(): void {
	const input = document.createElement('input');
	input.type = 'file';
	input.accept = '.json';
	input.onchange = async () => {
		const file = input.files?.[0];
		if (!file) return;
		try {
			const text = await file.text();
			const data = JSON.parse(text);
			const chat = validateChatUpload(data);
			chat.id = crypto.randomUUID();
			const baseName = file.name.replace(/\.json$/i, '');
			chat.name = deduplicateName(
				baseName,
				chatState.chats.map((c) => c.name)
			);
			chatState.chats = [...chatState.chats, chat];
			chatState.activeChatIndex = chatState.chats.length - 1;
			toast.success(`Imported "${chat.name}"`);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Invalid chat file');
		}
	};
	input.click();
}

export function uploadDocToFolder(folderId: string) {
	const input = document.createElement('input');
	input.type = 'file';
	input.accept = '.md';
	input.onchange = () => {
		const file = input.files?.[0];
		if (!file) return;
		const folder = docState.folders.find((f) => f.id === folderId);
		if (!folder) {
			toast.error('Folder not found');
			return;
		}
		const reader = new FileReader();
		reader.onload = () => {
			if (typeof reader.result === 'string') {
				const errors = validate(reader.result);
				if (errors.length > 0) {
					toast.error(`Invalid markdown: ${errors.join('; ')}`);
					return;
				}
				const existingNames = (folder.files ?? []).map((f) => f.name);
				const name = deduplicateName(file.name, existingNames);
				const docFile: DocFile = {
					id: crypto.randomUUID(),
					name,
					content: reader.result
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
	const folder = docState.folders.find((f) => f.id === folderId);
	if (!folder) {
		toast.error('Folder not found');
		return;
	}

	let imported = 0;
	let processed = 0;
	const existingNames = (folder.files ?? []).map((f) => f.name);

	for (const file of mdFiles) {
		const reader = new FileReader();
		reader.onload = () => {
			if (typeof reader.result === 'string') {
				const errors = validate(reader.result);
				if (errors.length > 0) {
					toast.error(`Skipped ${file.name}: ${errors.join('; ')}`);
				} else {
					const name = deduplicateName(file.name, existingNames);
					existingNames.push(name);
					const docFile: DocFile = {
						id: crypto.randomUUID(),
						name,
						content: reader.result
					};
					docState.folders = docState.folders.map((f) =>
						f.id === folderId ? { ...f, files: [...(f.files ?? []), docFile] } : f
					);
					imported++;
				}

				processed++;
				if (processed === mdFiles.length && imported > 0) {
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
		const folderName = deduplicateName(
			dirName,
			docState.folders.map((f) => f.name)
		);

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
