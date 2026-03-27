# Domain Tree Refactor Plan

## Changes to `src/domain/tree/index.ts`

All changes scoped to this file only.

### 1. Bundle anchor + exchanges into `ChatTree`

**Problem:** `Anchor` is just `{ exchange: string | null }` — a wrapper around a nullable string. Every function takes `anchor: Anchor, exchanges: ExchangeMap` as separate args but they're always coupled. This allows desync bugs.

**Change:**
- Remove `Anchor` interface
- Remove `ANCHOR_ID` constant
- Add `ChatTree` interface:
  ```ts
  export interface ChatTree {
    rootId: string | null;
    exchanges: ExchangeMap;
  }
  ```
- Replace all function signatures from `(anchor: Anchor, exchanges: ExchangeMap, ...)` to `(tree: ChatTree, ...)`
- Replace all return types from `{ anchor: Anchor; exchanges: ExchangeMap }` to `ChatTree`
- Update `Chat` interface: replace `anchor: Anchor` with `rootId: string | null` (or just embed a `ChatTree`)
- Update `DeleteResult` to use `ChatTree`:
  ```ts
  export interface DeleteResult extends ChatTree {
    removedExchangeIds: string[];
  }
  ```
- Update `AddExchangeResult`:
  ```ts
  export interface AddExchangeResult extends ChatTree {
    id: string;
  }
  ```
- Rename internal `ValidatedTree` to add the cache on top of `ChatTree`:
  ```ts
  interface IndexedTree extends ChatTree {
    childrenByParentId: Record<string, Exchange[]>;
  }
  ```
- `buildEmptyExchanges` → `buildEmptyTree` returning `ChatTree`
- Internal helpers (`findRootExchange`, `isRootExchange`, `spliceExchange`, `exciseSubtree`) all take/return `ChatTree` instead of separate args
- All `anchor.exchange` references become `tree.rootId` or just `rootId`

### 2. Check side-chat constraint at insertion time in `addExchangeResult`

**Problem:** Adding an exchange that violates the side-chat depth rule succeeds in building the tree, then fails at `finalizeTree` validation. This is "construct invalid state then reject" rather than "make impossible states impossible."

**Change:**
- In `addExchangeResult`, before inserting, check: if the parent is a side exchange (not on the main path), it can have at most 1 child. If it already has 1 child, reject with a clear error like `Cannot add exchange: side chat "${parentId}" already has a child.`
- Use the already-built `IndexedTree` to call `isSideExchangeInTree` for this check

### 3. Remove pointless IIFEs

**Problem:** `addExchange`, `removeExchangeSubtree`, and `deleteExchangeWithMode` wrap their bodies in `(() => { ... })()` for no reason.

**Change:**
- `addExchange`: just call `addExchangeResult` and destructure directly
- `removeExchangeSubtree`: just call `removeExchangeSubtreeResult` and destructure directly
- `deleteExchangeWithMode`: just call `deleteExchangeWithModeResult` and destructure directly

### 4. Single validation: validate on entry, `buildTree` on exit

**Problem:** Every mutation calls `validateTree` on entry AND `finalizeTree` (which calls `validateTree` again) on exit. Double full-tree validation (including BFS reachability) on every operation.

**Change:**
- `finalizeTree` → just call `buildTree` (no validation) and return the `ChatTree` portion. Rename to `toTree` or just inline it.
- Keep `validateTree` on entry of public functions — that's the important one (validates caller isn't passing garbage).
- The exit path just builds the children index if needed, no re-validation.
- Keep `validateChatTree` as the explicit public validation function for callers who want it.

### 5. Unify `buildChildrenByParentId` and `buildExchangesByParentId`

**Problem:** Two functions do the same thing. Internal one asserts on missing children. Public one silently skips them. Silent skipping on corrupt data is dangerous.

**Change:**
- Remove the lenient public `buildExchangesByParentId`
- Rename internal `buildChildrenByParentId` → `buildChildrenByParentId` (keep name)
- Export a single `buildExchangesByParentId` that uses the asserting version
- All callers get the same behavior: corrupt data throws, never silently passes

### 6. Make `forkExchanges` throw instead of returning null

**Problem:** Every other operation throws on missing exchanges. `forkExchanges` returns `null`. Inconsistent error handling strategy.

**Change:**
- Replace the two `return null` paths with `assert` calls:
  - `assert(tree.exchanges[exchangeId] !== undefined, ...)`
  - `assert(path.length > 0, ...)` (this one may be unreachable after the first assert, but keep for safety)
- Change return type from `{ ... } | null` to `{ ... }`

### 7. Make `spliceExchange` imperative on copies (bonus perf fix)

**Problem:** `spliceExchange` reparenting loop (lines 385-391) creates a new `ExchangeMap` spread per child — O(n * map_size). It already works on a shallow copy, so the repeated spreads are waste.

**Change:**
- After the initial shallow copy, mutate the copy imperatively in the reparenting loops
- Same for root-splicing path (lines 360-369)
- Document with a comment that this is intentional mutation of a fresh copy

## Order of Operations

1. Introduce `ChatTree` interface and `IndexedTree` internal type
2. Update all internal helpers to use `ChatTree`
3. Update all public functions to use `ChatTree`
4. Remove `Anchor`, `ANCHOR_ID`, `buildEmptyExchanges`, rename to `buildEmptyTree`
5. Remove IIFEs
6. Remove double validation (finalizeTree → just build)
7. Unify the two children-by-parent-id functions
8. Add side-chat pre-check in `addExchangeResult`
9. Make `forkExchanges` throw
10. Make `spliceExchange` imperative on copies
11. Update `Chat`, `DeleteResult`, `AddExchangeResult` types
