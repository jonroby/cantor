import * as persistence from '@/external/persistence';

function base64ToBytes(b64: string): Uint8Array {
	return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function bytesToBase64(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes));
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
	const baseKey = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(password),
		'PBKDF2',
		false,
		['deriveKey']
	);
	return crypto.subtle.deriveKey(
		{ name: 'PBKDF2', salt: salt as BufferSource, iterations: 100_000, hash: 'SHA-256' },
		baseKey,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt'] as KeyUsage[]
	);
}

async function encryptValue(value: string, password: string): Promise<persistence.VaultRecord> {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const key = await deriveKey(password, salt);
	const encrypted = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv },
		key,
		new TextEncoder().encode(value)
	);
	return {
		cipherText: bytesToBase64(new Uint8Array(encrypted)),
		salt: bytesToBase64(salt),
		iv: bytesToBase64(iv)
	};
}

async function decryptRecord(record: persistence.VaultRecord, password: string): Promise<string> {
	const key = await deriveKey(password, base64ToBytes(record.salt));
	let decrypted: ArrayBuffer;
	try {
		decrypted = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: base64ToBytes(record.iv) as BufferSource },
			key,
			base64ToBytes(record.cipherText) as BufferSource
		);
	} catch {
		throw new Error('Incorrect password.');
	}
	return new TextDecoder().decode(decrypted);
}

export async function verifyPassword(password: string): Promise<void> {
	const store = persistence.getVaultStore();
	const firstKey = Object.keys(store)[0];
	if (!firstKey) return;
	await decryptRecord(store[firstKey]!, password);
}

export async function saveApiKey(
	provider: string,
	apiKey: string,
	password: string
): Promise<void> {
	const store = persistence.getVaultStore();
	const existingKey = Object.keys(store).find((k) => k !== provider);
	if (existingKey) {
		await decryptRecord(store[existingKey]!, password);
	}
	store[provider] = await encryptValue(apiKey, password);
	persistence.setVaultStore(store);
}

export async function loadApiKey(provider: string, password: string): Promise<string> {
	const store = persistence.getVaultStore();
	const record = store[provider];
	if (!record) throw new Error(`No saved key found for ${provider}.`);
	return decryptRecord(record, password);
}

export async function loadAllApiKeys(password: string): Promise<Record<string, string>> {
	const store = persistence.getVaultStore();
	const result: Record<string, string> = {};
	for (const [provider, record] of Object.entries(store)) {
		result[provider] = await decryptRecord(record, password);
	}
	return result;
}

export function hasVault(): boolean {
	const store = persistence.getVaultStore();
	return Object.keys(store).length > 0;
}

export function hasProviderKey(provider: string): boolean {
	const store = persistence.getVaultStore();
	return provider in store;
}

export function storedProviders(): string[] {
	return Object.keys(persistence.getVaultStore());
}

export function clearVault(): void {
	persistence.clearVaultStorage();
}

export function clearProviderKey(provider: string): void {
	const store = persistence.getVaultStore();
	delete store[provider];
	persistence.setVaultStore(store);
}

// ── Session cache ───────────────────────────────────────────────────────────
//
// The password is encrypted with a random session key stored in IndexedDB.
// The ciphertext goes in sessionStorage. An attacker needs both stores to
// recover the password, and sessionStorage clears when the tab closes.

const SESSION_STORAGE_KEY = 'vault_session';
const SESSION_DB_NAME = 'cantor-session';
const SESSION_DB_STORE = 'keys';
const SESSION_DB_KEY = 'session-key';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function openSessionDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(SESSION_DB_NAME, 1);
		request.onupgradeneeded = () => {
			request.result.createObjectStore(SESSION_DB_STORE);
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function getOrCreateSessionKey(): Promise<CryptoKey> {
	const db = await openSessionDB();
	try {
		const existing = await new Promise<CryptoKey | undefined>((resolve, reject) => {
			const tx = db.transaction(SESSION_DB_STORE, 'readonly');
			const req = tx.objectStore(SESSION_DB_STORE).get(SESSION_DB_KEY);
			req.onsuccess = () => resolve(req.result as CryptoKey | undefined);
			req.onerror = () => reject(req.error);
		});
		if (existing) return existing;

		const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
			'encrypt',
			'decrypt'
		]);
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction(SESSION_DB_STORE, 'readwrite');
			const req = tx.objectStore(SESSION_DB_STORE).put(key, SESSION_DB_KEY);
			req.onsuccess = () => resolve();
			req.onerror = () => reject(req.error);
		});
		return key;
	} finally {
		db.close();
	}
}

async function deleteSessionKey(): Promise<void> {
	const db = await openSessionDB();
	try {
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction(SESSION_DB_STORE, 'readwrite');
			const req = tx.objectStore(SESSION_DB_STORE).delete(SESSION_DB_KEY);
			req.onsuccess = () => resolve();
			req.onerror = () => reject(req.error);
		});
	} finally {
		db.close();
	}
}

export async function cacheSession(password: string): Promise<void> {
	const key = await getOrCreateSessionKey();
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const encrypted = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv },
		key,
		new TextEncoder().encode(password)
	);
	sessionStorage.setItem(
		SESSION_STORAGE_KEY,
		JSON.stringify({
			cipherText: bytesToBase64(new Uint8Array(encrypted)),
			iv: bytesToBase64(iv),
			timestamp: Date.now()
		})
	);
}

export async function getCachedSession(): Promise<string | null> {
	const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
	if (!raw) return null;
	try {
		const { cipherText, iv, timestamp } = JSON.parse(raw) as {
			cipherText: string;
			iv: string;
			timestamp: number;
		};
		if (Date.now() - timestamp > SESSION_TTL_MS) {
			sessionStorage.removeItem(SESSION_STORAGE_KEY);
			return null;
		}
		const key = await getOrCreateSessionKey();
		const decrypted = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: base64ToBytes(iv) as BufferSource },
			key,
			base64ToBytes(cipherText) as BufferSource
		);
		return new TextDecoder().decode(decrypted);
	} catch {
		sessionStorage.removeItem(SESSION_STORAGE_KEY);
		return null;
	}
}

export async function clearSession(): Promise<void> {
	sessionStorage.removeItem(SESSION_STORAGE_KEY);
	await deleteSessionKey();
}
