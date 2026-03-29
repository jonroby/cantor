import * as domain from '@/domain';
import * as state from '@/state';

const STORAGE_KEY = 'chat-tree-store-svelte';
const VAULT_KEY = 'byok_vault_v2';
const LEGACY_VAULT_KEY = 'byok_vault';

// --- Invariant checks ---

function assertValidNames(chats: state.chats.ChatRecord[], folders: state.documents.ChatFolder[]) {
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
}

let _layout: PersistedLayout = {};

export function getPersistedLayout(): PersistedLayout {
	return _layout;
}

export function setPersistedLayout(layout: PersistedLayout) {
	_layout = layout;
}

export function loadFromStorage() {
	const raw = localStorage.getItem(STORAGE_KEY);
	if (!raw) return;
	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return;
	}
	state.chats.hydrate(parsed);
	if (parsed.folders?.length) {
		state.documents.docState.folders = parsed.folders;
	}
	if (parsed.layout) {
		_layout = parsed.layout;
	}
	assertValidNames(state.chats.chatState.chats, state.documents.docState.folders);
}

export function saveToStorage() {
	assertValidNames(state.chats.chatState.chats, state.documents.docState.folders);
	localStorage.setItem(
		STORAGE_KEY,
		JSON.stringify({
			chats: state.chats.chatState.chats,
			activeChatIndex: state.chats.chatState.activeChatIndex,
			folders: state.documents.docState.folders,
			layout: _layout
		})
	);
}

// --- Vault (API key) storage ---

interface VaultRecord {
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
