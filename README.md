# Cantor

A branching chat app with two views for exploring conversations. Built with Svelte 5 + Vite.

## Features

- Chat with Claude (via API), local Ollama models, or WebLLM (in-browser)
- **Two views** — Classic View (default) and Canvas View, sharing the same data model and operations
- **Sessions** — independent top-level chat workspaces, managed in the sidebar
- **Forks** — copy a conversation into a new independent tree within a session
- **Side chats** — branch off any main-path node for a quick thread (1 level deep)
- Promote side chats back to the main path
- In-browser search across all conversations
- Encrypted API key storage (PBKDF2 + AES-GCM)
- All state stored in browser localStorage

## Views

Both views operate on the same underlying tree data model (`ExchangeMap`) and call the same shared operations from `src/features/chat-ops/` and `src/domain/tree/`. The difference is purely in how the UI presents the conversation.

### Classic View (`#/` — default)

A traditional linear chat interface with a split-pane layout for side chats.

- `src/routes/ChatView.svelte` — main component
- Main chat renders as a scrollable message list (left pane)
- Side chats open in a right pane with branch navigation (prev/next/new)
- Chat input anchors to the bottom and follows the focused pane
- Uses `ChatMessage` component (`src/features/chat-message/`) for rendering exchanges

### Canvas View (`#/canvas`)

A visual node graph on a pan/zoom canvas.

- `src/routes/CanvasView.svelte` — main component
- `src/features/canvas/` — Canvas.svelte, ChatTree.svelte, ExchangeNode.svelte, layout.ts
- Exchanges rendered as positioned cards with edges connecting them
- Side branches expand/collapse inline on the canvas
- Hosts additional panels: document panels, code editors, Python editor, drawing board
- Auto-hiding chat header with fork navigation ("Main Chat", "Fork 1", etc.)
- Floating action buttons: search, fit view, go to top/active, download

## Security

### API Key Encryption

API keys are encrypted at rest using AES-256-GCM with keys derived via PBKDF2 (100,000 iterations, SHA-256). Each key gets its own random salt and IV. The encrypted vault is stored in `localStorage`.

To decrypt, the user enters a password. The password is never stored in plaintext anywhere.

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
- The TTL is a UX control, not a security boundary -- if an attacker has JS execution in the page, the TTL is irrelevant since they could call the decrypt flow directly
- On explicit lock (all keys removed), both the `sessionStorage` entry and the IndexedDB key are deleted

## Getting Started

```bash
bun install
bun run dev
```

## Tests And Checks

Run the main validation suite with:

```bash
bun run check:imports
bun run check:contracts
bun run typecheck
bun run lint
bun run test
```

What each command does:

- `bun run check:imports`
  - Enforces the architecture import rules.
  - Catches cross-layer imports that bypass the approved dependency direction.
  - Catches deep imports that should go through a public barrel instead, including imports between submodules in the same area.
  - Example: importing `@/state/chats.svelte` from another area when only `@/state` is allowed.
- `bun run check:contracts`
  - Verifies the frozen public API contract files are present and consistent with the matching mock structure.
  - This protects the contract metadata itself from drifting out of sync with the repo's test scaffolding.
  - It does not compare the contract to the live runtime module exports.
- `bun run typecheck`
  - Runs Svelte and TypeScript static checks.
- `bun run lint`
  - Runs Prettier and ESLint.
- `bun run test`
  - Runs the Vitest suite.

### Public API Freezing

Public APIs are frozen in two parts:

- Contract files in [`src/tests/contracts/`](./src/tests/contracts/)
  - These JSON files declare the exact public export shape for each root module.
- Public API tests in [`src/*/tests/index.test.ts`](./src/app/tests/index.test.ts)
  - These import the real module and compare it to the matching contract.
  - They fail if an expected export is missing.
  - They also fail if any extra export appears.

So:

- contract files define the expected public API
- public API tests enforce that the real module matches it exactly

If you add `export { test }` to a public module and do not update its contract, the failure should come from the module's public API test.

## Migration

To run the Svelte 5 migration tool:

```bash
bunx sv migrate svelte-5
```

## Architecture

See [CLAUDE.md](./CLAUDE.md) for detailed architecture, data model, branching concepts, and working rules.

## Project Structure

```
src/
├── lib/
│   ├── models/          index.ts (model metadata), logos.ts
│   ├── providers/       claude.ts, gemini.ts, ollama.ts, openai-compat.ts, webllm.ts, webllm-worker.ts, stream.ts, vault.ts
│   ├── search/          index.ts
│   ├── tree/            index.ts
│   └── validate-md/     index.ts, validate-md.test.ts
│
├── state/
│   ├── chats.svelte.ts
│   ├── documents.svelte.ts
│   ├── initial-exchanges.ts
│   └── providers.svelte.ts
│
├── routes/
│   ├── router.svelte.ts                            hash-based routing (chat | canvas)
│   ├── ChatView.svelte                             Classic View
│   └── CanvasView.svelte                           Canvas View
│
├── features/
│   ├── app-sidebar/                                shared sidebar
│   ├── chat-ops/        index.ts                   shared operations (delete, promote, fork, node data)
│   ├── chat-input/                                 shared chat input
│   ├── chat-message/    ChatMessage.svelte          Classic View message component
│   ├── canvas/          Canvas.svelte, ChatTree.svelte, ExchangeNode.svelte, layout.ts, katex.ts   Canvas View
│   ├── chat-header/                                Canvas View header
│   ├── chat-toolbar/                               Canvas View toolbar
│   ├── code-editor/     CodeEditor.svelte          Canvas View panel
│   ├── composer/                                   Canvas View
│   ├── docs-panel/      DocsPanel.svelte           Canvas View panel
│   ├── drawing-board/   DrawingBoard.svelte        Canvas View panel
│   ├── model-palette/
│   ├── python-editor/   PythonEditor.svelte        Canvas View panel
│   └── search-dialog/
│
├── components/
│   ├── custom/          button.svelte, input.svelte
│   └── shadcn/          ui/ (shadcn-svelte primitives), utils.ts
│
├── assets/
├── App.svelte
└── main.ts
```
