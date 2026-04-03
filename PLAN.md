# Codebase Audit Plan

## Summary

| Check             | Status                          |
| ----------------- | ------------------------------- |
| `check:contracts` | PASS                            |
| `typecheck`       | PASS (0 errors, 1 a11y warning) |
| `test`            | PASS (421/421)                  |
| `check:imports`   | FAIL (33 violations)            |
| `lint` (prettier) | FAIL (13 unformatted files)     |

---

## 1. Register `workspace` in Import Checker

`app.workspace` and `state.workspace` are new modules on this branch but were never added to `APPROVED_PUBLIC_NAMESPACES` in `scripts/check-imports.mjs`. This causes 22 of the 33 import violations.

**Files affected:**

- `src/app/workspace/index.ts` — 6 violations (uses `state.workspace`)
- `src/app/bootstrap/index.ts` — 2 violations (uses `state.workspace`)
- `src/view/App.svelte` — ~16 violations (uses `app.workspace`)
- `src/view/ChatView.svelte` — 2 violations (uses `app.workspace`)

**Fix:** Add `'workspace'` to both `APPROVED_PUBLIC_NAMESPACES.app` and `APPROVED_PUBLIC_NAMESPACES.state` in `scripts/check-imports.mjs`.

---

## 2. Fix `state/workspace.svelte.ts` Dependency on `external`

```ts
// src/state/workspace.svelte.ts:1
import type { PersistedPanel } from '@/external/persistence/database';
```

State may only import `domain` and `lib`. Even type-only imports from `external` violate the dependency rules. The `PersistedPanel` type should be moved to `domain` or `lib`, or the state module should define its own `Panel` type.

---

## 3. Fix View Same-Area Import Paths

These use relative paths (`./`) instead of public entrypoints:

| File                             | Import          | Should Be             |
| -------------------------------- | --------------- | --------------------- |
| `src/view/ChatMessage.svelte:7`  | `'./chat-card'` | `'@/view/chat-card'`  |
| `src/view/ChatView.svelte:13-14` | `'./panel'`     | `'@/view/panel'`      |
| `src/view/ChatView.svelte:15`    | `'./chat-card'` | `'@/view/chat-card'`  |
| `src/view/App.svelte:9`          | `from '@/view'` | `from '@/view/index'` |

---

## 4. Rename "branch" Terminology in Agent Tools

Per `rules/root.md`: "branch terminology should stay gone from active code."

`src/app/agent/index.ts`:

- Line 593: tool named `'inspect_chat_branches'`
- Line 594: description says "branching off"
- Line 613: variable `branchKind`
- Line 620: string `"Branches from ..."`
- Line 622: string `"no child branches"`

Rename to use "side chat" terminology.

---

## 5. Rename `doc`/`docs` Identifiers

Per `rules/root.md`: "Avoid new doc/docs identifiers."

| File                      | Identifier    | Should Be               |
| ------------------------- | ------------- | ----------------------- |
| `src/view/App.svelte:178` | `docPanel`    | `documentPanel`         |
| `src/lib/bm25.ts:22,27`   | `docs`, `doc` | `documents`, `document` |

---

## 6. Run Formatter

13 files have formatting issues. Fix with `bun run format`.

Files:

- `AGENT_ARCHITECTURE_PLAN.md`
- `src/app/agent/index.ts`
- `src/app/agent/tests/index.test.ts`
- `src/app/bootstrap/tests/index.test.ts`
- `src/app/chat/index.ts`
- `src/app/documents/tests/index.test.ts`
- `src/state/agent.svelte.ts`
- `src/state/chats.svelte.ts`
- `src/tests/mocks/lib.ts`
- `src/view/AgentActivity.svelte`
- `src/view/App.svelte`
- `src/view/shared/tests/AppSidebar.test.ts`
- `src/view/tests/App.test.ts`

---

## 7. Remove or Gitignore `AGENT_ARCHITECTURE_PLAN.md`

This planning document was added on the branch. It is a working artifact, not source code, and likely should not be committed.

---

## 8. Fix A11y Warning

`src/view/FolderDocumentView.svelte:86` — clickable `<div>` without keyboard handler. Should be a `<button>` or add `on:keydown`.

---

## Responsibility and Code Smell Findings

### 9. `addDocumentToChat` in `App.svelte` Re-checks What `app.documents` Already Checks

`src/view/App.svelte:272-277` — `addDocumentToChat()` looks up the folder and file to check existence, then calls `app.documents.addDocumentToChat()`, which does the same lookup internally. The view function's guard is redundant.

```ts
// view/App.svelte:272
function addDocumentToChat(folderId: string, fileId: string) {
	const folder = app.documents.getState().folders.find((f) => f.id === folderId);
	const file = folder?.files?.find((f) => f.id === fileId);
	if (!file) return; // redundant
	app.documents.addDocumentToChat(folderId, fileId); // does the same check
}
```

**Fix:** Just call `app.documents.addDocumentToChat(folderId, fileId)` directly.

---

