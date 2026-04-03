import * as domain from '@/domain';

const DB_NAME = 'cantor-db';
const DB_VERSION = 2;
const STORE_NAME = 'snapshots';
const TRASH_STORE_NAME = 'trash';
const SNAPSHOT_KEY = 'main';

const VAULT_KEY = 'byok_vault_v2';

// --- Invariant checks ---

interface PersistedChat {
	id: string;
	name: string;
	rootId: string | null;
	exchanges: domain.tree.ExchangeMap;
	activeExchangeId: string | null;
	contextStrategy: 'full' | 'lru' | 'bm25';
	mode: 'chat' | 'agent';
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

export interface PersistedSnapshot {
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

// --- IndexedDB helpers ---

function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME);
			}
			if (!db.objectStoreNames.contains(TRASH_STORE_NAME)) {
				db.createObjectStore(TRASH_STORE_NAME, { keyPath: 'id' });
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function idbGet<T>(db: IDBDatabase, storeName: string, key: string): Promise<T | undefined> {
	return new Promise((resolve, reject) => {
		const tx = db.transaction(storeName, 'readonly');
		const store = tx.objectStore(storeName);
		const request = store.get(key);
		request.onsuccess = () => resolve(request.result as T | undefined);
		request.onerror = () => reject(request.error);
	});
}

function idbPut(db: IDBDatabase, storeName: string, key: string, value: unknown): Promise<void> {
	return new Promise((resolve, reject) => {
		const tx = db.transaction(storeName, 'readwrite');
		const store = tx.objectStore(storeName);
		const request = store.put(JSON.parse(JSON.stringify(value)), key);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
}

function idbPutAutoKey(db: IDBDatabase, storeName: string, value: unknown): Promise<void> {
	return new Promise((resolve, reject) => {
		const tx = db.transaction(storeName, 'readwrite');
		const store = tx.objectStore(storeName);
		const request = store.put(JSON.parse(JSON.stringify(value)));
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
}

function idbDelete(db: IDBDatabase, storeName: string, key: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const tx = db.transaction(storeName, 'readwrite');
		const store = tx.objectStore(storeName);
		const request = store.delete(key);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
}

function idbGetAll<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
	return new Promise((resolve, reject) => {
		const tx = db.transaction(storeName, 'readonly');
		const store = tx.objectStore(storeName);
		const request = store.getAll();
		request.onsuccess = () => resolve(request.result as T[]);
		request.onerror = () => reject(request.error);
	});
}

function idbClear(db: IDBDatabase, storeName: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const tx = db.transaction(storeName, 'readwrite');
		const store = tx.objectStore(storeName);
		const request = store.clear();
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
}

// --- Layout (in-memory, persisted alongside snapshot) ---

export type PersistedPanel =
	| { type: 'chat' }
	| { type: 'document'; folderId: string; fileId: string }
	| { type: 'folder'; folderId: string };

export interface PersistedLayout {
	openDocument?: { folderId: string; fileId: string };
	sidebarOpen?: boolean;
	panels?: PersistedPanel[];
	expandedFolders?: Record<string, boolean>;
	activeModel?: { provider: string; modelId: string };
}

let _layout: PersistedLayout = {};

export function getPersistedLayout(): PersistedLayout {
	return _layout;
}

export function setPersistedLayout(layout: PersistedLayout) {
	_layout = layout;
}

// --- Chat & folder storage ---

interface StoredData {
	snapshot: PersistedSnapshot;
	layout: PersistedLayout;
}

function isPersistedPanel(value: unknown): value is PersistedPanel {
	if (typeof value !== 'object' || value === null) return false;
	const panel = value as Record<string, unknown>;
	if (panel.type === 'chat') return true;
	if (panel.type === 'folder') return typeof panel.folderId === 'string';
	if (panel.type === 'document') {
		return typeof panel.folderId === 'string' && typeof panel.fileId === 'string';
	}
	return false;
}

function isPersistedLayout(value: unknown): value is PersistedLayout {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	const layout = value as Record<string, unknown>;
	if (
		'openDocument' in layout &&
		layout.openDocument !== undefined &&
		(typeof layout.openDocument !== 'object' ||
			layout.openDocument === null ||
			typeof (layout.openDocument as { folderId?: unknown }).folderId !== 'string' ||
			typeof (layout.openDocument as { fileId?: unknown }).fileId !== 'string')
	) {
		return false;
	}
	if (
		'sidebarOpen' in layout &&
		layout.sidebarOpen !== undefined &&
		typeof layout.sidebarOpen !== 'boolean'
	) {
		return false;
	}
	if (
		'panels' in layout &&
		layout.panels !== undefined &&
		(!Array.isArray(layout.panels) || !layout.panels.every(isPersistedPanel))
	) {
		return false;
	}
	if ('expandedFolders' in layout && layout.expandedFolders !== undefined) {
		if (
			typeof layout.expandedFolders !== 'object' ||
			layout.expandedFolders === null ||
			Array.isArray(layout.expandedFolders)
		) {
			return false;
		}
		for (const value of Object.values(layout.expandedFolders as Record<string, unknown>)) {
			if (typeof value !== 'boolean') return false;
		}
	}
	return true;
}

function isPersistedSnapshot(value: unknown): value is PersistedSnapshot {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	const snapshot = value as Record<string, unknown>;
	return (
		Array.isArray(snapshot.chats) &&
		typeof snapshot.activeChatIndex === 'number' &&
		Array.isArray(snapshot.folders)
	);
}

function isStoredData(value: unknown): value is StoredData {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	const stored = value as Record<string, unknown>;
	return isPersistedSnapshot(stored.snapshot) && isPersistedLayout(stored.layout);
}

export async function loadFromStorage(): Promise<PersistedSnapshot | null> {
	const db = await openDB();
	try {
		const stored = await idbGet<StoredData>(db, STORE_NAME, SNAPSHOT_KEY);
		if (!stored) return null;
		if (!isStoredData(stored)) {
			throw new Error('Invalid storage');
		}

		_layout = stored.layout;
		assertValidNames(stored.snapshot.chats, stored.snapshot.folders);
		return stored.snapshot;
	} finally {
		db.close();
	}
}

export async function saveToStorage(snapshot: PersistedSnapshot): Promise<void> {
	assertValidNames(snapshot.chats, snapshot.folders);
	const db = await openDB();
	try {
		await idbPut(db, STORE_NAME, SNAPSHOT_KEY, {
			snapshot: {
				chats: snapshot.chats,
				activeChatIndex: snapshot.activeChatIndex,
				folders: snapshot.folders
			},
			layout: _layout
		});
	} finally {
		db.close();
	}
}

// --- Trash storage ---

export type TrashItemType = 'chat' | 'folder' | 'document';

export interface TrashItem {
	id: string;
	type: TrashItemType;
	name: string;
	deletedAt: number;
	data: unknown;
}

export async function trashItem(item: TrashItem): Promise<void> {
	const db = await openDB();
	try {
		await idbPutAutoKey(db, TRASH_STORE_NAME, item);
	} finally {
		db.close();
	}
}

export async function loadTrash(): Promise<TrashItem[]> {
	const db = await openDB();
	try {
		return await idbGetAll<TrashItem>(db, TRASH_STORE_NAME);
	} finally {
		db.close();
	}
}

export async function getTrashItem(id: string): Promise<TrashItem | undefined> {
	const db = await openDB();
	try {
		return await idbGet<TrashItem>(db, TRASH_STORE_NAME, id);
	} finally {
		db.close();
	}
}

export async function deleteTrashItem(id: string): Promise<void> {
	const db = await openDB();
	try {
		await idbDelete(db, TRASH_STORE_NAME, id);
	} finally {
		db.close();
	}
}

export async function emptyTrash(): Promise<void> {
	const db = await openDB();
	try {
		await idbClear(db, TRASH_STORE_NAME);
	} finally {
		db.close();
	}
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

export function clearVaultStorage(): void {
	localStorage.removeItem(VAULT_KEY);
}
