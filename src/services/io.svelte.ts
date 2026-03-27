import JSZip from 'jszip';
import { toast } from 'svelte-sonner';
import { chatState } from '@/state/chats.svelte';
import { docState } from '@/state/documents.svelte';
import { validateChatTree, getMainChatTail, type Chat, type ExchangeMap } from '@/domain/tree';
import { type ChatFolder, type DocFile } from '@/state/documents.svelte';
import { validate } from '@/lib/validate-md';

function findRootId(exchanges: ExchangeMap): string | null {
	for (const exchange of Object.values(exchanges)) {
		if (exchange.parentId === null) return exchange.id;
	}
	return null;
}

function validateChatUpload(data: unknown): Chat {
	if (typeof data !== 'object' || data === null || Array.isArray(data)) {
		throw new Error('Upload must be a JSON object.');
	}

	const obj = data as Record<string, unknown>;

	if (typeof obj.id !== 'string' || !obj.id) {
		throw new Error('Chat is missing a valid "id".');
	}
	if (typeof obj.name !== 'string' || !obj.name) {
		throw new Error('Chat is missing a valid "name".');
	}

	// Support new format (exchanges) and legacy format (roots[])
	let exchanges: ExchangeMap;
	if (obj.exchanges && typeof obj.exchanges === 'object' && !Array.isArray(obj.exchanges)) {
		exchanges = obj.exchanges as ExchangeMap;
	} else if (Array.isArray(obj.roots) && obj.roots.length > 0) {
		const rootIndex = typeof obj.activeRootIndex === 'number' ? obj.activeRootIndex : 0;
		exchanges = obj.roots[rootIndex] as ExchangeMap;
	} else {
		throw new Error('Chat must have an "exchanges" map.');
	}

	if (Object.keys(exchanges).length === 0) {
		throw new Error('Exchanges map is empty.');
	}
	for (const [id, exchange] of Object.entries(exchanges)) {
		if (typeof exchange !== 'object' || exchange === null) {
			throw new Error(`Exchange "${id}" is not a valid object.`);
		}
		if (typeof exchange.id !== 'string') {
			throw new Error(`Exchange is missing an "id".`);
		}
		if (typeof exchange.prompt !== 'object' && typeof exchange.prompt !== 'string') {
			throw new Error(`Exchange "${id}" is missing a "prompt".`);
		}
	}

	const rootId = findRootId(exchanges);
	const tree = { rootId, exchanges };
	try {
		validateChatTree(tree);
	} catch (e) {
		throw new Error(e instanceof Error ? e.message : String(e));
	}

	return {
		id: obj.id as string,
		name: obj.name as string,
		rootId,
		exchanges,
		activeExchangeId:
			typeof obj.activeExchangeId === 'string' ? obj.activeExchangeId : getMainChatTail(tree)
	};
}

// --- Full app export ---

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

// --- Single-chat import/export ---

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
			const existingNames = chatState.chats.map((c) => c.name);
			let name = baseName;
			let i = 1;
			while (existingNames.includes(name)) {
				name = `${baseName} (${i})`;
				i++;
			}
			chat.name = name;
			chatState.chats = [...chatState.chats, chat];
			chatState.activeChatIndex = chatState.chats.length - 1;
			toast.success(`Imported "${chat.name}"`);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Invalid chat file');
		}
	};
	input.click();
}

// --- Document file I/O ---

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
				const errors = validate(reader.result);
				if (errors.length > 0) {
					toast.error(`Invalid markdown: ${errors.join('; ')}`);
					return;
				}
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
				const errors = validate(reader.result);
				if (errors.length > 0) {
					toast.error(`Skipped ${file.name}: ${errors.join('; ')}`);
					return;
				}
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
