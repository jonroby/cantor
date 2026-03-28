# Architecture

## Philosophy

Four layers. Dependencies flow downward only. A layer may import from any layer above it, never below. This is the one rule that cannot be broken.

```
┌─────────────────────────────────────────────────┐
│  Domain                                         │
│  The primitives. Pure types, data structures,   │
│  and operations. No state, no effects.          │
├─────────────────────────────────────────────────┤
│  State                                          │
│  Reactive stores and effectful services.        │
│  Owns IO, persistence, networking, streaming.   │
├─────────────────────────────────────────────────┤
│  App                                            │
│  Orchestration. Sequences domain logic with     │
│  state mutations and service calls.             │
├─────────────────────────────────────────────────┤
│  View                                           │
│  Svelte components. Renders state, delegates    │
│  actions to App.                                │
└─────────────────────────────────────────────────┘
```

Each layer maps to one top-level directory:

```
src/
├── domain/        ← 1. Pure types and functions
├── state/         ← 2. Reactive stores + services
├── app/           ← 3. Orchestration
├── view/          ← 4. Presentation
└── assets/        ← Static files (outside the hierarchy)
```

## Why this order

Domain defines the concepts the app is built on. State holds the live instances of those concepts and talks to the outside world. App wires domain logic to state changes. View renders the result. Each layer only needs to know about the layers above it.

If you find yourself importing from a lower layer, the code is in the wrong place.

## Testability

The layering exists to make code testable. Domain functions are pure — test them with plain data, no mocks. State modules use `$state` but are still directly testable. App functions mock their state/service dependencies. View components are tested last and least — extract logic into App or Domain first.

If you need a mock to test a domain function, the function doesn't belong in domain.

## Layers

### Domain — `src/domain/`

The base primitives. These define the concepts and the rules about them. Given the same input, always the same output. No `$state`, no `$derived`, no `fetch`, no `localStorage`, no timers.

- `tree/` — `ChatTree`, `Exchange`, `ExchangeMap`, and all tree operations. The core data model.
- `models/` — provider definitions, model lists, logo assets. The vocabulary for LLM providers.
- `search/` — search algorithms (substring, trigram). How you find things in chat data.
- `validate-md/` — markdown validation. What valid markdown looks like.

### State — `src/state/`

Reactive stores and effectful services. Imports from Domain only.

**Stores** — reactive containers that hold data and expose read/write access:

- `chats.svelte.ts` — chat list, active chat, active exchange. Getters and setters.
- `documents.svelte.ts` — folders, files, open doc panels.
- `providers.svelte.ts` — active model, context length, API keys. State only.

**Services** (`state/services/`) — effectful utilities that talk to the outside world:

- `services/streams/` — XState actors for streaming LLM responses.
- `services/database.svelte.ts` — localStorage persistence.
- `services/io.svelte.ts` — file import/export. Pure validation logic lives in `io.ts`.
- `services/providers/` — provider-specific HTTP clients and vault.

Stores do not sequence multi-step operations. Services handle IO but do not orchestrate domain + state together. That's App's job.

### App — `src/app/`

Orchestration. Each function represents a user action that coordinates domain logic, state updates, and service calls. Imports from Domain and State.

- `chat-actions.ts` — delete, promote, copy, build exchange node view-models.
- `providers.ts` — connect providers, manage keys, dispatch streams.

App is the only place where domain + state + services are composed together.

### View — `src/view/`

Svelte components. Renders state, handles interactions, delegates to App. Imports from all layers above.

- `classic/` — linear chat interface (default view).
- `canvas/` — visual node graph on a pan/zoom canvas.
- `shared/` — components used by both views: `ChatInput`, `AppSidebar`, `SearchDialog`.
- `features/` — self-contained feature modules: model-palette, docs-panel, code-editor, python-editor, drawing-board.
- `components/` — reusable UI primitives (custom buttons/inputs, shadcn-svelte).
- `routes/` — hash-based router.
- `css/` — global styles.

Views can read state directly and call App functions. They should not sequence multiple state updates — that belongs in App. Pure domain queries (e.g., `getChildExchanges`) are fine for rendering.

## Where things go

| You're writing...                                              | It goes in...     |
| -------------------------------------------------------------- | ----------------- |
| A function that takes data and returns data                    | `domain/`         |
| A reactive `$state` or `$derived` store                        | `state/`          |
| A function that calls `fetch`, `localStorage`, or browser APIs | `state/services/` |
| A function that sequences domain + state + services            | `app/`            |
| A Svelte component                                             | `view/`           |

If you're not sure: does it need effects? No -> Domain. Does it sequence multiple steps? Yes -> App. Does it talk to the outside world? Yes -> Services.

## Core Data Model

`ChatTree` and `Exchange` from `src/domain/tree/`.

- `ChatTree` bundles `rootId: string | null` with an `ExchangeMap`. Always passed together.
- Each `Exchange` has `id`, `parentId`, `childIds`, `prompt`, `response`, `model`, `provider`, `createdAt`.
- `response` is `null` until the model responds. This distinguishes "no response yet" from "empty response."
- The exchange with `parentId === null` is the root. `rootId` must point to it.
- First child path (`childIds[0]` at each node) is the main chat.
- Additional siblings are side chats.
- Tree utilities enforce invariants: parent/child consistency, single root, reachability, side-chat depth constraint (max 1 child).

## Branching Concepts

Three distinct concepts. Do not confuse them.

**Sessions** — top-level chat conversations in the sidebar. Each has its own tree(s). Stored in `chatState`.

**Copies** — copy a conversation path into a new chat. `copyPath` (domain) produces a deep copy of the root-to-node path with new IDs. `copyToNewChat` (state) wraps it into a new `Chat` and switches to it. No depth restriction.

**Side Chats** — sibling branches off an existing node within the same tree. Created by selecting a node and typing. One level deep only — a side chat node can have at most 1 child. Can be promoted to become the main chat path.

## Persistence

- Chat trees and folders are stored in `localStorage` under `chat-tree-store-svelte`.
- Open doc panels are transient — not persisted across reloads.
- API keys are encrypted with `PBKDF2` + `AES-GCM` in the vault.

## UI Notes

- Canvas exchange node actions use custom CSS tooltips (`.action-tip-wrap`), not Floating UI — the canvas CSS transform breaks Floating UI positioning.
- Classic chat message actions appear inline, not as hover overlays.
- Sidebar pushes the main content area when open.
