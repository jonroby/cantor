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

The app has four layers. Each layer can only depend on layers above it. Dependencies flow downward, never upward.

```
┌─────────────────────────────────────────────────┐
│  Domain (pure)                                  │
│  Types, data structures, tree operations        │
│  No state. No side effects. No imports from     │
│  lower layers. Fully testable with plain data.  │
├─────────────────────────────────────────────────┤
│  State + Services (effects)                     │
│  Reactive stores, persistence, networking,      │
│  streaming. Owns IO and browser APIs.           │
│  Imports from Domain only.                      │
├─────────────────────────────────────────────────┤
│  App (orchestration)                            │
│  Use cases that sequence domain logic with      │
│  state mutations and service calls.             │
│  "What happens when the user does X."           │
│  Imports from Domain, State, and Services.      │
├─────────────────────────────────────────────────┤
│  View (presentation)                            │
│  Svelte components, routes, layout.             │
│  Renders state, calls App functions.            │
│  Imports from all layers above.                 │
└─────────────────────────────────────────────────┘
```

### Domain — `src/domain/`, `src/lib/`

Pure functions and types. Given the same input, always the same output. No reactive state (`$state`, `$derived`), no `fetch`, no `localStorage`, no timers, no randomness outside of explicitly passed parameters. The only acceptable import is TypeScript types from other domain modules.

- `src/domain/tree/` — `ChatTree`, `Exchange`, `ExchangeMap`, and all tree operations (add, remove, promote, fork, validate, query). This is the core data model.
- `src/lib/models/` — provider definitions, model lists, logo assets. Static data.
- `src/lib/search/` — search algorithms (substring, trigram). Pure functions over `Chat[]`.
- `src/lib/validate-md/` — markdown validation. Pure string processing.

**Test rule:** Domain tests need no mocks. If you need a mock to test something in domain, it doesn't belong in domain.

### State + Services — `src/state/`, `src/services/`

This is where effects live. Reactive Svelte stores, browser APIs, network calls, persistence.

- `src/state/chats.svelte.ts` — reactive chat state: the list of chats, active chat index, active exchange. Simple getters and setters. No orchestration logic.
- `src/state/documents.svelte.ts` — reactive document/folder state.
- `src/state/providers.svelte.ts` — active provider/model selection, context length, API key state.
- `src/services/streams/` — XState actors for streaming LLM responses. Manages stream lifecycle, writes response chunks into state.
- `src/services/database.svelte.ts` — localStorage persistence (read/write the full app state).
- `src/services/io.svelte.ts` — file import/export (JSON chat files, markdown docs, zip folders).
- `src/services/providers/` — provider-specific HTTP clients (Claude, Ollama, Gemini, OpenAI-compatible, WebLLM, vault).

**Rule:** State modules are reactive containers. They hold data and expose read/write access. They do not sequence multi-step operations — that's the App layer's job. Services are effectful utilities that talk to the outside world.

### App — `src/app/`

Orchestration. Each function in this layer represents a user-initiated action that requires coordinating domain logic, state updates, and service calls.

Examples of what belongs here:
- `deleteExchange(id, mode)` — calls the domain delete function, cancels affected streams, updates state, redirects the active exchange if needed.
- `promoteExchange(id)` — calls domain promote, updates state, optionally resets UI measurements.
- `submitPrompt(prompt)` — creates an exchange via domain, updates state, starts a stream via services.
- `getExchangeNodeData(id)` — builds the view-model for an exchange node by reading domain data and service state (e.g., `isStreaming`).

**Rule:** App functions are the only place where domain + state + services are composed together. Views should not orchestrate multi-step operations themselves — they call an App function. If you're writing `replaceActiveExchanges(...)` followed by `setActiveExchangeId(...)` followed by `cancelStreamsForExchanges(...)` inside a Svelte component, that logic belongs in App instead.

### View — `src/views/`, `src/features/`, `src/routes/`, `src/components/`

Svelte components. They render state, handle user interactions, and delegate actions to the App layer.

- `src/views/classic/` — Classic View. `ChatView.svelte`, `ChatMessage.svelte`, side pane logic. Everything specific to the linear chat experience.
- `src/views/canvas/` — Canvas View. `CanvasView.svelte`, `ExchangeNode.svelte`, `Canvas.svelte`, `layout.ts`. Everything specific to the node graph experience.
- `src/views/shared/` — Components used by both views: `ChatInput`, `AppSidebar`, `SearchDialog`.
- `src/features/` — Self-contained feature modules with their own logic and UI. These are complex components that views compose but don't own: model-palette, docs-panel, code-editor, python-editor, drawing-board. A feature never imports from a view.
- `src/components/custom/` — Small reusable UI primitives (buttons, inputs).
- `src/components/shadcn/ui/` — shadcn-svelte primitives (sidebar, tooltip, sheet).
- `src/routes/` — Router only. Picks which view to render based on the URL hash.

**Rule:** View components can read state directly (via `$derived`) and call App functions. They should not import domain mutation functions directly or sequence multiple state updates. Pure domain queries (e.g., `getChildExchanges`) are fine to call from views for rendering purposes. If a component is only used by one view, it lives in that view's folder. Only move it to `shared/` when both views actually use it.

### Where things go — decision guide

