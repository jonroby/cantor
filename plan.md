# Plan

## Goal

Reorganize the codebase so the architecture is explicit, enforceable, and hard for LLMs to misuse.

This is primarily about organization and boundaries, not hiding implementation details in a strict OO sense.

## Target Top-Level Structure

```text
src/
├── domain/
├── lib/
├── state/
├── external/
├── app/
└── view/
```

## Core Rules

### 1. Cross-area imports go through root barrels only

If code in one top-level source area imports another top-level source area, it must import only from the root barrel:

- `@/domain`
- `@/lib`
- `@/state`
- `@/external`
- `@/app`
- `@/view`

Deep cross-area imports are forbidden.

Deep imports are allowed only within the same top-level area.

### 2. Public APIs are namespaced and organizational

Cross-area usage should read like:

```ts
app.chat.submitPrompt();
app.documents.openDocument();
external.files.importChatFile();
state.chats.getActiveChat();
```

Not:

```ts
import { submitPrompt } from '@/app';
import { getActiveChat } from '@/state';
```

The namespace is for organizational clarity.

### 3. Public APIs should be small

Many private functions inside a module is fine.

Many exported cross-area functions is not fine.

The boundary should expose a small number of intentional, concern-shaped submodules and functions.

### 4. View talks only to app

`src/view/**` may import:

- `@/app`
- other `@/view` modules
- third-party packages

`view` must not import:

- `@/state`
- `@/external`
- `@/domain`
- `@/lib`

### 5. App is not a forwarding layer

`app` may depend on `domain`, `lib`, `state`, and `external`.

But `app` should not simply mirror those layers.

Bad:

```ts
export const docState = state.documents.docState;
export const loadFromStorage = external.persistence.loadFromStorage;
```

Good:

```ts
app.chat.getActiveChat();
app.chat.submitPrompt();
app.documents.getFolders();
app.documents.openDocument();
app.providers.getPaletteState();
```

Direct lower-layer re-exports are allowed only sparingly and intentionally.

### 6. State is app runtime state

`state` is the app's in-memory runtime state.

It is not:

- UI-only view state
- persistence/storage code
- browser boundary code

### 7. External owns boundary mechanics

`external` owns:

- localStorage / persistence
- browser file APIs
- streams
- provider API calls
- other browser/platform boundaries

`app` should orchestrate workflows, not own low-level browser/file mechanics.

### 8. Domain is app-specific meaning

`domain` is not “all pure code.”

`domain` is app-specific business meaning and rules.

Generic pure helpers belong in `lib`.

## Current Direction

These parts are already in place:

- [x] top-level source areas exist
- [x] root public barrels exist
- [x] cross-area imports are checked programmatically
- [x] namespace-style cross-area imports are enforced
- [x] approved public submodules are whitelisted
- [x] `view -> app only` is enforced mechanically
- [x] public API contract snapshots exist under `src/tests/contracts`
- [x] canonical mock factories exist under `src/tests/mocks`
- [x] `external` has no `svelte` filenames
- [x] non-component `svelte` test filenames were cleaned up where possible

## Current Constraints

- [x] Some runtime modules must remain `.svelte.ts` because they use Svelte runes.

Current required rune-backed files:

- `src/state/chats.svelte.ts`
- `src/state/documents.svelte.ts`
- `src/state/providers.svelte.ts`
- `src/view/routes/router.svelte.ts`
- `src/view/components/shadcn/ui/sidebar/context.svelte.ts`

## Current Problems

### 1. `app` still exposes lower-layer structure

The biggest current mismatch is that some `app` modules still forward lower-layer APIs instead of exposing app-shaped APIs.

Example:

- `src/app/runtime/index.ts`

This currently exports state and external details such as:

- `chatState`
- `docState`
- `providerState`
- `loadFromStorage`
- `saveToStorage`

That is not the target architecture.

### 2. `app` still has compatibility-style flat exports

- `src/app/index.ts`

This still includes flat re-exports that weaken the namespace rule and make it easier to bypass the intended organization.

### 3. Some feature barrels still flatten too much

Several `app` feature barrels still use `export *` or expose lower-layer concepts too directly.

That makes the app surface too loose.

## What We Are Trying To Achieve In `app`

The `app` layer should expose app-shaped feature APIs.

That means feature namespaces like:

- `app.chat`
- `app.documents`
- `app.providers`
- `app.files`
- `app.search`

Within those namespaces, exports should be app concepts:

- commands
- queries
- view-facing state snapshots or accessors where needed

Not disguised layer forwarding.

## Immediate Next Steps

### Step 1. Audit `src/app/**` as a public API surface

For each public `app` namespace:

- list what it exports
- mark each export as:
  - app-shaped
  - thin-but-acceptable
  - bad lower-layer forwarding

Priority:

- `src/app/runtime/index.ts`
- `src/app/index.ts`
- `src/app/chat/index.ts`
- `src/app/documents/index.ts`
- `src/app/providers/index.ts`
- `src/app/files/index.ts`

Status:

- [ ] not done
- [ ] `app.runtime` still needs to be audited and reduced
- [ ] root `app` surface still needs semantic cleanup, even though structural barrel rules are in place

### Step 2. Remove `app.runtime` as a lower-layer facade

