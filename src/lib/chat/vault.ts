const VAULT_KEY = "byok_vault";

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
        "raw",
        new TextEncoder().encode(password),
        "PBKDF2",
        false,
        ["deriveKey"],
    );
    return crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: salt as BufferSource, iterations: 100_000, hash: "SHA-256" },
        baseKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"] as KeyUsage[],
    );
}

export async function saveApiKey(apiKey: string, password: string): Promise<void> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        new TextEncoder().encode(apiKey),
    );
    const record: VaultRecord = {
        cipherText: bytesToBase64(new Uint8Array(encrypted)),
        salt: bytesToBase64(salt),
        iv: bytesToBase64(iv),
    };
    localStorage.setItem(VAULT_KEY, JSON.stringify(record));
}

export async function loadApiKey(password: string): Promise<string> {
    const raw = localStorage.getItem(VAULT_KEY);
    if (!raw) throw new Error("No saved key found.");
    const record = JSON.parse(raw) as VaultRecord;
    const key = await deriveKey(password, base64ToBytes(record.salt));
    let decrypted: ArrayBuffer;
    try {
        decrypted = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: base64ToBytes(record.iv) as BufferSource },
            key,
            base64ToBytes(record.cipherText) as BufferSource,
        );
    } catch {
        throw new Error("Incorrect password.");
    }
    return new TextDecoder().decode(decrypted);
}

export function hasVault(): boolean {
    return localStorage.getItem(VAULT_KEY) !== null;
}

export function clearVault(): void {
    localStorage.removeItem(VAULT_KEY);
}
