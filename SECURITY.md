# Security

## API Key Encryption

API keys are encrypted at rest using AES-256-GCM with keys derived via PBKDF2 (100,000 iterations, SHA-256). Each key gets its own random salt and IV. The encrypted vault is stored in IndexedDB.

To decrypt, the user enters a master password. The password is never stored in plaintext anywhere.

## Session Persistence

To avoid re-entering the password on every page refresh, the app maintains a session cache:

1. On unlock, a random AES-256-GCM key is generated and stored as a **non-extractable** `CryptoKey` in IndexedDB
2. The password is encrypted with this session key and the ciphertext is stored in `sessionStorage` alongside a timestamp
3. On page refresh, the app retrieves the `CryptoKey` from IndexedDB, decrypts the password from `sessionStorage`, and auto-unlocks the vault
4. The session expires after 24 hours (client-side TTL)

**Threat model:**

- The password never exists in plaintext in any storage layer
- `sessionStorage` clears automatically when the browser tab closes
- Recovery requires both the IndexedDB `CryptoKey` and the `sessionStorage` ciphertext, plus JS execution context in the page
- The TTL is a UX control, not a security boundary — if an attacker has JS execution in the page, the TTL is irrelevant since they could call the decrypt flow directly
- On explicit lock, both the `sessionStorage` entry and the IndexedDB key are deleted
