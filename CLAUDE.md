# CLAUDE.md

## Purpose

This repository is a Svelte 5 + Vite single-page app for exploring branching chat conversations. The app supports Claude, Ollama, Gemini, OpenAI-compatible, and WebLLM models, stores chat state in the browser, and provides two views over the same data: a Classic View (default, linear chat with side pane) and a Canvas View (visual node graph).

## Tooling Rule

Always use `bun`.

- Use `bun install` for dependencies.
- Use `bun run dev` to start the app.
- Use `bun run build` for production builds.
- Use `bun run check` for Svelte/TypeScript checks.
- Use `bun run lint` for formatting/lint validation.
- Use `bun run format` for formatting.
- Use `bun run test` or `bun run test:unit` for tests.
- Do not use `npm`, `pnpm`, or `yarn` commands in this repo unless the user explicitly asks for that.

## Architecture

The app has four layers, each mapping to one top-level directory. Dependencies flow downward only — each layer may import from layers above it, never below.

```
src/
├── domain/        ← 1. Pure types and functions (the primitives)
├── state/         ← 2. Reactive stores + effectful services
├── app/           ← 3. Orchestration (use cases)
├── view/          ← 4. Svelte components (presentation)
└── assets/        ← Static assets (outside the layer hierarchy)
```

```
┌─────────────────────────────────────────────────┐
│  Domain (pure)                                  │
│  The base primitives: data structures, types,   │
│  operations, provider definitions, search.      │
│  No state. No side effects. No imports from     │
│  lower layers. Fully testable with plain data.  │
├─────────────────────────────────────────────────┤
│  State (effects)                                │
│  Reactive stores + services. Owns IO, browser   │
│  APIs, persistence, networking, streaming.      │
│  Imports from Domain only.                      │
├─────────────────────────────────────────────────┤
│  App (orchestration)                            │
│  Use cases that sequence domain logic with      │
│  state mutations and service calls.             │
│  "What happens when the user does X."           │
│  Imports from Domain and State.                 │
├─────────────────────────────────────────────────┤
│  View (presentation)                            │
│  Svelte components, routes, layout.             │
│  Renders state, calls App functions.            │
│  Imports from all layers above.                 │
└─────────────────────────────────────────────────┘
```

### Domain — `src/domain/`

The base primitives the app is built on. Pure functions and types that define the concepts and the rules about them. Given the same input, always the same output. No reactive state (`$state`, `$derived`), no `fetch`, no `localStorage`, no timers, no randomness outside of explicitly passed parameters.

- `src/domain/tree/` — `ChatTree`, `Exchange`, `ExchangeMap`, and all tree operations (add, remove, promote, fork, validate, query). The core data model.
- `src/domain/models/` — provider definitions, model lists, logo assets. The vocabulary for talking about LLM providers and models.
- `src/domain/search/` — search algorithms (substring, trigram). How you find things in chat data.
- `src/domain/validate-md/` — markdown validation. What valid markdown looks like.

**Test rule:** Domain tests need no mocks. If you need a mock to test something in domain, it doesn't belong in domain.

### State — `src/state/`

Reactive stores and effectful services. This layer owns all communication with the outside world.

**Stores** (reactive containers — hold data, expose read/write access):
- `src/state/chats.svelte.ts` — reactive chat state: the list of chats, active chat index, active exchange. Simple getters and setters.
- `src/state/documents.svelte.ts` — reactive document/folder state.
- `src/state/providers.svelte.ts` — active provider/model selection, context length. State only — no orchestration.

**Services** (`src/state/services/` — effectful utilities that talk to the outside world):
- `src/state/services/streams/` — XState actors for streaming LLM responses. Manages stream lifecycle, writes response chunks into state.
- `src/state/services/database.svelte.ts` — localStorage persistence (read/write the full app state).
- `src/state/services/io.svelte.ts` — file import/export (JSON chat files, markdown docs, zip folders). Pure validation/dedup logic lives in `io.ts`.
- `src/state/services/providers/` — provider-specific HTTP clients (Claude, Ollama, Gemini, OpenAI-compatible, WebLLM, vault).

**Rule:** Stores do not sequence multi-step operations — that's the App layer's job. Services handle IO but do not orchestrate domain + state together.

### App — `src/app/`

Orchestration. Each function represents a user-initiated action that coordinates domain logic, state updates, and service calls.

- `src/app/chat-actions.ts` — `performDelete`, `performPromote`, `performFork`, `getExchangeNodeData`, `getDeleteMode`.
- `src/app/providers.ts` — `connectOllama`, `autoConnectOllama`, `loadWebLLMModel_`, `unlockKeys`, `saveKey`, `forgetKey`, `getProviderStream`, `fetchOllamaContextLength`, `init`.

