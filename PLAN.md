# Codebase Audit Plan

## Remaining Issues

### 1. Remove or Gitignore `AGENT_ARCHITECTURE_PLAN.md`

This planning document was added on the branch. It is a working artifact, not source code, and likely should not be committed.

---

### 2. Fix A11y Warning

`src/view/FolderDocumentView.svelte:86` — clickable `<div>` without keyboard handler. Should be a `<button>`.

---

### 3. `ChatView.svelte` Reimplements Two Domain Constraint Functions

Two view functions duplicate existing `domain.tree.constraints` exports:

- `canCreateSideChat` reimplements `domain.tree.constraints.canCreateSideChats`
- `canPromoteSideChat` reimplements `domain.tree.constraints.canPromoteSideChatToMainChat`

Add these to `app.chat` (matching the existing `canSubmitPrompt` pattern) so the view closures become one-liners.

Also `getExchangePath` reimplements `domain.tree.getPath` — could call through instead.

---

### 4. `ChatView.svelte` Panel/Focus Orchestration Is Complex but View-Owned (Acceptable)

The component is ~850 lines, which is large for the "prefer small focused Svelte components" philosophy. The panel state machine and the exchange rendering could potentially be split.

---

### 5. Inline SVGs Where `lucide-svelte` Should Be Used

Per CLAUDE.md: "Use `lucide-svelte` for all icons."

132 inline SVG occurrences across 13 view files. Many are standard icons (close/X, chevrons, plus) with direct lucide equivalents (`X`, `ChevronLeft`, `ChevronRight`, `Plus`).

---

### 6. `app/chat` `submitPrompt` Assembles History Inline Instead of Using Domain

**Deferred — needs design thinking.**

---

### 7. Agent Loop in `app/chat` vs `app/agent` — Split Responsibility

**Deferred — needs design thinking.**

---

### 8. `importChat` and `importFolder` Use Unstructured `void Promise` Patterns

**Deferred — needs design thinking.**

---

### 9. Move `src/assets` into `src/view/assets`

`src/assets/` contains SVGs and images only imported by `view/`. It should live under `src/view/assets/` where the consuming code is.

Files importing from `@/assets`:

- `src/view/assets/provider-logos.ts` (10 imports)
- `src/view/shared/AppSidebar.svelte` (1 import)

After moving, update `@/assets` alias in `tsconfig.json`/`vite.config.ts` or change imports to relative paths.

---

### 10. Move `src/plotly.d.ts` Into `src/view`

`src/plotly.d.ts` is a type declaration for `plotly.js-dist-min`, only used by `src/view/features/document/charts.ts`. It shouldn't live at the `src/` root. Move it to `src/view/` or `src/view/features/document/`.
