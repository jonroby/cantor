# CLAUDE.md

## Purpose

This repository is a Svelte 5 + Vite single-page app for exploring branching chat conversations on a visual canvas. The app supports both Claude and Ollama models, stores chat state in the browser, and renders exchanges as a node graph with main-chat and side-chat branches.

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
- `src/lib/components/flow/*` contains the visual canvas and node rendering for the conversation graph.
- `src/lib/components/ui/*` contains small reusable UI primitives such as buttons and inputs.

## Core Data Model

The central state shape is an `ExchangeMap` from `src/lib/chat/tree.ts`.

- Each `Exchange` is a chat node with `id`, `parentId`, `prompt`, `response`, optional token counts, and optional model metadata.
- A hidden root anchor (`ROOT_ANCHOR_ID`) is the single tree root.
- The first child path is treated as the main chat.
- Additional siblings represent side chats.
- Tree utilities enforce structural invariants, add/remove nodes, promote side chats, and compute history/token totals.

## Rendering Flow

- `src/App.svelte` derives the active root, active exchange, hidden side branches, token usage, and search results.
- `src/lib/chat/layout.ts` converts the exchange tree into positioned canvas nodes and edges.
- `src/lib/components/flow/Canvas.svelte` renders the pan/zoom canvas.
- `src/lib/components/flow/ExchangeNode.svelte` renders each exchange card.
- Collapsed side branches are hidden from layout until expanded.

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

## Useful Commands

```bash
bun install
bun run dev
bun run check
bun run lint
bun run test
bun run build
```
