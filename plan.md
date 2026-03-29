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
- [x] import boundary checks use TypeScript AST, not source-regex parsing
- [x] namespace-style cross-area imports are enforced
- [x] approved public submodules are whitelisted
- [x] `view -> app only` is enforced mechanically
- [x] public API contract snapshots exist under `src/tests/contracts`
- [x] canonical mock factories exist under `src/tests/mocks`
- [x] canonical mock factories are checked against public API contracts
- [x] top-level public barrels have required nested public API tests
- [x] `external` has no `svelte` filenames
- [x] non-component `svelte` test filenames were cleaned up where possible
- [x] `src/**` tests are `*.test.ts` only
- [x] `app.runtime` has been deleted
- [x] view bootstrap/save flows go through `app.bootstrap`

## Current Constraints

- [x] Some runtime modules must remain `.svelte.ts` because they use Svelte runes.

Current required rune-backed files:

- `src/state/chats.svelte.ts`
- `src/state/documents.svelte.ts`
- `src/state/providers.svelte.ts`
- `src/view/routes/router.svelte.ts`
- `src/view/components/shadcn/ui/sidebar/context.svelte.ts`

## Proven Checks

These checks have been deliberately tripped and confirmed to fail when violated:

- [x] `check:imports`
- [x] `check:contracts`

Current confidence:

- [x] top-level module boundary import enforcement is rock solid
- [x] root public API drift is strongly guarded
- [x] root mock/test drift is strongly guarded
- [ ] third-party package import allowlists are not enforced yet
- [ ] same-area internal import discipline is intentionally still permissive
- [ ] semantic misuse through legal imports is still possible

## Current Problems

### 1. `app` still exposes thin forwarding surfaces

The biggest current mismatch is no longer structural. It is semantic.

Some `app` namespaces still forward lower-layer APIs too directly instead of exposing app-shaped operations.

Examples to review:

- `src/app/chat/index.ts`
- `src/app/documents/index.ts`
- `src/app/providers/index.ts`
- `src/app/files/index.ts`
- `src/app/bootstrap/index.ts`

What has already improved:

- [x] `app.runtime` is gone
- [x] root-level compatibility files under `src/app/` are gone
- [x] duplicate `perform*` command aliases were removed from `app.chat` and `app.documents`
- [x] duplicate `init` alias was removed from `app.providers`
- [x] Canvas code was removed entirely, which reduced app/view compatibility noise

Important correction:

- [ ] `app.search` should remain a distinct namespace
- [ ] the attempted fold of `search` into `app.chat` was a mistake and should be reverted

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

### Step 1. Audit `src/app/**` as a semantic public API surface

For each public `app` namespace:

- list what it exports
- mark each export as:
  - app-shaped
  - thin-but-acceptable
  - bad lower-layer forwarding

Priority:

- `src/app/chat/index.ts`
- `src/app/documents/index.ts`
- `src/app/providers/index.ts`
- `src/app/files/index.ts`
- `src/app/bootstrap/index.ts`

Status:

- [ ] not done
- [x] `app.runtime` has been removed
- [x] fake root-level `src/app/*.ts` compatibility files have been removed
- [x] obvious duplicate alias exports have been removed
- [ ] `app.search` needs to be restored as its own namespace
- [ ] root `app` surface still needs semantic cleanup, even though structural barrel rules are in place

### Step 1a. Restore `app.search`

`search` is a real feature concern, not just arbitrary forwarding.

Required restore work:

- re-add `src/app/search/index.ts`
- re-export `search` from `src/app/index.ts`
- move `SearchResult`, `searchChats`, and `getDefaultItems` back to `app.search`
- restore the search branch in `src/tests/mocks/app.ts`
- regenerate contracts and rerun checks

Status:

- [ ] not done

### Step 2. Start semantic cleanup bottom-up

The next likely bottom-up target is `domain.tree`.

Reason:

- it likely exposes too many public functions
- low-level tree surgery helpers probably should not be public
- cleaning it first will make higher-layer cleanup easier

Status:

- [ ] not started

## Testing / Contract Hardening

- [x] root public API contracts exist
- [x] root public API test presence is enforced
- [x] root canonical mocks exist
- [x] root canonical mocks are checked against public API contracts
- [ ] public submodule entrypoints do not yet have the same 1:1 contract/test enforcement

## Deferred / Later

- [ ] strict namespace checks are AST-based at the root level; extend further only if needed
- [ ] strict whitelist of allowed third-party/node-module imports per top-level area
- [ ] dead code elimination pass
- [ ] comments on every single function
- [ ] agents/skills files for each major module once boundaries settle

Note on comments:

- blanket "comment every function" is still questionable
- comments on non-obvious functions/logic may be a better target than comments on every function mechanically

## Current Stopping Point

This pass has now gone all the way backward through:

- `app`
- `domain`
- `external`
- `state`
- `lib`

Current architectural status:

- `app` is in a good stopping state
- `domain.tree` has been heavily reduced and split from tree constraints
- `domain.constraints` is checks-only, not fixer logic
- `external.streams` now takes prebuilt history instead of building app semantics itself
- `external.files` no longer returns a state type
- `state.chats` no longer exposes raw `ExchangeMap` bag accessors/mutators
- `state.providers` is just runtime provider state plus small mutations
- `lib` has been reduced to genuinely shared utilities

