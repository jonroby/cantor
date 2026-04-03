# Codebase Audit Plan

## Completed

- Import violations fixed (33 → 0), `workspace` registered in import checker
- `state/workspace` dependency on `external` removed (own `WorkspacePanel` type)
- View same-area import paths fixed
- "branch" terminology renamed to "side chat" in agent tools
- `doc`/`docs` identifiers renamed to `document`/`documents`
- Formatter run, lint errors fixed (unused imports, `let` → `const`, dead code)
- `AGENT_ARCHITECTURE_PLAN.md` removed
- A11y warning fixed in `FolderDocumentView`
- Redundant `addDocumentToChat` guard removed from `App.svelte`
- `ChatView` constraint functions now delegate to `app.chat` instead of reimplementing
- Inline SVGs replaced with lucide-svelte across 7 view files
- `src/assets` moved into `src/view/assets`
- `plotly.d.ts` moved into `src/view/`
- `scroll-to-bottom` now calls `chatViewRef?.scrollToBottom()`
- `importChat`/`importFolder`/`importFolderIntoFolder` converted from `void .then()` to `async/await`
- Agent loop moved from `app/chat` into `app/agent` (Step 1)
- Streaming unified: agent uses `external/streams` xstate machine with `ToolExecutor` + `StreamCallbacks` (Step 2)
- Vault redesigned: single master password, global lock/unlock, session cache (encrypted password in sessionStorage + CryptoKey in IndexedDB, 24h TTL)
- Active model selection persisted in workspace layout (IndexedDB), restored on init
- ModelPalette UI updated: global vault lock/unlock bar, per-provider add/remove key (only when unlocked)
- `submitPrompt` history assembly extracted into private `buildHistory` function in `app/chat`
- README rewritten to match current architecture (removed stale `src/features/`, `src/routes/`, Canvas View, `src/assets/` references)

## CSS Cleanup — Completed

### What was done

**Phase 1: Shared design scale** — Added to `index.css`:

- Font sizes: `--text-xs` (11px), `--text-sm` (12px), `--text-base` (13px), `--text-md` (14px), `--text-lg` (16px), `--text-xl` (20px)
- Border radius: `--radius-sm` (4px), `--radius-md` (8px), `--radius-lg` (12px), `--radius-xl` (1rem), `--radius-full` (999px)
- Transitions: `--duration-fast` (120ms), `--duration-normal` (150ms)
- Tokens in both `@theme inline` (Tailwind classes) and `:root` (scoped CSS `var()`)

**Phase 2: Simple component tokenization** — Replaced hardcoded values with tokens across ChatView, App, FolderDocumentView, AgentActivity, ModelPalette, DrawingBoard, FolderItem, DocumentView, plus layout.css, palette.css, function-plot.css, index.css.

**Phase 3: Complex component tokenization** — Standardized tokens in Document, LandingPage, CodeEditor, PythonEditor (kept scoped styles, replaced hardcoded font sizes / border-radius / transitions with tokens). Zero hardcoded px font sizes remain.

**Phase 4: Global CSS cleanup** — `function-plot.css` hex colors replaced with theme variables (dark mode support). `palette.css` already clean. `layout.css` remaining `rgba()` box-shadows are correct as-is. Removed 2 unnecessary `!important` from `palette.css`.

**Phase 5: `:global()` cleanup** — 41 → 37 usages. Moved palette media query overrides from scoped to global CSS, wrapped chevron icon in scoped span, removed redundant `:global()` from palette.css. Remaining 37 are driven by god components — will be resolved by decomposition below.

## View Reorganization

### Rules

- Every component gets its own folder. No exceptions.
- Tests always go in a nested `tests/` folder inside the component folder.
- `primitives/` = simple reusable UI only (shadcn + thin wrappers).
- `components/` = every app component, each in its own folder.
- Tailwind utility classes directly on elements. Scoped `<style>` only when Tailwind can't express it.
- Global CSS only for: base resets, theme tokens, rendered `{@html}` content.

### Target Structure

