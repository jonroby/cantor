import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
	loadFromStorage,
	saveToStorage,
	trashItem,
	loadTrash,
	getTrashItem,
	deleteTrashItem,
	emptyTrash,
	getVaultStore,
	setVaultStore,
	migrateVaultStorage,
	clearVaultStorage,
	type TrashItem
} from '../database';
import * as state from '@/state';
import * as domain from '@/domain';

// ── IndexedDB mock ──────────────────────────────────────────────────────────

let idbStores: Record<string, Record<string, unknown>> = {};

function mockReq<T>(result: T) {
	const req = {
		result,
		onsuccess: null as (() => void) | null,
		onerror: null as (() => void) | null
	};
	queueMicrotask(() => req.onsuccess?.());
	return req;
}

function createMockIDB() {
	function makeObjectStore(storeName: string) {
		if (!idbStores[storeName]) idbStores[storeName] = {};
		const data = () => idbStores[storeName]!;

		return {
			get: (key: string) => mockReq(structuredClone(data()[key])),
			put: (value: unknown, key?: string) => {
				const k =
					key ??
					(value && typeof value === 'object' && 'id' in value
						? (value as { id: string }).id
						: undefined);
				if (k != null) data()[k] = structuredClone(value);
				return mockReq(undefined);
			},
			delete: (key: string) => {
				delete data()[key];
				return mockReq(undefined);
			},
			getAll: () => mockReq(structuredClone(Object.values(data()))),
			clear: () => {
				idbStores[storeName] = {};
				return mockReq(undefined);
			}
		};
	}

	const db = {
		transaction: (_stores: string | string[], _mode?: string) => ({
			objectStore: (name: string) => makeObjectStore(name)
		}),
		objectStoreNames: { contains: () => true },
		createObjectStore: vi.fn(),
		close: vi.fn()
	};

	return {
		open: () => {
			const req = {
				result: db,
				onupgradeneeded: null as (() => void) | null,
				onsuccess: null as (() => void) | null,
				onerror: null as (() => void) | null
			};
			queueMicrotask(() => req.onsuccess?.());
			return req;
		}
	};
}

vi.stubGlobal('indexedDB', createMockIDB());

// ── localStorage mock (for vault) ───────────────────────────────────────────

let localStore: Record<string, string> = {};

const localStorageMock = {
	getItem: (key: string) => localStore[key] ?? null,
	setItem: (key: string, value: string) => {
		localStore[key] = value;
	},
	removeItem: (key: string) => {
		delete localStore[key];
	},
	clear: () => {
		localStore = {};
	}
};

vi.stubGlobal('localStorage', localStorageMock);

// ── Helpers ──────────────────────────────────────────────────────────────────

const VAULT_KEY = 'byok_vault_v2';
const LEGACY_VAULT_KEY = 'byok_vault';

function buildChat(name: string): state.chats.ChatRecord {
	let tree = domain.tree.buildEmptyTree();
	const r = domain.tree.addExchange(tree, 'unused', 'hello', 'claude-sonnet-4-6', 'claude');
	tree = {
		rootId: r.tree.rootId,
		exchanges: domain.tree.updateExchangeResponse(r.tree.exchanges, r.id, 'world')
	};
	return {
		id: crypto.randomUUID(),
		name,
		rootId: tree.rootId,
		exchanges: tree.exchanges,
		activeExchangeId: r.id,
		contextStrategy: 'full' as const
	};
}

function resetState() {
	idbStores = {};
	localStore = {};
	const chat = buildChat('Chat 1');
	state.chats.chatState.chats = [chat];
	state.chats.chatState.activeChatIndex = 0;
	state.documents.documentState.folders = [];
	state.documents.documentState.openDocuments = [];
}