### 10. `ChatView.svelte` Contains Domain Logic That Belongs in `app` or `domain`

Several functions in `ChatView.svelte` walk the exchange tree and make structural judgments. These are domain/tree operations, not presentation logic:

- `isInSideChat(exchangeId)` (lines 309-320) — walks parent chain to determine if an exchange is in a side chat. This is a tree structural query.
- `canCreateSideChat(exchangeId)` (lines 322-325) — checks tree structure to decide if side-chatting is allowed.
- `hasSplitDescendant(exchangeId)` (lines 327-336) — BFS over tree children to check for splits.
- `canPromoteSideChat(exchangeId)` (lines 338-349) — checks parent/child structure and calls `hasSplitDescendant`.
- `getExchangePath(exchangeId)` (lines 433-443) — walks parent chain to build a path. This duplicates what `domain.tree.getPath` does.
- `getChildren(exchangeId)` (lines 301-307) — resolves child IDs to exchange objects.

These functions operate on the tree structure and encode rules about what operations are valid. Per the architecture, this logic belongs in `domain.tree` (pure structural queries) or `app.chat` (if it needs runtime state). The view should call `app.chat.canPromoteSideChat(tree, exchangeId)`, not implement the tree walk itself.

---

### 11. `ChatView.svelte` Panel/Focus Orchestration Is Complex but View-Owned (Acceptable)

The side panel open/close/focus logic (`openSidePanel`, `closeSidePanel`, `focusPanel`, `expandSideChat`, etc.) is genuinely presentation-owned choreography per CLAUDE.md's "blurry boundary" section. This is acceptable. However, the component is ~850 lines, which is large for the "prefer small focused Svelte components" philosophy. The panel state machine and the exchange rendering could potentially be split.

---

### 12. Inline SVGs Where `lucide-svelte` Should Be Used

Per CLAUDE.md: "Use `lucide-svelte` for all icons."

`ChatView.svelte` has ~12 inline SVG icons (close buttons, arrows, plus icons) that should be lucide imports. Same pattern appears in:

- `src/view/shared/FolderItem.svelte` (19 SVG occurrences)
- `src/view/shared/DocumentItem.svelte` (13)
- `src/view/shared/ChatItem.svelte` (10)
- `src/view/features/document/Document.svelte` (19)
- `src/view/routes/LandingPage.svelte` (24)

132 inline SVG occurrences across 13 view files total. Many of these are standard icons (close/X, chevrons, plus) that have direct lucide equivalents (`X`, `ChevronLeft`, `ChevronRight`, `Plus`).

---

### 13. `app/chat` `submitPrompt` Assembles History Inline Instead of Using Domain

`src/app/chat/index.ts:358-377` — The history assembly logic (flatMapping exchanges to messages, splicing document context, splicing agent system prompts) is built inline in `submitPrompt`. This is orchestration that mixes:

- context selection (`selectExchanges`)
- message format construction (exchange → user/assistant messages)
- document injection (splice a fake user/assistant pair)
- agent system prompt injection (splice another fake pair)

This multi-concern assembly makes `submitPrompt` hard to test and hard to change. The message-building could be a pure function in `domain` or a separate app helper.

---

### 14. Agent Loop in `app/chat` vs `app/agent` — Split Responsibility

The agent run loop lives in `src/app/chat/index.ts:502-609` (`runAgentLoop`, `startAgentRun`, `updateExchangeResponse`, `summarizeInput`, `getVerificationLines`, `buildVerificationSummary`). Meanwhile `src/app/agent/index.ts` defines the tools, types, and state accessors.

This means agent runtime behavior is owned by `app/chat` while agent tool definitions are in `app/agent`. The agent loop calls `state.agent.*` for thinking events and `external.providers.stream.*` for streaming — it's doing full feature orchestration. This split makes it unclear which module "owns" agent runs.

Consider: either move the agent loop into `app/agent` (which already owns tools and state), or keep it in `app/chat` but document the ownership split clearly.

---

### 15. `importChat` and `importFolder` Use Unstructured `void Promise` Patterns

`src/app/chat/index.ts:678` and `src/app/documents/index.ts:300-323` — Several functions fire `void external.io.pickFile(...).then(...)` without returning the promise or handling the void. This means:

- Callers cannot await or chain on completion
- Errors inside `.then()` are caught locally but the caller has no signal of success/failure beyond the toast callback

This is a minor smell but could make testing and future orchestration harder.

---

### 16. `scroll-to-bottom` Button in `App.svelte` Rebuilds a Tree Path Inline

`src/view/App.svelte:410-415`:

```ts
const chat = app.chat.getChat();
const path = app.chat.getMainChat({
	rootId: chat.rootId,
	exchanges: chat.exchanges
});
if (path.length > 0) chatViewRef?.scrollToNode(path[path.length - 1]!.id);
```

This reconstructs the tree and finds the tail just to scroll — but `ChatView` already has `scrollToBottom()` exported. The App.svelte handler should just call `chatViewRef?.scrollToBottom()` instead of re-deriving the tail ID.