Important current truths:

- `app.search`, `app.files`, and `app.content` are gone on purpose
- `app.chat.getState()` is gone
- `app.chat.getCommandHistory()` is gone
- `branch` terminology is gone from active non-canvas code
- `commands.ts` / `queries.ts` should not be reintroduced
- `document-map` and `diff` are no longer in `lib`

Provider-support note:

- `provider-defaults` and `provider-types` currently remain in `lib`
- this is not because they are ideal `lib` material
- it is because `state` may import only `domain` and `lib`
- with the current import rules, shared provider support cannot live only in `external`

## Fresh-Start Instructions

If context is wiped, assume these are true unless the repo proves otherwise:

- top-level module boundary enforcement is already solid
- root public barrels are intentional and namespaced
- `view -> app only` is intentional and should not be weakened
- Canvas has been deleted and should not be reintroduced accidentally
- `app` has already been reduced to four real namespaces:
  - `app.bootstrap`
  - `app.chat`
  - `app.documents`
  - `app.providers`
- `app.search`, `app.files`, and `app.content` are gone on purpose
- the large top-level cleanup pass through `app`, `domain`, `external`, `state`, and `lib` has already happened
- the current problem is no longer layer churn; the next pass should be a smaller semantic polish pass, not another rearchitecture

When restarting:

1. Do not redesign the architecture again.
2. Do not re-open the `state vs view` debate unless the repo itself forces it.
3. Do not add new compatibility barrels or flat root exports.
4. Treat old pass-through exports as suspicious by default.
5. Prefer deleting duplicate aliases over preserving them.
6. Keep public APIs small, but do not split namespaces just to preserve old folder structure.
7. `app.chat` now uses narrower read queries:
   - `getChats`
   - `getChat`
   - `getActiveChatIndex`
   - `getActiveExchangeId`
   - `getMainChat`
8. `app.documents` and `app.providers` have already been flattened; do not reintroduce `commands.ts` / `queries.ts`.
9. Keep injected `deps` objects narrow and boring.
10. Prefer one real data request plus many pure projection functions over many baggy `getState()`-style reads.
11. For chat/tree work, the target shape is:

- get the chat/tree once
- run pure helpers like `getMainChat(tree)` or similar projections on top of it
- avoid reintroducing broad mutable state snapshots just for convenience

12. `state.chats` should stay tree/chat-shaped:

- prefer `getActiveChat()` / `getActiveTree()` / `getTreeByChatId()`
- do not reintroduce raw `ExchangeMap` bag accessors like `getActiveExchanges()`

13. Do not touch `scripts/`, `src/tests/contracts/`, or `src/tests/mocks/` unless a change genuinely requires it.
14. If those files do change, rerun all guardrails immediately.

What to preserve:

- `app.bootstrap` remains the app-facing startup/save boundary
- root-level fake `src/app/*.ts` compatibility files should stay gone
- duplicate `perform*` aliases should stay gone
- duplicate provider `init` alias should stay gone
- `app.search`, `app.files`, and `app.content` should stay gone
- `app.chat.getState()` should stay gone
- `app.chat.getCommandHistory()` should stay gone
- `branch` terminology should stay gone from active non-canvas code
- `domain.constraints` should stay checks-only
- `external.streams` should stay boundary-only
- `state` should stay runtime-state-only
- `lib` should stay small; do not move frontend rendering helpers back into it

Always rerun:

- `bun run check:imports`
- `bun run check:contracts`
- `bun run typecheck`
- `bun run test`

Current likely targets:

- semantic polish inside already-cleaned layers
- naming cleanup where old terms still linger
- public-surface reduction only when a module still clearly leaks the wrong shape
- guardrail tightening only after the current shapes are stable

Current likely non-targets:

- top-level namespace surgery
- restoring deleted namespaces
- reintroducing `commands.ts` / `queries.ts`
- broad file-moving for its own sake
- another large architecture pass without a concrete smell

### Completion Note

Done in this pass:

- `app.runtime` is gone
- `app.files` is gone
- `app.content` is gone
- `app.search` is gone
- `app.documents` and `app.providers` no longer use `commands.ts` / `queries.ts`
- `app.chat` no longer exposes `getState()` or `getCommandHistory()`
- `domain.tree` was reduced and split from tree constraints
- `domain.constraints` now checks only
- `external.streams` no longer assembles app history/context
- `external.files` no longer returns a state type
- `state.chats` no longer exposes raw exchange-map accessors/mutators
- `state.providers` no longer carries duplicated provider context metadata
- `lib` no longer contains frontend rendering helpers like `document-map` or `diff`

## Next Session Start Here

When resuming, do not restart from `app`.

Start with:

1. Read the current public surface in the area you want to polish.
2. Look for one concrete semantic smell, not a hypothetical redesign.
3. Make the smallest change that removes that smell while preserving the current layer boundaries.
4. Update contracts/mocks only if the public surface actually changed.
5. Rerun the guardrails.

Good next kinds of work:

- naming cleanup where old terminology still leaks through
- shrinking a public surface that is still obviously too wide
- tightening a checker once the underlying shape is already stable
- removing dead compatibility/test baggage left behind by the big cleanup pass

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