**Rule:** App functions are the only place where domain + state + services are composed together. Views should not orchestrate multi-step operations themselves — they call an App function.

### View — `src/view/`

Svelte components. They render state, handle user interactions, and delegate actions to the App layer.

- `src/view/classic/` — Classic View. `ChatView.svelte`, `ChatMessage.svelte`, side pane logic.
- `src/view/canvas/` — Canvas View. `CanvasView.svelte`, `ExchangeNode.svelte`, `Canvas.svelte`, `layout.ts`.
- `src/view/shared/` — Components used by both views: `ChatInput`, `AppSidebar`, `SearchDialog`.
- `src/view/features/` — Self-contained feature modules: model-palette, docs-panel, code-editor, python-editor, drawing-board. A feature never imports from a view.
- `src/view/components/custom/` — Small reusable UI primitives (buttons, inputs).
- `src/view/components/shadcn/ui/` — shadcn-svelte primitives (sidebar, tooltip, sheet).
- `src/view/routes/` — Router only. Picks which view to render based on the URL hash.

**Rule:** View components can read state directly (via `$derived`) and call App functions. They should not import domain mutation functions directly or sequence multiple state updates. Pure domain queries (e.g., `getChildExchanges`) are fine to call from views for rendering purposes.

### Where things go — decision guide

| You're writing... | It goes in... | Because... |
|---|---|---|
| A function that takes data and returns data | `src/domain/` | No effects needed |
| A reactive `$state` or `$derived` store | `src/state/` | It's a reactive container |
| A function that calls `fetch`, `localStorage`, or browser APIs | `src/state/services/` | It's IO |
| A function that calls domain + updates state + triggers services | `src/app/` | It's orchestration |
| A Svelte component | `src/view/` | It renders |
| A function you're not sure about | Ask: does it need effects? No → Domain. Does it sequence multiple steps? Yes → App. Does it talk to the outside world? Yes → Services. |

## Core Data Model

The central types are `ChatTree` and `Exchange` from `src/domain/tree/index.ts`.

- `ChatTree` bundles a `rootId: string | null` with an `ExchangeMap`. These two are always passed together — never separately.
- Each `Exchange` has `id`, `parentId`, `childIds`, `prompt: MessagePart`, `response: MessagePart | null`, `model`, `provider`, and `createdAt`.
- `response` is `null` until the model responds. This distinguishes "no response yet" from "responded with empty text."
- The exchange with `parentId === null` is the tree root. `rootId` on `ChatTree` must point to it.
- The first child path (following `childIds[0]` at each node) is the main chat.
- Additional siblings represent side chats.
- Tree utilities enforce structural invariants: parent/child consistency, single root, reachability, and the side-chat depth constraint (side exchanges can have at most 1 child).

## Branching Concepts

There are three distinct branching concepts. **Do not confuse them.**

### Sessions

- Top-level chat sessions managed in the sidebar (`AppSidebar.svelte`).
- Each session has its own set of roots (main chat + forks).
- Stored in `chatState` in `src/state/chats.svelte.ts`.

### Forks

- A **fork** copies the conversation from root down to a selected node into a **new root** within the same session.
- Forks appear as separate trees, navigable via the top header bar ("Main Chat", "Fork 1", "Fork 2", etc.).
- Created via fork actions, triggered by the fork button (`+` icon) on exchange nodes.
- Forks have no depth restriction — you can fork a fork.
- Each fork is a separate `Chat` (with its own `ChatTree`).
- Prop: `onFork` on `ExchangeNodeData`.

### Side Chats

- A **side chat** is a sibling branch off an existing node within the same tree.
- Created implicitly by selecting a node and typing a new message (no dedicated button).
- Side chats are **1 level deep only** — a side chat node can have at most 1 child.
- Restriction enforced by `canCreateSideChats()` and `canAcceptNewChat()` in `src/domain/tree/index.ts`.
- The "Side chats" button (branch icon) on a node **toggles visibility** of its side branches; it does not create them.
- Prop: `hasSideChildren` / `onToggleSideChildren` on `ExchangeNodeData`.
- A side chat can be **promoted** to become the main chat path via the promote button.
- Prop: `isSideRoot` / `canPromote` / `onPromote` on `ExchangeNodeData`.

## Views

The app has two views that share the same underlying data model, state stores, and operations. Routing is hash-based via `src/view/routes/router.svelte.ts`: `#/` is Classic View (default), `#/canvas` is Canvas View.

### Shared Layer

Both views consume:

- **State**: `src/state/chats.svelte.ts` (active chat, active exchange), `src/state/documents.svelte.ts`, `src/state/providers.svelte.ts`.
- **Domain logic**: `src/domain/tree/index.ts` — tree queries for rendering (child lookups, main chat path traversal).
- **App operations**: `src/app/` — `performDelete()`, `performPromote()`, `performFork()`, `getExchangeNodeData()`. Both views call these same functions.
- **Shared view components**: `src/view/shared/` — `ChatInput`, `AppSidebar`, `SearchDialog`.