| You're writing... | It goes in... | Because... |
|---|---|---|
| A function that takes data and returns data | Domain | No effects needed |
| A reactive `$state` or `$derived` store | State | It's reactive container |
| A function that calls `fetch`, `localStorage`, or browser APIs | Services | It's IO |
| A function that calls domain + updates state + triggers services | App | It's orchestration |
| A Svelte component | View | It renders |
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
- Prop: `canFork` / `onFork` on `ExchangeNodeData`.

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

The app has two views that share the same underlying data model, state stores, and operations. Routing is hash-based via `src/routes/router.svelte.ts`: `#/` is Classic View (default), `#/canvas` is Canvas View.

### Shared Layer

Both views consume:

- **State**: `src/state/chats.svelte.ts` (active chat, active exchange), `src/state/documents.svelte.ts`, `src/state/providers.svelte.ts`.
- **Domain logic**: `src/domain/tree/index.ts` — tree queries for rendering (child lookups, main chat path traversal).
- **App operations**: `src/app/` — `deleteExchange()`, `promoteExchange()`, `forkChat()`, `getExchangeNodeData()`. Both views call these same functions.
- **Shared view components**: `src/views/shared/` — `ChatInput`, `AppSidebar`, `SearchDialog`.

### Classic View (`src/views/classic/`)

A traditional linear chat interface. Default route (`#/`).

- `ChatView.svelte` — the page shell: main pane, side pane, chat input anchor, delete dialog.
- `ChatMessage.svelte` — renders an exchange as a prompt/response pair with provider logo, action buttons, and rich text (markdown + KaTeX).
- **Main pane**: Scrollable message list rendering the main chat path (first-child traversal from root).
- **Side pane**: Opens to the right when a node's side children are toggled. Shows one branch at a time with prev/next navigation and a "new branch" action.
- **Chat input**: Anchored at the bottom, shifts to follow the focused pane (main or side).
- **Focus model**: Clicking a pane sets it as focused; `activeExchangeId` tracks the tail of the focused pane.

### Canvas View (`src/views/canvas/`)

A visual node graph on a pan/zoom canvas.

- `CanvasView.svelte` — the page shell: canvas, floating actions, delete dialog.
- `Canvas.svelte` — renders the pan/zoom canvas with CSS transforms (`translate` + `scale`). Has `overflow: hidden`.
- `ExchangeNode.svelte` — renders each exchange card with action buttons on hover.
- `layout.ts` — converts the exchange tree into positioned canvas nodes and edges. Also computes positions for canvas panels.
- Collapsed side branches are hidden from layout until expanded.
- Hosts features as canvas panels (docs-panel, code-editor, python-editor, drawing-board).

Panels inside the canvas use `onwheel stopPropagation` to allow native scrolling without triggering canvas pan.

## Documents and Folders

- `ChatFolder` and `DocFile` types are defined in `src/domain/tree/index.ts`.
- Folders and their files are stored in `docState` in `src/state/documents.svelte.ts` and persisted to `localStorage`.
- Open doc panels are tracked as `openDocs[]` in `docState` — this is transient UI state (not persisted across reloads).
- Each open doc has an `id`, `content`, and optional `docKey` linking it to a folder file.
- When a doc is saved in the panel, changes persist back to `folders` if it has a `docKey`.
- Users open docs via the dropdown menu on a file in the sidebar (not by clicking the file directly).
- Uploading a file with a duplicate name auto-increments: `name (1).md`, `name (2).md`, etc.
- Closing a panel with unsaved edits shows a confirmation dialog.

## UI Component Notes

- **Sidebar** (`src/views/shared/AppSidebar.svelte`) — pushes the main content area when open.
- **Chat input** (`src/views/shared/ChatInput.svelte`) — in Classic View, anchors to the focused pane. In Canvas View, overlays the bottom of the canvas.
- **Canvas exchange node actions** — use custom CSS tooltips (`.action-tip-wrap` / `.action-tip`), not Floating UI, because the canvas CSS transform breaks Floating UI positioning.
- **Classic chat message actions** — appear inline rather than as hover overlays.

## Model / Provider Flow

- `src/lib/models/index.ts` defines supported providers and model lists.
- `src/lib/providers/claude.ts` sends browser-side requests directly to Anthropic and returns streamed chunks in a normalized format.
- `src/lib/providers/ollama.ts` talks to a local Ollama server, fetches model metadata, and streams chat responses.
- `src/lib/providers/gemini.ts`, `openai-compat.ts`, and `webllm.ts` handle Gemini, OpenAI-compatible, and WebLLM providers respectively.
- `src/state/providers.svelte.ts` manages the active provider/model selection and streams output into the active exchange.

## Persistence

- Chat trees, active root index, and folders (with document contents) are stored in `localStorage` under `chat-tree-store-svelte`.
- Open doc panels (`openDocs`) are transient — not persisted across reloads.
- Claude API keys are stored in browser `localStorage` via `src/lib/providers/vault.ts`.
- The vault encrypts the key with `PBKDF2` + `AES-GCM` using a user-supplied password.

## Search

- `src/lib/search/index.ts` provides local in-browser search across prompts and responses.
- Search uses substring matching for short queries and trigram similarity for longer queries.
- Results can be scoped to the active chat or all chat roots.

## Working Rules

- Treat `localStorage` hydration and persistence changes carefully; avoid breaking existing saved chat state.
- Prefer small focused Svelte components.
- Use custom CSS tooltips (not Floating UI / bits-ui Tooltip) for anything rendered inside the Canvas View, since the CSS transform breaks Floating UI positioning.
- Do not confuse forks (new roots) with side chats (sibling branches). See "Branching Concepts" above.
