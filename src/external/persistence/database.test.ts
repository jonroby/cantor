import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
	loadFromStorage,
	saveToStorage,
	getVaultStore,
	setVaultStore,
	migrateVaultStorage,
	clearVaultStorage
} from './database';
import * as state from '@/state';
import * as domain from '@/domain';

// ── localStorage mock ────────────────────────────────────────────────────────

let store: Record<string, string> = {};

const localStorageMock = {
	getItem: (key: string) => store[key] ?? null,
	setItem: (key: string, value: string) => {
		store[key] = value;
	},
	removeItem: (key: string) => {
		delete store[key];
	},
	clear: () => {
		store = {};
	}
};

vi.stubGlobal('localStorage', localStorageMock);

// ── Helpers ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'chat-tree-store-svelte';
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
		activeExchangeId: r.id
	};
}

function resetState() {
	store = {};
	const chat = buildChat('Chat 1');
	state.chats.chatState.chats = [chat];
	state.chats.chatState.activeChatIndex = 0;
	state.documents.docState.folders = [];
	state.documents.docState.openDocs = [];
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('database', () => {
	beforeEach(() => {
		resetState();
	});

	describe('saveToStorage / loadFromStorage round-trip', () => {
		it('persists and restores chats', () => {
			const originalName = state.chats.chatState.chats[0].name;
			saveToStorage();

			// Corrupt state
			state.chats.chatState.chats[0].name = 'Corrupted';
			expect(state.chats.chatState.chats[0].name).toBe('Corrupted');

			loadFromStorage();
			expect(state.chats.chatState.chats[0].name).toBe(originalName);
		});

		it('persists and restores activeChatIndex', () => {
			state.chats.chatState.chats = [buildChat('A'), buildChat('B')];
			state.chats.chatState.activeChatIndex = 1;
			saveToStorage();

			state.chats.chatState.activeChatIndex = 0;
			loadFromStorage();
			expect(state.chats.chatState.activeChatIndex).toBe(1);
		});

		it('persists and restores folders', () => {
			state.documents.docState.folders = [
				{ id: 'f1', name: 'Docs', files: [{ id: 'd1', name: 'test.md', content: '# Hi' }] }
			];
			saveToStorage();

			state.documents.docState.folders = [];
			loadFromStorage();
			expect(state.documents.docState.folders.length).toBe(1);
			expect(state.documents.docState.folders[0].name).toBe('Docs');
			expect(state.documents.docState.folders[0].files![0].content).toBe('# Hi');
		});

		it('does nothing when storage is empty', () => {
			const before = state.chats.chatState.chats[0].name;
			loadFromStorage();
			expect(state.chats.chatState.chats[0].name).toBe(before);
		});

		it('ignores invalid JSON in storage', () => {
			store[STORAGE_KEY] = 'not json {{{';
			const before = state.chats.chatState.chats[0].name;
			loadFromStorage();
			expect(state.chats.chatState.chats[0].name).toBe(before);
		});
	});

	describe('saveToStorage rejects duplicate names', () => {
		it('throws when two chats have the same name', () => {
			store[STORAGE_KEY] = 'unchanged';
			state.chats.chatState.chats = [buildChat('Foo'), buildChat('Foo')];
			expect(() => saveToStorage()).toThrow('Duplicate chat name');
			expect(store[STORAGE_KEY]).toBe('unchanged');
		});

		it('throws when two folders have the same name', () => {
			store[STORAGE_KEY] = 'unchanged';
			state.documents.docState.folders = [
				{ id: 'f1', name: 'Docs' },
				{ id: 'f2', name: 'Docs' }
			];
			expect(() => saveToStorage()).toThrow('Duplicate folder name');
			expect(store[STORAGE_KEY]).toBe('unchanged');
		});

		it('throws when two files in the same folder have the same name', () => {
			store[STORAGE_KEY] = 'unchanged';
			state.documents.docState.folders = [
				{
					id: 'f1',
					name: 'Docs',
					files: [
						{ id: 'd1', name: 'readme.md', content: '' },
						{ id: 'd2', name: 'readme.md', content: '' }
					]
				}
			];
			expect(() => saveToStorage()).toThrow('Duplicate file name');
			expect(store[STORAGE_KEY]).toBe('unchanged');
		});

		it('allows the same file name in different folders', () => {
			state.documents.docState.folders = [
				{ id: 'f1', name: 'A', files: [{ id: 'd1', name: 'readme.md', content: '' }] },
				{ id: 'f2', name: 'B', files: [{ id: 'd2', name: 'readme.md', content: '' }] }
			];
			expect(() => saveToStorage()).not.toThrow();
		});
	});

	describe('loadFromStorage throws on duplicate names', () => {
		it('throws when stored chats have duplicate names', () => {
			store[STORAGE_KEY] = JSON.stringify({
				chats: [buildChat('Foo'), buildChat('Foo')],
				activeChatIndex: 0
			});
			expect(() => loadFromStorage()).toThrow('Duplicate chat name');
		});

		it('throws when stored folders have duplicate names', () => {
			store[STORAGE_KEY] = JSON.stringify({
				chats: [buildChat('Chat 1')],
				activeChatIndex: 0,
				folders: [
					{ id: 'f1', name: 'Docs' },
					{ id: 'f2', name: 'Docs' }
				]
			});
			expect(() => loadFromStorage()).toThrow('Duplicate folder name');
		});

		it('throws when stored files in a folder have duplicate names', () => {
			store[STORAGE_KEY] = JSON.stringify({
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
			});
			expect(() => loadFromStorage()).toThrow('Duplicate file name');
		});
	});

	describe('getVaultStore', () => {
		it('returns empty object when no vault exists', () => {
			expect(getVaultStore()).toEqual({});
		});

		it('returns parsed vault store', () => {
			const vaultData = { claude: { cipherText: 'ct', salt: 's', iv: 'i' } };
			store[VAULT_KEY] = JSON.stringify(vaultData);
			expect(getVaultStore()).toEqual(vaultData);
		});
	});

	describe('setVaultStore', () => {
		it('writes vault store to localStorage', () => {
			const data = { claude: { cipherText: 'ct', salt: 's', iv: 'i' } };
			setVaultStore(data);
			expect(JSON.parse(store[VAULT_KEY])).toEqual(data);
		});

		it('removes key when store is empty', () => {
			store[VAULT_KEY] = '{"old": "data"}';
			setVaultStore({});
			expect(store[VAULT_KEY]).toBeUndefined();
		});
	});

	describe('migrateVaultStorage', () => {
		it('migrates legacy vault to new format under "claude" key', () => {
			const legacyRecord = { cipherText: 'ct', salt: 's', iv: 'i' };
			store[LEGACY_VAULT_KEY] = JSON.stringify(legacyRecord);

			migrateVaultStorage();

			const migrated = JSON.parse(store[VAULT_KEY]);
			expect(migrated).toEqual({ claude: legacyRecord });
			expect(store[LEGACY_VAULT_KEY]).toBeUndefined();
		});

		it('does nothing if new vault already exists', () => {
			store[VAULT_KEY] = JSON.stringify({ existing: { cipherText: 'x', salt: 'y', iv: 'z' } });
			store[LEGACY_VAULT_KEY] = JSON.stringify({ cipherText: 'old', salt: 'old', iv: 'old' });

			migrateVaultStorage();

			const result = JSON.parse(store[VAULT_KEY]);
			expect(result.existing).toBeDefined();
			expect(result.claude).toBeUndefined();
		});

		it('does nothing if no legacy vault exists', () => {
			migrateVaultStorage();
			expect(store[VAULT_KEY]).toBeUndefined();
		});
	});

	describe('clearVaultStorage', () => {
		it('removes the vault key', () => {
			store[VAULT_KEY] = '{"data": "here"}';
			clearVaultStorage();
			expect(store[VAULT_KEY]).toBeUndefined();
		});
	});
});
