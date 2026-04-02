import * as domain from '@/domain';

const STORAGE_KEY = 'chat-tree-store-svelte';
const VAULT_KEY = 'byok_vault_v2';
const LEGACY_VAULT_KEY = 'byok_vault';

// --- Invariant checks ---

interface PersistedChat {
	id: string;
	name: string;
	rootId: string | null;
	exchanges: domain.tree.ExchangeMap;
	activeExchangeId: string | null;
}

interface PersistedDocumentFile {
	id: string;
	name: string;
	content: string;
}

interface PersistedFolder {
	id: string;
	name: string;
	files?: PersistedDocumentFile[];
}

interface PersistedSnapshot {
	chats: PersistedChat[];
	activeChatIndex: number;
	folders: PersistedFolder[];
}

function assertValidNames(chats: PersistedChat[], folders: PersistedFolder[]) {
	if (!domain.constraints.hasDuplicateNames(chats, folders)) return;

	const chatNames: string[] = [];
	for (const chat of chats) {
		if (chatNames.includes(chat.name)) throw new Error(`Duplicate chat name "${chat.name}"`);
		chatNames.push(chat.name);
	}

	const folderNames: string[] = [];
	for (const folder of folders) {
		if (folderNames.includes(folder.name))
			throw new Error(`Duplicate folder name "${folder.name}"`);
		folderNames.push(folder.name);

		const fileNames: string[] = [];
		for (const file of folder.files ?? []) {
			if (fileNames.includes(file.name))
				throw new Error(`Duplicate file name "${file.name}" in folder "${folder.name}"`);
			fileNames.push(file.name);
		}
	}
}

// --- Chat & folder storage ---

export interface PersistedLayout {
	openDocument?: { folderId: string; fileId: string };
	chatPanelOpen?: boolean;
	sidebarOpen?: boolean;
}

let _layout: PersistedLayout = {};

export function getPersistedLayout(): PersistedLayout {
	return _layout;
}

export function setPersistedLayout(layout: PersistedLayout) {
	_layout = layout;
}

export function loadFromStorage(): PersistedSnapshot | null {
	const raw = localStorage.getItem(STORAGE_KEY);
	if (!raw) return null;
	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	if (parsed.layout) {
		_layout = parsed.layout;
	} else {
		_layout = {};
	}

	const snapshot = {
		chats: Array.isArray(parsed.chats) ? (parsed.chats as PersistedChat[]) : [],
		activeChatIndex: typeof parsed.activeChatIndex === 'number' ? parsed.activeChatIndex : 0,
		folders: Array.isArray(parsed.folders) ? (parsed.folders as PersistedFolder[]) : []
	};

	try {
		assertValidNames(snapshot.chats, snapshot.folders);
	} catch (error) {
		const persistenceError =
			error instanceof Error
				? error
				: new Error(typeof error === 'string' ? error : 'Invalid storage');
		Object.assign(persistenceError, { snapshot });
		throw persistenceError;
	}
	return snapshot;
}

export function saveToStorage(snapshot: PersistedSnapshot) {
	assertValidNames(snapshot.chats, snapshot.folders);
	localStorage.setItem(
		STORAGE_KEY,
		JSON.stringify({
			chats: snapshot.chats,
			activeChatIndex: snapshot.activeChatIndex,
			folders: snapshot.folders,
			layout: _layout
		})
	);
}

// --- Vault (API key) storage ---

export interface VaultRecord {
	cipherText: string;
	salt: string;
	iv: string;
}

type VaultStore = Record<string, VaultRecord>;

export function getVaultStore(): VaultStore {
	const raw = localStorage.getItem(VAULT_KEY);
	if (!raw) return {};
	return JSON.parse(raw) as VaultStore;
}

export function setVaultStore(store: VaultStore): void {
	if (Object.keys(store).length === 0) {
		localStorage.removeItem(VAULT_KEY);
	} else {
		localStorage.setItem(VAULT_KEY, JSON.stringify(store));
	}
}

export function migrateVaultStorage(): void {
	if (localStorage.getItem(VAULT_KEY)) return;
	const legacy = localStorage.getItem(LEGACY_VAULT_KEY);
	if (!legacy) return;
	const record = JSON.parse(legacy) as VaultRecord;
	const store: VaultStore = { claude: record };
	localStorage.setItem(VAULT_KEY, JSON.stringify(store));
	localStorage.removeItem(LEGACY_VAULT_KEY);
}

export function clearVaultStorage(): void {
	localStorage.removeItem(VAULT_KEY);
}
