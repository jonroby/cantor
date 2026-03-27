I want you to read TESTING_PLAN.md (and CLaude.md
for info on architecture) and work on writing tests
for all lib files. These should approach near 100%
since they are pure. Do NOT test non-public
functions.

Do not worry about code downstream (if you need to
change things to make code quality here better). SO
long as it isn't too much friction for code
downstream to make changes do not worry about it.
Do not worry about bacwkard incompatible changes.

# Testing Plan

> Consult `CLAUDE.md` for architecture rules, tooling (`bun run test`), and layer boundaries.

## Philosophy

- **100% coverage target** for Domain and Lib layers (pure functions, no excuses).
- **High coverage** for App layer (orchestration logic, mocked dependencies).
- Tests flow from pure → effectful, mirroring the architecture.
- ~3/4 of this work is writing tests. ~1/4 is refactoring code to make it testable (extracting pure logic, breaking hidden dependencies).
- Aim for clear, functional code. Your mantra should be "make impossible states are impossible" but if the trade off for call site friction is too high, or if performance would suffer you may write imperative code.

```
┌──────────────────────────────────┐
│  Domain + Lib  (pure)            │  ← test first, no mocks
├──────────────────────────────────┤
│  App           (orchestration)   │  ← test second, mock state/services
├──────────────────────────────────┤
│  State + Services (effects)      │  ← test selectively
└──────────────────────────────────┘
```

---

## Phase 1: Domain + Lib (pure)

Pure in, pure out. No mocks needed. If you need a mock, the function doesn't belong here.

- [ ] `src/domain/tree/`
- [ ] `src/lib/models/`
- [ ] `src/lib/search/`
- [ ] `src/lib/validate-md/`

### `src/domain/tree/`

#### Test helpers to build first

- [ ] `exchange(overrides)` factory — returns a valid `Exchange` with sensible defaults
- [ ] `buildLinearTree(n)` — builds a main-chat-only tree of n exchanges via the public API
- [ ] `buildTreeWithSideChat()` — builds a tree with a side branch for promote/delete tests

#### Tree construction & validation

- [ ] `buildEmptyTree` returns `{ rootId: null, exchanges: {} }`
- [ ] `validateChatTree` — valid tree passes through unchanged
- [ ] `validateChatTree` — orphan nodes, broken parent/child links, multiple roots all throw

#### Adding exchanges

- [ ] `addExchange` / `addExchangeResult` — append to empty tree (creates root)
- [ ] `addExchange` — append to main chat tail
- [ ] `addExchange` — create side chat (sibling branch)
- [ ] `addExchange` — reject adding child to side exchange that already has a child (depth constraint)
- [ ] `addExchangeResult` returns correct `id` and updated tree

#### Removing exchanges

- [ ] `removeExchange` — remove leaf node
- [ ] `removeExchange` — remove node with children (re-parents or removes subtree)
- [ ] `removeExchangeSubtree` — removes target + all descendants
- [ ] `removeMainChatChild` — removes first child path only
- [ ] `removeSideChatChildren` — removes all non-first children
- [ ] `deleteExchangeWithMode` — `'exchange'` mode
- [ ] `deleteExchangeWithMode` — `'exchangeAndMainChat'` mode
- [ ] `deleteExchangeWithMode` — `'exchangeAndSideChats'` mode
- [ ] `deleteExchangeWithModeResult` — returns correct `removedExchangeIds`
- [ ] Cannot remove root exchange

#### Queries

- [ ] `getRootExchange` — returns root, returns null for empty tree
- [ ] `getChildExchanges` — returns sorted children
- [ ] `getMainChatTail` — follows first-child path to end
- [ ] `getHistory` — returns alternating user/assistant messages from root to target
- [ ] `getPathTokenTotal` — sums tokens along path to root
- [ ] `getDescendantExchanges` — returns all descendants
- [ ] `findSideChatParent` — finds branching ancestor for side exchanges
- [ ] `canCreateSideChats` — true for main chat nodes with responses
- [ ] `canAcceptNewChat` — respects side-chat depth constraint

#### Mutations (immutable updates)

- [ ] `updateExchangeTokens` — updates token counts on a specific exchange
- [ ] `updateExchangeResponse` — sets response on an exchange, null → MessagePart

#### Promote & Fork

- [ ] `canPromoteSideChatToMainChat` — true only for side roots
- [ ] `promoteSideChatToMainChat` — swaps side branch into first-child position
- [ ] `promoteSideChatToMainChat` — throws for non-side-root
- [ ] `forkExchanges` — creates independent copy of path from root to target
- [ ] `forkExchanges` — forked tree has new IDs, no shared references

#### Edge cases

- [ ] Operations on empty tree don't crash
- [ ] Operations with nonexistent exchange IDs throw `ChatTreeOperationError`
- [ ] Tree with single root (no children) — all operations behave correctly

### `src/lib/models/`

- [ ] `isKeyBasedProvider` — correctly classifies each provider
- [ ] `getModelContextLength` — returns length for known models, null for unknown
- [ ] `getProviderForModelId` — finds provider by model ID, null for unknown
- [ ] `PROVIDER_CONFIG` / `PROVIDER_MODELS` — entries exist for every provider in `PROVIDERS`

### `src/lib/search/`

- [ ] `searchChats` — substring match on short queries
- [ ] `searchChats` — trigram match on longer queries
- [ ] `searchChats` — scoped to specific chat indices
- [ ] `searchChats` — returns empty for no matches
- [ ] `getDefaultItems` — returns items for active chat
- [ ] `getDefaultItems` — returns items across all chats when flag is set
- [ ] `groupResults` — groups by chat index correctly
- [ ] Snippet extraction highlights match context