```
src/view/
├── primitives/
│   ├── shadcn/ui/              (unchanged)
│   ├── button.svelte
│   ├── input.svelte
│   ├── confirm-delete-dialog/
│   │   ├── ConfirmDeleteDialog.svelte
│   │   └── index.ts
│   ├── inline-rename-input/
│   │   ├── InlineRenameInput.svelte
│   │   └── index.ts
│   └── index.ts
├── components/
│   ├── app/
│   │   ├── App.svelte
│   │   ├── index.ts
│   │   └── tests/
│   │       └── App.test.ts
│   ├── chat-view/
│   │   ├── ChatView.svelte
│   │   ├── index.ts
│   │   └── tests/
│   │       └── ChatView.test.ts
│   ├── chat-message/
│   │   ├── ChatMessage.svelte
│   │   ├── chat-card.ts
│   │   ├── index.ts
│   │   └── tests/
│   │       └── ChatMessage.test.ts
│   ├── agent-activity/
│   │   ├── AgentActivity.svelte
│   │   └── index.ts
│   ├── document/
│   │   ├── Document.svelte
│   │   ├── charts.ts
│   │   ├── index.ts
│   │   └── tests/
│   │       └── Document.test.ts
│   ├── document-view/
│   │   ├── DocumentView.svelte
│   │   └── index.ts
│   ├── folder-document-view/
│   │   ├── FolderDocumentView.svelte
│   │   └── index.ts
│   ├── sidebar/
│   │   ├── AppSidebar.svelte
│   │   ├── ChatItem.svelte
│   │   ├── DocumentItem.svelte
│   │   ├── FolderItem.svelte
│   │   ├── index.ts
│   │   └── tests/
│   │       └── AppSidebar.test.ts
│   ├── model-palette/
│   │   ├── ModelPalette.svelte
│   │   ├── palette.css
│   │   ├── index.ts
│   │   └── tests/
│   │       └── ModelPalette.test.ts
│   ├── code-editor/
│   │   ├── CodeEditor.svelte
│   │   └── index.ts
│   ├── python-editor/
│   │   ├── PythonEditor.svelte
│   │   └── index.ts
│   ├── drawing-board/
│   │   ├── DrawingBoard.svelte
│   │   ├── drawing-types.ts
│   │   └── index.ts
│   ├── composer/
│   │   ├── Composer.svelte
│   │   └── index.ts
│   ├── composer-input/
│   │   ├── ComposerInput.svelte
│   │   ├── index.ts
│   │   └── tests/
│   │       └── ComposerInput.test.ts
│   ├── search/
│   │   ├── SearchDialog.svelte
│   │   ├── index.ts
│   │   └── tests/
│   │       └── SearchDialog.test.ts
│   ├── landing/
│   │   ├── LandingPage.svelte
│   │   └── index.ts
│   ├── panel/
│   │   ├── panel.ts
│   │   ├── index.ts
│   │   └── tests/
│   │       └── panel.test.ts
│   └── index.ts
├── css/
│   ├── index.css
│   ├── layout.css              (shrinks as components own their styles)
│   ├── function-plot.css
│   └── prose.css               (new — rendered markdown styles extracted from Document)
├── assets/
├── lib/
├── main.ts
└── index.ts
```

### Execution Order

1. ~~Move files into new folder structure, update all imports~~
2. ~~Decompose god components into smaller children within their folders~~
   - ChatView (778→665): extracted DeleteExchangeDialog, SidePanelHeader, SidePanelContext, ExchangeList
   - App (596→482): extracted ComposerAnchor (with scoped CSS)
   - ModelPalette (583→348): extracted CredentialFlow, FrontierTab, OllamaTab, WebLLMTab
   - AppSidebar (533): already composed via ChatItem/FolderItem, no further split needed
3. ~~Convert scoped CSS / layout.css styles to Tailwind on decomposed components~~
   - layout.css: 1498 → 268 lines (removed ~500 dead CSS, moved rest to component `<style>` blocks)
   - Moved: ChatView, ComposerInput, SearchDialog, ChatMessage, SidePanelHeader, SidePanelContext, ExchangeList, ComposerAnchor
   - Remaining in layout.css: shared UI primitives (error-banner, icon-chip, action-tip, modal system) + prose content styles
4. Extract rendered-content `:global()` styles into `prose.css`
5. Shrink/eliminate `layout.css` as styles move into components