### Classic View (`src/view/classic/`)

A traditional linear chat interface. Default route (`#/`).

- `ChatView.svelte` — the page shell: main pane, side pane, chat input anchor, delete dialog.
- `ChatMessage.svelte` — renders an exchange as a prompt/response pair with provider logo, action buttons, and rich text (markdown + KaTeX).
- **Main pane**: Scrollable message list rendering the main chat path (first-child traversal from root).
- **Side pane**: Opens to the right when a node's side children are toggled. Shows one branch at a time with prev/next navigation and a "new branch" action.
- **Chat input**: Anchored at the bottom, shifts to follow the focused pane (main or side).
- **Focus model**: Clicking a pane sets it as focused; `activeExchangeId` tracks the tail of the focused pane.

### Canvas View (`src/view/canvas/`)

A visual node graph on a pan/zoom canvas.

- `CanvasView.svelte` — the page shell: canvas, floating actions, delete dialog.
- `Canvas.svelte` — renders the pan/zoom canvas with CSS transforms (`translate` + `scale`). Has `overflow: hidden`.
- `ExchangeNode.svelte` — renders each exchange card with action buttons on hover.
- `layout.ts` — converts the exchange tree into positioned canvas nodes and edges. Also computes positions for canvas panels.
- Collapsed side branches are hidden from layout until expanded.
- Hosts features as canvas panels (docs-panel, code-editor, python-editor, drawing-board).

Panels inside the canvas use `onwheel stopPropagation` to allow native scrolling without triggering canvas pan.

## Documents and Folders

- `ChatFolder` and `DocFile` types are defined in `src/state/documents.svelte.ts`.
- Folders and their files are stored in `docState` in `src/state/documents.svelte.ts` and persisted to `localStorage`.
- Open doc panels are tracked as `openDocs[]` in `docState` — this is transient UI state (not persisted across reloads).
- Each open doc has an `id`, `content`, and optional `docKey` linking it to a folder file.
- When a doc is saved in the panel, changes persist back to `folders` if it has a `docKey`.
- Users open docs via the dropdown menu on a file in the sidebar (not by clicking the file directly).
- Uploading a file with a duplicate name auto-increments: `name (1).md`, `name (2).md`, etc.
- Closing a panel with unsaved edits shows a confirmation dialog.

## UI Component Notes

- **Sidebar** (`src/view/shared/AppSidebar.svelte`) — pushes the main content area when open.
- **Chat input** (`src/view/shared/ChatInput.svelte`) — in Classic View, anchors to the focused pane. In Canvas View, overlays the bottom of the canvas.
- **Canvas exchange node actions** — use custom CSS tooltips (`.action-tip-wrap` / `.action-tip`), not Floating UI, because the canvas CSS transform breaks Floating UI positioning.
- **Classic chat message actions** — appear inline rather than as hover overlays.

## Model / Provider Flow

- `src/domain/models/index.ts` defines supported providers and model lists.
- `src/state/services/providers/claude.ts` sends browser-side requests directly to Anthropic and returns streamed chunks in a normalized format.
- `src/state/services/providers/ollama.ts` talks to a local Ollama server, fetches model metadata, and streams chat responses.
- `src/state/services/providers/gemini.ts`, `openai-compat.ts`, and `webllm.ts` handle Gemini, OpenAI-compatible, and WebLLM providers respectively.
- `src/state/providers.svelte.ts` holds active provider/model selection state.
- `src/app/providers.ts` orchestrates provider operations (connecting, key management, stream dispatch).

## Persistence

- Chat trees, active root index, and folders (with document contents) are stored in `localStorage` under `chat-tree-store-svelte`.
- Open doc panels (`openDocs`) are transient — not persisted across reloads.
- Claude API keys are stored in browser `localStorage` via `src/state/services/providers/vault.ts`.
- The vault encrypts the key with `PBKDF2` + `AES-GCM` using a user-supplied password.

## Search

- `src/domain/search/index.ts` provides local in-browser search across prompts and responses.
- Search uses substring matching for short queries and trigram similarity for longer queries.
- Results can be scoped to the active chat or all chat roots.

## Working Rules

- Treat `localStorage` hydration and persistence changes carefully; avoid breaking existing saved chat state.
- Prefer small focused Svelte components.
- Use custom CSS tooltips (not Floating UI / bits-ui Tooltip) for anything rendered inside the Canvas View, since the CSS transform breaks Floating UI positioning.
- Do not confuse forks (new roots) with side chats (sibling branches). See "Branching Concepts" above.
