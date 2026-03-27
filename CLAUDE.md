# CLAUDE.md

## Purpose

This repository is a Svelte 5 + Vite single-page app for exploring branching chat conversations on a visual canvas. The app supports both Claude and Ollama models, stores chat state in the browser, and renders exchanges as a node graph with main-chat, side-chat, and fork branches.

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

## High-Level Architecture

The app is mostly client-side and centered around one top-level UI shell in `src/App.svelte`.

- `src/main.ts` mounts the Svelte app and loads global CSS.
- `src/App.svelte` is a thin orchestrator that wires together features and state; it does not own business logic directly.
- `src/state/*` contains reactive Svelte stores for chat state (`chats.svelte.ts`), document/folder state (`documents.svelte.ts`), provider/model state (`providers.svelte.ts`), and persistence (`persistence.svelte.ts`).
- `src/lib/tree/*` contains the core data structures and tree manipulation algorithms for chat exchanges.
- `src/lib/providers/*` contains provider-specific networking (Claude, Ollama, Gemini, OpenAI-compatible, WebLLM) and API-key vault.
- `src/lib/models/*` defines supported providers, model lists, and logo assets.
- `src/lib/search/*` provides local in-browser search across prompts and responses.
- `src/lib/validate-md/*` contains markdown validation utilities and tests.
- `src/features/*` contains feature-specific components (canvas, app-sidebar, chat-input, chat-header, chat-toolbar, model-palette, composer, search-dialog, docs-panel, code-editor, python-editor, drawing-board).
- `src/components/custom/*` contains small reusable UI primitives such as buttons and inputs.
- `src/components/shadcn/ui/*` contains shadcn-svelte primitives (sidebar, tooltip, sheet, etc.).

## Core Data Model

The central state shape is an `ExchangeMap` from `src/lib/tree/index.ts`.

- Each `Exchange` is a chat node with `id`, `parentId`, `prompt`, `response`, optional token counts, and optional model metadata.
- A hidden root anchor (`ROOT_ANCHOR_ID`) is the single tree root.
- The first child path is treated as the main chat.
- Additional siblings represent side chats.
- Tree utilities enforce structural invariants, add/remove nodes, promote side chats, and compute history/token totals.

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
- Each fork is a separate `ExchangeMap` in the `roots[]` array.
- Prop: `canFork` / `onFork` on `ExchangeNodeData`.

### Side Chats

- A **side chat** is a sibling branch off an existing node within the same tree.
- Created implicitly by selecting a node and typing a new message (no dedicated button).
- Side chats are **1 level deep only** — a side chat node can have at most 1 child.
- Restriction enforced by `canCreateSideChats()` and `canAcceptNewChat()` in `src/lib/tree/index.ts`.
- The "Side chats" button (branch icon) on a node **toggles visibility** of its side branches; it does not create them.
- Prop: `hasSideChildren` / `onToggleSideChildren` on `ExchangeNodeData`.
- A side chat can be **promoted** to become the main chat path via the promote button.
- Prop: `isSideRoot` / `canPromote` / `onPromote` on `ExchangeNodeData`.

## Canvas Panels

The canvas hosts several panel types alongside chat nodes. All panels are positioned by `src/features/canvas/layout.ts` and rendered via snippets in `Canvas.svelte`.

- **Document panels** (`DocsPanel.svelte`) — Markdown viewer/editor with KaTeX math support. Multiple panels can be open simultaneously, stacked vertically in the left column. Each has its own content and optional link to a folder file.
- **Code editor** (`CodeEditor.svelte`) — JavaScript editor.
- **Python editor** (`PythonEditor.svelte`) — Python editor.
- **Drawing board** (`DrawingBoard.svelte`) — Freeform drawing canvas.

Panels inside the canvas use `onwheel stopPropagation` to allow native scrolling without triggering canvas pan.

## Documents and Folders

- `ChatFolder` and `DocFile` types are defined in `src/lib/tree/index.ts`.
- Folders and their files are stored in `docState` in `src/state/documents.svelte.ts` and persisted to `localStorage`.
- Open doc panels are tracked as `openDocs[]` in `docState` — this is transient UI state (not persisted across reloads).
- Each open doc has an `id`, `content`, and optional `docKey` linking it to a folder file.
- When a doc is saved in the panel, changes persist back to `folders` if it has a `docKey`.
- Users open docs via the dropdown menu on a file in the sidebar (not by clicking the file directly).
- Uploading a file with a duplicate name auto-increments: `name (1).md`, `name (2).md`, etc.
- Closing a panel with unsaved edits shows a confirmation dialog.

## Rendering Flow

- `src/state/chats.svelte.ts` derives the active root, active exchange, hidden side branches, and token usage.
- `src/features/canvas/layout.ts` converts the exchange tree into positioned canvas nodes and edges. Also computes positions for all canvas panels (doc panels, code editors, drawing board).
- `src/features/canvas/Canvas.svelte` renders the pan/zoom canvas with CSS transforms (`translate` + `scale`). Has `overflow: hidden`.
- `src/features/canvas/ExchangeNode.svelte` renders each exchange card with action buttons.
- Collapsed side branches are hidden from layout until expanded.

## UI Components

### Sidebar

- `src/features/app-sidebar/AppSidebar.svelte` — session list, folder/doc management, new chat, delete session.
- Uses shadcn-svelte sidebar primitives from `src/components/shadcn/ui/sidebar/`.
- Floats over content (gap always icon-width); does not push the main canvas.
- Folders contain documents; each doc has a dropdown menu with Open, Rename, Download, Delete.

### Floating Action Buttons

- Fixed on the right side, vertically centered.
- Search, Fit view, Go to top, Go to active, Download chat.
- Use shadcn Tooltip components (positioned to the left).

### Exchange Node Actions

- Action buttons appear on hover in a pill-shaped overlay.
- Use custom CSS tooltips (`.action-tip-wrap` / `.action-tip`) because the canvas CSS transform breaks Floating UI tooltip positioning.
- Buttons: Fork (`+`), Side chats (branch icon, only if node has side children), Promote (up arrow, only on side roots), Delete (trash).

### Chat Header

- Fixed top-center, shows "Main Chat" or "Fork N" with navigation arrows.
- Auto-hides: visible on load and scroll-up, hides on scroll-down after 2s.
- Controlled by `headerVisible` state and `handleCanvasWheel()`.

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

## Working Rules For This Repo

- Preserve the current architecture: state in `src/state/`, domain logic in `src/lib/`, UI in `src/features/`.
- Put tree invariants and chat-structure behavior in `src/lib/tree/`, not inline in components.
- Keep provider-specific networking in `src/lib/providers/`.
- Keep layout math in `src/features/canvas/layout.ts`.
- Treat `localStorage` hydration and persistence changes carefully; avoid breaking existing saved chat state.
- Prefer small focused Svelte components and keep reusable logic in `src/lib`.
- When adding commands to docs or scripts, use `bun` syntax.
- Use custom CSS tooltips (not Floating UI / bits-ui Tooltip) for anything rendered inside the canvas, since the CSS transform breaks Floating UI positioning.
- Do not confuse forks (new roots) with side chats (sibling branches). See "Branching Concepts" above.

## Useful Commands

```bash
bun install
bun run dev
bun run check
bun run lint
bun run test
bun run build
```