### `src/lib/validate-md/`

- [ ] `validate` — clean markdown returns no errors
- [ ] `validate` — catches specific markdown issues (test each rule)
- [ ] Edge cases: empty string, whitespace-only

---

## Phase 2: App — `src/app/`

Orchestration tests. These verify that domain logic, state mutations, and service calls are composed correctly. Dependencies (state, services) should be mocked or injected.

- [x] `src/app/`

### Refactoring done

- [x] **Extract dependencies to make app functions testable.** Introduced `ChatActionDeps` interface in `chat-actions.ts`. Effectful dependencies (`replaceActiveTree`, `setActiveExchangeId`, `forkChat`, `isStreaming`, `cancelStreamsForExchanges`) are now passed as an optional `deps` parameter with real implementations as defaults. Tests pass mock deps directly — no module mocking hacks needed for the functions under test. (Module-level `vi.mock` is still used to prevent `web-llm` from loading during import resolution.)
- [x] **Moved `ExchangeNodeData` type from `src/views/shared/types.ts` to `src/app/types.ts`.** App was importing from View, violating the one-way dependency rule. Views now import the type from `@/app/types`. The old `src/views/shared/types.ts` file was deleted.
- [x] **Removed `canFork` from `ExchangeNodeData`.** It was hardcoded to `true` — every exchange can fork, there is no domain constraint. Removed the property, the assignment in `chat-actions.ts`, and the `{#if data.canFork}` guards in both `ExchangeNode.svelte` and `ChatMessage.svelte`.
- [x] **Fixed `performPromote` state discipline.** `setActiveExchangeId` was called before the domain operation (`promoteSideChatToMainChat`), so failure left partial side effects. Reordered so side effects only execute after the domain call succeeds.

### `getExchangeNodeData`

- [x] Returns null for root exchange (parentId === null)
- [x] Returns null for nonexistent exchange
- [x] Correctly computes `hasSideChildren`, `sideChildrenCount`, `isSideRoot`
- [x] `canPromote` reflects domain's `canPromoteSideChatToMainChat`
- [x] `isStreaming` reflects service state
- [x] `isActive` is true when exchangeId matches activeExchangeId
- [x] `isActive` is false when exchangeId does not match
- [x] All callbacks (`onFork`, `onDelete`, `onPromote`, `onSelect`, `onToggleSideChildren`, `onMeasure`) are wired to the passed-in callbacks
- [x] Returns prompt and response text from the exchange
- [x] Returns empty string when response is null
- [x] Error in rendering returns null (try/catch path — verified with a structurally broken exchange map)

### `performDelete`

- [x] Calls domain delete, cancels streams for removed IDs, replaces tree in state
- [x] Redirects `activeExchangeId` to main chat tail when deleting active exchange
- [x] Does not redirect `activeExchangeId` when deleting non-active exchange
- [x] Calls `onResetMeasuredHeights` when provided
- [x] Returns `{ error: null }` on success
- [x] Returns `{ error: string }` when domain throws (nonexistent exchange)

### `performPromote`

- [x] Calls domain promote, updates state, returns no error
- [x] Calls `onResetMeasuredHeights` when provided
- [x] Returns `{ error: null }` on success
- [x] Returns `{ error: string }` when domain throws (non-side-root) — and does not mutate state
- [x] Returns `{ error: string }` for nonexistent exchange — and does not mutate state

### `performFork`

- [x] Delegates to `deps.forkChat`

### `getDeleteMode`

- [x] Returns `'exchangeAndSideChats'` when node has multiple children
- [x] Returns `'exchange'` when node has 0 children
- [x] Returns `'exchange'` when node has 1 child

---

## Phase 3: State + Services (selective)

These are effectful — test only where logic lives (not simple getters/setters).

- [ ] `src/state/`
- [ ] `src/services/`

### `src/state/chats.svelte.ts`

- [ ] `forkChat` — creates new chat with forked tree, correct rootId
- [ ] `newChat` — initializes with empty tree or default exchanges
- [ ] Chat selection, deletion — index management is correct

### `src/state/initial-exchanges.ts`

- [ ] Returns a valid `ChatTree` with root and initial exchanges

> State tests may require Svelte's test utilities for reactive state. Keep these minimal — most logic should live in Domain or App where it's testable without framework machinery.

---

## Phase 4: View (presentation)

Component tests. Verify that views render correctly and delegate actions to the App layer. Use Svelte's component testing utilities.

- [ ] `src/views/classic/`
- [ ] `src/views/shared/`

### `src/views/classic/`

- [ ] `ChatMessage.svelte` — renders prompt and response HTML
- [ ] `ChatMessage.svelte` — shows streaming indicator when `isStreaming` is true
- [ ] `ChatMessage.svelte` — shows provider logo and model name
- [ ] `ChatMessage.svelte` — action buttons (fork, promote, delete) call correct callbacks
- [ ] `ChatMessage.svelte` — promote button only visible for side roots, disabled when `canPromote` is false
- [ ] `ChatMessage.svelte` — branch badge shows side children count

### `src/views/shared/`

- [ ] `ChatInput.svelte` — submits prompt text on enter
- [ ] `ChatInput.svelte` — does not submit empty input
- [ ] `SearchDialog.svelte` — renders search results
- [ ] `SearchDialog.svelte` — calls `onSelect` with correct result
- [ ] `SearchDialog.svelte` — toggles between active chat and all chats scope

> View tests are the lowest priority. Extract testable logic into App or Domain first. Only test view behavior that can't be covered by lower layers (rendering conditions, user interaction wiring).

---

## Running

```bash
bun run test          # all tests
bun run test:unit     # unit tests only
```
