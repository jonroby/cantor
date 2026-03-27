import {
	getVaultStore,
	setVaultStore,
	migrateVaultStorage,
	clearVaultStorage
} from '@/services/database.svelte';

interface VaultRecord {
	cipherText: string;
	salt: string;
	iv: string;
}

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

async function encryptValue(value: string, password: string): Promise<VaultRecord> {
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

async function decryptRecord(record: VaultRecord, password: string): Promise<string> {
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

export function migrateVault(): void {
	migrateVaultStorage();
}

export async function saveApiKey(
	provider: string,
	apiKey: string,
	password: string
): Promise<void> {
	const store = getVaultStore();
	store[provider] = await encryptValue(apiKey, password);
	setVaultStore(store);
}

export async function loadApiKey(provider: string, password: string): Promise<string> {
	const store = getVaultStore();
	const record = store[provider];
	if (!record) throw new Error(`No saved key found for ${provider}.`);
	return decryptRecord(record, password);
}

export async function loadAllApiKeys(password: string): Promise<Record<string, string>> {
	const store = getVaultStore();
	const result: Record<string, string> = {};
	for (const [provider, record] of Object.entries(store)) {
		result[provider] = await decryptRecord(record, password);
	}
	return result;
}

export function hasVault(): boolean {
	const store = getVaultStore();
	return Object.keys(store).length > 0;
}

export function hasProviderKey(provider: string): boolean {
	const store = getVaultStore();
	return provider in store;
}

export function storedProviders(): string[] {
	return Object.keys(getVaultStore());
}

export function clearVault(): void {
	clearVaultStorage();
}

export function clearProviderKey(provider: string): void {
	const store = getVaultStore();
	delete store[provider];
	setVaultStore(store);
}
