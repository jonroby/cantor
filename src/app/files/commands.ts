import JSZip from 'jszip';
import * as state from '@/state';
import * as lib from '@/lib';
import * as external from '@/external';

export interface FileCommandFeedback {
	success?: (message: string) => void;
	error?: (message: string) => void;
}

const NOOP_FEEDBACK: FileCommandFeedback = {};

export function downloadToFile() {
	const payload = JSON.stringify(
		{
			chats: state.chats.chatState.chats,
			activeChatIndex: state.chats.chatState.activeChatIndex,
			folders: state.documents.docState.folders
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
	const chat = state.chats.chatState.chats[index];
	const payload = JSON.stringify(chat, null, 2);
	const blob = new Blob([payload], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = `${chat.name.replace(/[^a-zA-Z0-9-_ ]/g, '')}.json`;
	link.click();
	URL.revokeObjectURL(url);
}

export function uploadChat(feedback: FileCommandFeedback = NOOP_FEEDBACK): void {
	const input = document.createElement('input');
	input.type = 'file';
	input.accept = '.json';
	input.onchange = async () => {
		const file = input.files?.[0];
		if (!file) return;
		try {
			const text = await file.text();
			const data = JSON.parse(text);
			const chat = external.files.validateChatUpload(data);
			chat.id = crypto.randomUUID();
			const baseName = file.name.replace(/\.json$/i, '');
			chat.name = external.files.deduplicateName(
				baseName,
				state.chats.chatState.chats.map((c) => c.name)
			);
			state.chats.chatState.chats = [...state.chats.chatState.chats, chat];
			state.chats.chatState.activeChatIndex = state.chats.chatState.chats.length - 1;
			feedback.success?.(`Imported "${chat.name}"`);
		} catch (e) {
			feedback.error?.(e instanceof Error ? e.message : 'Invalid chat file');
		}
	};
	input.click();
}

export function uploadDocToFolder(folderId: string, feedback: FileCommandFeedback = NOOP_FEEDBACK) {
	const input = document.createElement('input');
	input.type = 'file';
	input.accept = '.md';
	input.onchange = () => {
		const file = input.files?.[0];
		if (!file) return;
		const folder = state.documents.docState.folders.find((f) => f.id === folderId);
		if (!folder) {
			feedback.error?.('Folder not found');
			return;
		}
		const reader = new FileReader();
		reader.onload = () => {
			if (typeof reader.result === 'string') {
				const errors = lib.validateMd.validate(reader.result);
				if (errors.length > 0) {
					feedback.error?.(`Invalid markdown: ${errors.join('; ')}`);
					return;
				}
				const existingNames = (folder.files ?? []).map((f) => f.name);
				const name = external.files.deduplicateName(file.name, existingNames);
				const docFile: state.documents.DocFile = {
					id: crypto.randomUUID(),
					name,
					content: reader.result
				};
				state.documents.docState.folders = state.documents.docState.folders.map((f) =>
					f.id === folderId ? { ...f, files: [...(f.files ?? []), docFile] } : f
				);
				feedback.success?.(`Uploaded ${file.name}`);
			}
		};
		reader.readAsText(file);
	};
	input.click();
}

export async function downloadFolder(
	folderId: string,
	feedback: FileCommandFeedback = NOOP_FEEDBACK
) {
	const folder = state.documents.docState.folders.find((f) => f.id === folderId);
	if (!folder || !folder.files?.length) {
		feedback.error?.('Folder is empty');
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

function uploadDocsIntoFolder(
	folderId: string,
	mdFiles: File[],
	feedback: FileCommandFeedback = NOOP_FEEDBACK
) {
	const folder = state.documents.docState.folders.find((f) => f.id === folderId);
	if (!folder) {
		feedback.error?.('Folder not found');
		return;
	}

	let imported = 0;
	let processed = 0;
	const existingNames = (folder.files ?? []).map((f) => f.name);

	for (const file of mdFiles) {
		const reader = new FileReader();
		reader.onload = () => {
			if (typeof reader.result === 'string') {
				const errors = lib.validateMd.validate(reader.result);
				if (errors.length > 0) {
					feedback.error?.(`Skipped ${file.name}: ${errors.join('; ')}`);
				} else {
					const name = external.files.deduplicateName(file.name, existingNames);
					existingNames.push(name);
					const docFile: state.documents.DocFile = {
						id: crypto.randomUUID(),
						name,
						content: reader.result
					};
					state.documents.docState.folders = state.documents.docState.folders.map((f) =>
						f.id === folderId ? { ...f, files: [...(f.files ?? []), docFile] } : f
					);
					imported++;
				}

				processed++;
				if (processed === mdFiles.length && imported > 0) {
					feedback.success?.(`Uploaded ${imported} file${imported === 1 ? '' : 's'}`);
				}
			}
		};
		reader.readAsText(file);
	}
}

export function uploadFolder(feedback: FileCommandFeedback = NOOP_FEEDBACK) {
	const input = document.createElement('input');
	input.type = 'file';
	input.webkitdirectory = true;
	input.onchange = () => {
		const files = input.files;
		if (!files || files.length === 0) return;

		const mdFiles = Array.from(files).filter((f) => f.name.endsWith('.md'));
		if (mdFiles.length === 0) {
			feedback.error?.('No .md files found in the selected folder');
			return;
		}

		const dirName = mdFiles[0].webkitRelativePath?.split('/')[0] ?? 'Uploaded Folder';
		const folderName = external.files.deduplicateName(
			dirName,
			state.documents.docState.folders.map((f) => f.name)
		);

		const folderId = crypto.randomUUID();
		const newFolderObj: state.documents.ChatFolder = { id: folderId, name: folderName, files: [] };
		state.documents.docState.folders = [...state.documents.docState.folders, newFolderObj];

		uploadDocsIntoFolder(folderId, mdFiles, feedback);
	};
	input.click();
}

export function uploadFolderToFolder(
	folderId: string,
	feedback: FileCommandFeedback = NOOP_FEEDBACK
) {
	const input = document.createElement('input');
	input.type = 'file';
	input.webkitdirectory = true;
	input.onchange = () => {
		const files = input.files;
		if (!files || files.length === 0) return;

		const mdFiles = Array.from(files).filter((f) => f.name.endsWith('.md'));
		if (mdFiles.length === 0) {
			feedback.error?.('No .md files found in the selected folder');
			return;
		}

		uploadDocsIntoFolder(folderId, mdFiles, feedback);
	};
	input.click();
}
