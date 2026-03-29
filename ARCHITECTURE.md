# Architecture

## Purpose

This codebase is organized to make code placement obvious.

The goal is:

- clear ownership
- predictable imports
- minimal ambiguity for both humans and LLMs

## Top-Level Areas

```text
src/
├── domain/
├── lib/
├── state/
├── external/
├── app/
└── view/
```

Each area has one job:

- `domain` = app-specific business rules
- `lib` = generic pure support code
- `state` = app runtime state
- `external` = persistence and outside-world boundaries
- `app` = orchestration
- `view` = UI and presentation logic

## Dependency Rule

Dependencies flow one way only.

Allowed imports:

- `domain` imports no app-specific areas
- `lib` imports no app-specific areas
- `state` may import `domain` and `lib`
- `external` may import `domain` and `lib`
- `app` may import `domain`, `lib`, `state`, and `external`
- `view` may import `app` and other `view` modules

Forbidden imports:

- `domain` must not import `state`, `external`, `app`, or `view`
- `lib` must not import `domain`, `state`, `external`, `app`, or `view`
- `state` must not import `external`, `app`, or `view`
- `external` must not import `state`, `app`, or `view`
- `app` must not import `view`
- `view` must not import `domain`, `lib`, `state`, or `external`

This means:

- `state` and `external` are siblings
- `app` is the only place that coordinates them
- `view` talks to `app`, not directly to the lower layers

## Public Surface Rule

Cross-area module APIs should stay small.

- many private functions inside a module are fine
- many exported functions across `src` area boundaries are not fine
- exported cross-area APIs should be minimal and intentional
- implementation detail helpers should stay private inside the module or folder that owns them

The goal is real isolation, not fake isolation.

If one area exports a large grab bag of functions and another area imports them freely, the boundary is weak even if the folder structure looks clean.

Prefer:

- small feature-shaped public APIs
- richer private implementation behind those APIs
- concern-based public namespaces at area barrels

Avoid:

- large public toolboxes
- exporting low-level primitives when a higher-level feature API would do

## Barrel Organization Rule

Each top-level `src` area has a public barrel at its root.

Cross-area imports must:

- go through that root barrel
- use a namespace import

Examples:

- `import * as app from '@/app'`
- `import * as external from '@/external'`
- `import * as state from '@/state'`

Call sites should preserve ownership:

- `app.chat.submitPrompt()`
- `app.documents.performOpenDocument()`
- `app.files.uploadFolder()`
- `external.files.validateChatUpload()`

This rule is primarily about organization.

The goal is to make ownership obvious at the call site and reduce ambiguity for both humans and LLMs.

Many private helpers inside a module are fine.
Many flat named imports across areas are not.

Use the shortest namespace chain that still preserves ownership clarity.

## Ownership

### Domain

`domain` defines what the app means.

It owns:

- conversation tree rules
- branching invariants
- copy/promote/delete semantics
- app-specific pure transformations

It does not own:

- generic helpers
- persistence logic
- browser APIs
- UI concepts

### Lib

`lib` holds generic pure support code.

It owns:

- reusable text helpers
- generic parsing
- generic transforms
- generic support logic that could make sense in many apps

It does not own:

- business rules
- state
- side effects
- orchestration

### State

`state` is app runtime state.

This is the in-memory state the app owns while running.

It owns:

- chats in memory
- active selections
- provider selection state
- document state in memory
- shared runtime state used by multiple workflows

It does not own:

- persistence calls
- network calls
- file APIs
- browser boundary code
- workflows

### External

`external` is for boundaries outside the in-memory app.

It owns:

- localStorage persistence
- future SQLite persistence
- provider HTTP clients
- stream transport
- browser APIs at the app boundary
- crypto/vault
- file import/export
- worker bridges

It does not own:

- workflows
- runtime app state
- UI concepts

### App

`app` is the orchestration layer.

It owns:

- user actions
- workflows
- multi-step operations
- sequencing domain rules with state updates
- sequencing state updates with external calls

It is the only layer that coordinates across architectural areas.

### View

`view` is the UI layer.

It owns:

- Svelte components
- presentation logic
- layout
- ephemeral UI state
- UI-only concepts such as panels, dialogs, tabs, focus, and display shaping

It does not own:

- persistence
- provider/network clients
- cross-layer workflows

## Placement Rules

Put code in `domain` when it is:

- app-specific
- pure
- part of the business meaning of the app

Put code in `lib` when it is:

- generic
- pure
- useful outside this app’s business model

Put code in `state` when it is:

- app-owned runtime state
- shared in-memory state
- not just a local UI concern

Put code in `external` when it:

- crosses the app boundary
- talks to storage, network, browser APIs, files, crypto, or workers

Keep the exported surface small.
`external` should expose the smallest feature-shaped API that `app` needs, not every low-level browser or transport primitive.

Put code in `app` when it:

- coordinates multiple steps
- combines rules, state, and boundaries
- represents a workflow or user action

Keep the exported surface small.
`app` should expose focused actions and view-facing queries, not a grab bag of lower-layer passthroughs.

Put code in `view` when it:

- exists for presentation
- is UI-only
- is local interaction logic

## Key Distinctions

### Domain vs Lib

- `domain` is app-specific meaning
- `lib` is generic support code

If code would still make sense in many unrelated apps, it probably belongs in `lib`, not `domain`.

### State vs View

- `state` is app runtime state
- `view` is UI logic and presentation state

If the state is the app’s working memory, it belongs in `state`.
If it only exists to make the interface work, it belongs in `view`.

### State vs External

- `state` is in-memory app state
- `external` is persistence and integration boundaries

The app may load state from `external`, but `state` does not own boundary logic.

### Domain vs External

- `domain` defines business rules
- `external` defines storage and integration rules

If a rule should still exist after replacing localStorage with SQLite, it is probably a domain rule.

## Functional Bias

This codebase should be functionally biased, not functionally dogmatic.

- `domain` should be strongly functional
- `lib` should be strongly functional
- `external` should be thin and explicit
- `app` should orchestrate in clear steps
- `state` should stay simple
- `view` should stay pragmatic

## More Detail

See:

- [domain.md](/Users/jonroby/ai/superset-svelte/architecture/domain.md)
- [lib.md](/Users/jonroby/ai/superset-svelte/architecture/lib.md)
- [state.md](/Users/jonroby/ai/superset-svelte/architecture/state.md)
- [external.md](/Users/jonroby/ai/superset-svelte/architecture/external.md)
- [app.md](/Users/jonroby/ai/superset-svelte/architecture/app.md)
- [view.md](/Users/jonroby/ai/superset-svelte/architecture/view.md)
