# Cantor

An LLM interface for power users. Svelte 5 + Vite single-page app with browser-only state persisted to IndexedDB.

UI notes:

- local primitives are built in `src/view/primitives/`
- interactive primitives use `bits-ui` under the hood where helpful

## Features

- Chat with Claude (via API), Gemini, local Ollama models, OpenAI-compatible endpoints, or WebLLM (in-browser)
- **Chats** — multiple independent top-level chats, managed in the sidebar
- **Copies** — copy a conversation path into a new independent chat
- **Side chats** — branch off any exchange for a quick thread (1 level deep)
- **Agent mode** — tool-capable chat with document editing, folder management, and workspace actions
- **Documents & folders** — rich document editing with code editors, drawing boards, and Python execution
- **Split workspace** — open documents or folders side-by-side with the active chat
- **Canvas view** — visual graph of the chat tree alongside the linear view
- Context strategies: full history, LRU (most recent within budget), BM25 (relevance-scored), or embedding similarity
- In-browser search across all conversations
- Audio recording in the composer
- Encrypted API key storage (PBKDF2 + AES-GCM) with session persistence

## Security

### API Key Encryption

API keys are encrypted at rest using AES-256-GCM with keys derived via PBKDF2 (100,000 iterations, SHA-256). Each key gets its own random salt and IV. The encrypted vault is stored in IndexedDB.

To decrypt, the user enters a master password. The password is never stored in plaintext anywhere.

### Session Persistence

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

## Getting Started

```bash
bun install
bun run dev
```

## Tests and Checks

```bash
bun run check:imports    # enforce architecture import rules
bun run check:contracts  # verify public API contract files
bun run typecheck        # Svelte/TypeScript static checks
bun run lint             # Prettier + ESLint
bun run test             # Vitest suite
```

### Public API Freezing

Public APIs are frozen in two parts:

- **Contract files** in `tests/contracts/` declare the exact public export shape for each root module
- **Public API tests** in `src/*/tests/index.test.ts` import the real module and compare it to the matching contract

If you add an export to a public module and do not update its contract, the public API test will fail.

## Architecture

See [CLAUDE.md](./CLAUDE.md) for detailed architecture rules and dependency constraints.

```
src/
├── domain/        app-specific business rules (pure)
│   ├── constraints/   context budget, model constraints
│   ├── documents/     document types
│   ├── models/        model metadata, active model types
│   └── tree/          chat tree data model (exchanges, paths, branches)
│
├── lib/           generic pure support code
│   ├── validate-md/            markdown validation
│   ├── bm25                    relevance scoring
│   ├── embedding-similarity    embedding-based relevance scoring
│   ├── provider-defaults       default provider/model config
│   ├── provider-types          shared provider type definitions
│   ├── rename                  dedup naming
│   └── token-estimate          token counting
│
├── state/         app runtime state (Svelte 5 runes)
│   ├── agent          agent run state
│   ├── chats          chat records, active chat, context strategy, mode
│   ├── documents      folders and files
│   ├── providers      API keys, provider config
│   └── workspace      layout, panels, sidebar
│
├── external/      persistence and outside-world boundaries
│   ├── io/            file import/export, download
│   ├── persistence/   IndexedDB read/write
│   ├── providers/     LLM provider streaming (Claude, Gemini, Ollama, OpenAI, WebLLM)
│   └── streams/       xstate streaming machine
│
├── app/           orchestration
│   ├── agent/         agent loop, tool execution, system prompt
│   ├── bootstrap/     app initialization
│   ├── canvas/        canvas view selection and visibility
│   ├── chat/          chat actions (submit, delete, fork, copy, export)
│   ├── documents/     document/folder CRUD
│   ├── providers/     provider management, vault
│   └── workspace/     workspace actions (layout, panels)
│
└── view/          UI and presentation logic
    ├── routes/        router
    ├── components/    app, chat-view, canvas-view, composer, sidebar,
    │                  code-editor, document, drawing-board, python-editor,
    │                  model-palette, context-palette, agent-palette,
    │                  agent-activity, audio-recorder, search, landing, …
    ├── primitives/    local UI primitives built on Svelte + bits-ui
    ├── css/           global stylesheets
    ├── lib/           view-specific helpers (katex)
    └── assets/        static assets
```

Shared test infrastructure lives at the repo root in `tests/`:

```
tests/
├── setup/          shared Vitest/browser setup
├── contracts/      public API contract JSON files
├── mocks/          shared mock factories
├── fixtures/       Svelte test harness components
└── public-api/     public API enforcement tests
```