Replace broad `app.runtime.*` forwarding with feature-oriented exports in:

- `app.chat`
- `app.documents`
- `app.providers`
- `app.persistence` if needed
- `app.files`

The goal is to eliminate exports like:

- `app.runtime.docState`
- `app.runtime.chatState`
- `app.runtime.providerState`

Status:

- [ ] not done

### Step 3. Move view call sites off `app.runtime.*`

Update `src/view/**` to use feature APIs instead of `app.runtime`.

Examples of the intended direction:

- `app.chat.getActiveChat()`
- `app.chat.getActiveExchanges()`
- `app.chat.selectActiveExchange()`
- `app.documents.getFolders()`
- `app.documents.updateOpenDocumentContent()`
- `app.providers.getState()`
- `app.providers.selectModel()`

Exact names can be decided during refactor, but they should be app-shaped and grouped by feature.

Status:

- [ ] not done

### Step 4. Remove flat compatibility exports from `src/app/index.ts`

Once view and tests stop relying on them:

- remove root-level flat exports
- keep root-level namespaces only

Status:

- [ ] partially done structurally
- [ ] not done semantically

### Step 5. Tighten the checker for `app`

Status:

- [ ] not done

## Next Session Start Here

When resuming, start fresh with an `app`-only semantic audit.

Do not start by moving files blindly.

Start with:

1. Audit the current public `app` surface.
2. List every export in:
   - `src/app/index.ts`
   - `src/app/runtime/index.ts`
   - `src/app/chat/index.ts`
   - `src/app/documents/index.ts`
   - `src/app/providers/index.ts`
   - `src/app/files/index.ts`
3. Classify each export as:
   - app-shaped
   - thin-but-acceptable
   - bad lower-layer forwarding
4. Identify all current `app.runtime.*` usages in `src/view/**` and tests.
5. Replace the worst `app.runtime` pass-throughs first:
   - `chatState`
   - `docState`
   - `providerState`
   - `loadFromStorage`
   - `saveToStorage`
6. Move those usages onto feature-oriented `app.*` APIs.
7. Only after that, remove or shrink `app.runtime`.

The immediate target is not “finish all of app.”

The immediate target is:

- make `app.runtime` visibly smaller
- reduce direct exposure of `state` and `external` through `app`
- keep the repo green after each small step

## Completed So Far

### Structural Boundaries

- [x] Root barrels are namespace-only for:
  - `src/domain`
  - `src/lib`
  - `src/state`
  - `src/external`
  - `src/app`
  - `src/view`
- [x] Cross-area imports must go through root barrels
- [x] Cross-area imports must use namespace imports
- [x] Approved public submodules are explicit and checked
- [x] `view -> app only` is enforced

### Public API Contracts And Mocks

- [x] `scripts/check-public-api-contracts.mjs` exists
- [x] `check:contracts` is wired into `package.json`
- [x] contract snapshots exist for each public barrel
- [x] canonical mock factories exist under `src/tests/mocks`
- [x] several handwritten root-barrel mocks were migrated onto the canonical mock factories

### Naming Cleanup

- [x] `external` no longer contains any `svelte` filenames
- [x] non-component `.svelte.test.ts` filenames under `src` were renamed
- [x] non-rune helper filenames like `is-mobile.ts` no longer carry `svelte`
- [x] rune-backed modules that require `.svelte.ts` were identified explicitly

## Future Enforcement / Todo

- [ ] Strict namespace checks with AST guarantees instead of regex/string matching
- [ ] Strict whitelist of allowed node/module imports per top-level area or folder
- [ ] Strong consistency guarantees between public APIs and test contract/mock modules
- [ ] Dead code elimination pass
- [ ] Agents/skills file for every major module or area

## Open Question

- [ ] Whether every single function should have a comment
  - Current judgment: probably not.
  - Better rule: comments on non-obvious functions and non-obvious blocks, not blanket comments everywhere.

Add checks so `src/app/**` is discouraged from:

- directly re-exporting lower-layer state objects
- directly re-exporting external functions
- exposing unapproved public submodules

This should be done after the app surface is cleaned up enough that the checker can enforce the rule without noise.

## Deferred For Later

These are real concerns, but not the next step:

- whether the import checker should use regex, manual scanning, or AST parsing
- final restrictions on `external -> state`
- types folder strategy
- deeper cleanup of `external` public surface

## Public API Contracts

Add explicit contract fixtures for each top-level public barrel under `src/tests/contracts/`.

Examples:

- `src/tests/contracts/app.ts`
- `src/tests/contracts/domain.ts`
- `src/tests/contracts/lib.ts`
- `src/tests/contracts/state.ts`
- `src/tests/contracts/external.ts`

These contracts should define the allowed public namespace/member shape for each root module.

The goal is:

- one source of truth for allowed public API
- small intentional public surfaces
- no silent API growth
- no smuggling new namespaces or members into a barrel

Then add a check that enforces a 1:1 mapping between:

- actual exported root public API
- contract fixture API

If mocks are needed later, they should be derived from the same contract shape instead of becoming a second source of truth.

## Current Working Principle

Do not invent new architecture during cleanup.

Use the current target:

- root barrels only
- namespace imports only
- `view -> app only`
- `app` exports app-shaped APIs
- public surfaces stay small
