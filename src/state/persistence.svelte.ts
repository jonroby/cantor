import { chatState, hydrate } from '@/state/chats.svelte';
import { docState } from '@/state/documents.svelte';

const STORAGE_KEY = 'chat-tree-store-svelte';
const VAULT_KEY = 'byok_vault_v2';
const LEGACY_VAULT_KEY = 'byok_vault';

// --- Chat & folder persistence ---

export function loadFromStorage() {
	const raw = localStorage.getItem(STORAGE_KEY);
	if (!raw) return;
	try {
		const parsed = JSON.parse(raw);
		hydrate(parsed);
		if (parsed.folders?.length) {
			docState.folders = parsed.folders;
		}
	} catch {
		// ignore invalid persisted state
	}
}

export function saveToStorage() {
	localStorage.setItem(
		STORAGE_KEY,
		JSON.stringify({
			chats: chatState.chats,
			activeChatIndex: chatState.activeChatIndex,
			folders: docState.folders
		})
	);
}

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

// --- Vault (API key) persistence ---

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
