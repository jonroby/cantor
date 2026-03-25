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
- `src/App.svelte` owns the primary application state, hydration from `localStorage`, model selection, composer flow, search UI, branching-chat actions, and response streaming.
- `src/lib/chat/*` contains the domain logic for chat trees, model metadata, provider integrations, search, layout, seed data, and API-key storage.
- `src/lib/components/canvas/*` contains the visual canvas and node rendering for the conversation graph.
- `src/lib/components/ui/*` contains small reusable UI primitives such as buttons and inputs.
- `src/components/ui/*` contains shadcn-svelte primitives (sidebar, tooltip, sheet, etc.).

## Core Data Model

The central state shape is an `ExchangeMap` from `src/lib/chat/tree.ts`.

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
- Stored as `sessions[]` in `App.svelte`.

### Forks
- A **fork** copies the conversation from root down to a selected node into a **new root** within the same session.
- Forks appear as separate trees, navigable via the top header bar ("Main Chat", "Fork 1", "Fork 2", etc.).
- Created via `forkChat()` in `App.svelte`, triggered by the fork button (`+` icon) on exchange nodes.
- Forks have no depth restriction — you can fork a fork.
- Each fork is a separate `ExchangeMap` in the `roots[]` array.
- Prop: `canFork` / `onFork` on `ExchangeNodeData`.

### Side Chats
- A **side chat** is a sibling branch off an existing node within the same tree.
- Created implicitly by selecting a node and typing a new message (no dedicated button).
- Side chats are **1 level deep only** — a side chat node can have at most 1 child.
- Restriction enforced by `canCreateSideChats()` and `canAcceptNewChat()` in `src/lib/chat/tree.ts`.
- The "Side chats" button (branch icon) on a node **toggles visibility** of its side branches; it does not create them.
- Prop: `hasSideChildren` / `onToggleSideChildren` on `ExchangeNodeData`.
- A side chat can be **promoted** to become the main chat path via the promote button.
- Prop: `isSideRoot` / `canPromote` / `onPromote` on `ExchangeNodeData`.

## Rendering Flow

- `src/App.svelte` derives the active root, active exchange, hidden side branches, token usage, and search results.
- `src/lib/chat/layout.ts` converts the exchange tree into positioned canvas nodes and edges.
- `src/lib/components/canvas/Canvas.svelte` renders the pan/zoom canvas with CSS transforms (`translate` + `scale`). Has `overflow: hidden`.
- `src/lib/components/canvas/ExchangeNode.svelte` renders each exchange card with action buttons.
- Collapsed side branches are hidden from layout until expanded.

## UI Components

### Sidebar
- `src/lib/components/AppSidebar.svelte` — session list, new chat, delete session.
- Uses shadcn-svelte sidebar primitives from `src/components/ui/sidebar/`.
- Floats over content (gap always icon-width); does not push the main canvas.

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

- `src/lib/chat/models.ts` defines supported providers and the built-in Claude model list.
- `src/lib/chat/claude.ts` sends browser-side requests directly to Anthropic and returns streamed chunks in a normalized format.
- `src/lib/chat/ollama.ts` talks to a local Ollama server, fetches model metadata, and streams chat responses.
- `src/App.svelte` selects the provider implementation, streams output into the active exchange, and records token usage.

## Persistence

- Chat trees and active root index are stored in `localStorage` under `chat-tree-store-svelte`.
- Claude API keys are stored in browser `localStorage` via `src/lib/chat/vault.ts`.
- The vault encrypts the key with `PBKDF2` + `AES-GCM` using a user-supplied password.

## Search

- `src/lib/chat/search.ts` provides local in-browser search across prompts and responses.
- Search uses substring matching for short queries and trigram similarity for longer queries.
- Results can be scoped to the active chat or all chat roots.

## Working Rules For This Repo

- Preserve the current architecture unless there is a clear reason to extract logic from `src/App.svelte`.
- Put tree invariants and chat-structure behavior in `src/lib/chat/tree.ts`, not inline in components.
- Keep provider-specific networking in `src/lib/chat/claude.ts` and `src/lib/chat/ollama.ts`.
- Keep layout math in `src/lib/chat/layout.ts`.
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