function currentSnapshot() {
	return {
		chats: state.chats.chatState.chats,
		activeChatIndex: state.chats.chatState.activeChatIndex,
		folders: state.documents.documentState.folders
	};
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('database', () => {
	beforeEach(() => {
		resetState();
	});

	describe('saveToStorage / loadFromStorage round-trip', () => {
		it('persists and restores chats', async () => {
			const originalName = state.chats.chatState.chats[0].name;
			await saveToStorage(currentSnapshot());

			// Corrupt state
			state.chats.chatState.chats[0].name = 'Corrupted';
			expect(state.chats.chatState.chats[0].name).toBe('Corrupted');

			const loaded = await loadFromStorage();
			expect(loaded?.chats[0]?.name).toBe(originalName);
		});

		it('persists and restores activeChatIndex', async () => {
			state.chats.chatState.chats = [buildChat('A'), buildChat('B')];
			state.chats.chatState.activeChatIndex = 1;
			await saveToStorage(currentSnapshot());

			const loaded = await loadFromStorage();
			expect(loaded?.activeChatIndex).toBe(1);
		});

		it('persists and restores folders', async () => {
			state.documents.documentState.folders = [
				{ id: 'f1', name: 'Docs', files: [{ id: 'd1', name: 'test.md', content: '# Hi' }] }
			];
			await saveToStorage(currentSnapshot());

			const loaded = await loadFromStorage();
			expect(loaded?.folders.length).toBe(1);
			expect(loaded?.folders[0]?.name).toBe('Docs');
			expect(loaded?.folders[0]?.files?.[0]?.content).toBe('# Hi');
		});

		it('does nothing when storage is empty', async () => {
			const before = state.chats.chatState.chats[0].name;
			const loaded = await loadFromStorage();
			expect(loaded).toBeNull();
			expect(state.chats.chatState.chats[0].name).toBe(before);
		});
	});

	describe('saveToStorage rejects duplicate names', () => {
		it('throws when two chats have the same name', async () => {
			state.chats.chatState.chats = [buildChat('Foo'), buildChat('Foo')];
			await expect(saveToStorage(currentSnapshot())).rejects.toThrow('Duplicate chat name');
		});

		it('throws when two folders have the same name', async () => {
			state.documents.documentState.folders = [
				{ id: 'f1', name: 'Docs' },
				{ id: 'f2', name: 'Docs' }
			];
			await expect(saveToStorage(currentSnapshot())).rejects.toThrow('Duplicate folder name');
		});

		it('throws when two files in the same folder have the same name', async () => {
			state.documents.documentState.folders = [
				{
					id: 'f1',
					name: 'Docs',
					files: [
						{ id: 'd1', name: 'readme.md', content: '' },
						{ id: 'd2', name: 'readme.md', content: '' }
					]
				}
			];
			await expect(saveToStorage(currentSnapshot())).rejects.toThrow('Duplicate file name');
		});

		it('allows the same file name in different folders', async () => {
			state.documents.documentState.folders = [
				{ id: 'f1', name: 'A', files: [{ id: 'd1', name: 'readme.md', content: '' }] },
				{ id: 'f2', name: 'B', files: [{ id: 'd2', name: 'readme.md', content: '' }] }
			];
			await expect(saveToStorage(currentSnapshot())).resolves.toBeUndefined();
		});
	});

	describe('loadFromStorage throws on duplicate names', () => {
		it('throws when stored chats have duplicate names', async () => {
			idbStores['snapshots'] = {
				main: {
					snapshot: {
						chats: [buildChat('Foo'), buildChat('Foo')],
						activeChatIndex: 0,
						folders: []
					},
					layout: {}
				}
			};
			await expect(loadFromStorage()).rejects.toThrow('Duplicate chat name');
		});

		it('throws when stored folders have duplicate names', async () => {
			idbStores['snapshots'] = {
				main: {
					snapshot: {
						chats: [buildChat('Chat 1')],
						activeChatIndex: 0,
						folders: [
							{ id: 'f1', name: 'Docs' },
							{ id: 'f2', name: 'Docs' }
						]
					},
					layout: {}
				}
			};
			await expect(loadFromStorage()).rejects.toThrow('Duplicate folder name');
		});

		it('throws when stored files in a folder have duplicate names', async () => {
			idbStores['snapshots'] = {
				main: {
					snapshot: {
						chats: [buildChat('Chat 1')],
						activeChatIndex: 0,
						folders: [
							{
								id: 'f1',
								name: 'Docs',
								files: [
									{ id: 'd1', name: 'readme.md', content: '' },
									{ id: 'd2', name: 'readme.md', content: '' }
								]
							}
						]
					},
					layout: {}
				}
			};
			await expect(loadFromStorage()).rejects.toThrow('Duplicate file name');
		});
	});

	describe('trash', () => {
		const sampleTrashItem: TrashItem = {
			id: 'trash-1',
			type: 'chat',
			name: 'My Chat',
			deletedAt: 1000,
			data: { some: 'data' }
		};

		it('stores and retrieves a trash item', async () => {
			await trashItem(sampleTrashItem);

			const retrieved = await getTrashItem('trash-1');
			expect(retrieved).toEqual(sampleTrashItem);
		});

		it('lists all trash items', async () => {
			await trashItem(sampleTrashItem);
			await trashItem({ ...sampleTrashItem, id: 'trash-2', name: 'Another' });

			const items = await loadTrash();
			expect(items).toHaveLength(2);
		});

		it('deletes a single trash item', async () => {
			await trashItem(sampleTrashItem);
			await deleteTrashItem('trash-1');

			const retrieved = await getTrashItem('trash-1');
			expect(retrieved).toBeUndefined();
		});

		it('empties all trash', async () => {
			await trashItem(sampleTrashItem);
			await trashItem({ ...sampleTrashItem, id: 'trash-2' });
			await emptyTrash();

			const items = await loadTrash();
			expect(items).toHaveLength(0);
		});
	});

	describe('getVaultStore', () => {
		it('returns empty object when no vault exists', () => {
			expect(getVaultStore()).toEqual({});
		});

		it('returns parsed vault store', () => {
			const vaultData = { claude: { cipherText: 'ct', salt: 's', iv: 'i' } };
			localStore[VAULT_KEY] = JSON.stringify(vaultData);
			expect(getVaultStore()).toEqual(vaultData);
		});
	});

	describe('setVaultStore', () => {
		it('writes vault store to localStorage', () => {
			const data = { claude: { cipherText: 'ct', salt: 's', iv: 'i' } };
			setVaultStore(data);
			expect(JSON.parse(localStore[VAULT_KEY])).toEqual(data);
		});

		it('removes key when store is empty', () => {
			localStore[VAULT_KEY] = '{"old": "data"}';
			setVaultStore({});
			expect(localStore[VAULT_KEY]).toBeUndefined();
		});
	});

	describe('migrateVaultStorage', () => {
		it('migrates legacy vault to new format under "claude" key', () => {
			const legacyRecord = { cipherText: 'ct', salt: 's', iv: 'i' };
			localStore[LEGACY_VAULT_KEY] = JSON.stringify(legacyRecord);

			migrateVaultStorage();

			const migrated = JSON.parse(localStore[VAULT_KEY]);
			expect(migrated).toEqual({ claude: legacyRecord });
			expect(localStore[LEGACY_VAULT_KEY]).toBeUndefined();
		});

		it('does nothing if new vault already exists', () => {
			localStore[VAULT_KEY] = JSON.stringify({
				existing: { cipherText: 'x', salt: 'y', iv: 'z' }
			});
			localStore[LEGACY_VAULT_KEY] = JSON.stringify({
				cipherText: 'old',
				salt: 'old',
				iv: 'old'
			});

			migrateVaultStorage();

			const result = JSON.parse(localStore[VAULT_KEY]);
			expect(result.existing).toBeDefined();
			expect(result.claude).toBeUndefined();
		});

		it('does nothing if no legacy vault exists', () => {
			migrateVaultStorage();
			expect(localStore[VAULT_KEY]).toBeUndefined();
		});
	});

	describe('clearVaultStorage', () => {
		it('removes the vault key', () => {
			localStore[VAULT_KEY] = '{"data": "here"}';
			clearVaultStorage();
			expect(localStore[VAULT_KEY]).toBeUndefined();
		});
	});
});
