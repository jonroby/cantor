# Codebase Audit Plan

## Remaining Issues

### 1. `app/chat` `submitPrompt` Assembles History Inline

The history assembly (flatMap exchanges → messages, splice document context, splice system prompt) is inline in `submitPrompt`. Could extract a private `buildHistory` function in `app/chat` for clarity and testability.

---

## CSS Cleanup

### Current State

The codebase uses three styling approaches that don't follow a clear rule:

- **Scoped `<style>` blocks** — most feature components (Document, ChatView, AgentActivity, etc.)
- **Tailwind utility classes** — shadcn components, sidebar, a handful of others
- **Global CSS files** — `layout.css`, `palette.css`, `function-plot.css`

Some components mix all three.

**Specific problems:**

- **Units are inconsistent.** `px` and `rem` used interchangeably for the same kinds of values. `gap: 8px` next to `gap: 0.4rem`. Padding ranges from `6px 10px` to `0.75rem 0.85rem`.
- **No type scale.** 13+ font sizes: `11px`, `12px`, `13px`, `14px`, `15px`, `16px`, `18px`, `20px`, `0.7rem`, `0.78rem`, `0.8125rem`, etc.
- **No radius scale.** `4px`, `6px`, `8px`, `12px`, `0.4rem`, `0.5rem`, `0.7rem`, `0.75rem`, `999px`, `50%` all used for similar elements.
- **Repeated patterns everywhere.** `gap: 8px` appears 11 times, `border: 1px solid hsl(var(--border))` 7 times, `margin: 0 auto` 6 times, `border-radius: 12px` 6 times.
- **41 `:global()` usages** across 7 files — component style boundaries leaking.
- **4 `!important` uses** — `function-plot.css` (hardcoded colors) and `App.svelte` (composer width).
- **Hardcoded colors** in `function-plot.css` (`#1a1a1a`, `#999`, `#fff`) and `palette.css` (`white`, `#6366f1`).

### Plan

**Phase 1: Define a shared scale in Tailwind config / CSS variables**

Establish tokens for the repeated values so both Tailwind classes and any remaining scoped CSS reference the same scale:

- **Spacing:** Standardize on Tailwind's scale (`gap-1` = 4px, `gap-2` = 8px, etc.). Stop mixing px and rem.
- **Font sizes:** Pick 5-6 sizes and name them. The most common is `13px` (used 15 times) — that's the base.
- **Border radius:** Pick 3-4 values (e.g., `sm` = 4px, `md` = 8px, `lg` = 12px, `full` = 999px).
- **Transitions:** Standardize on 1-2 durations (currently `120ms`, `150ms`, `200ms`, `250ms` all in use).

**Phase 2: Port simple components to Tailwind**

Migrate components with small or medium style blocks. These are the ones where scoped CSS is just applying common utilities (flex, gap, padding, colors) and Tailwind would be a direct replacement with less code.

Candidates (roughly ordered by simplicity):

| Component                   | Style lines | Notes                                          |
| --------------------------- | ----------- | ---------------------------------------------- |
| `ChatView.svelte`           | ~30         | Mostly layout, `:global()` for child overrides |
| `App.svelte`                | ~75         | Panel layout, composer anchor                  |
| `FolderDocumentView.svelte` | ~149        | Folder header, dropdown, file picker           |
| `AgentActivity.svelte`      | ~177        | Thinking events, streaming indicators          |
| `ModelPalette.svelte`       | ~68         | Plus separate `palette.css` (324 lines)        |
| `DrawingBoard.svelte`       | ~99         | Canvas wrapper                                 |
| `FolderItem.svelte`         | small       | Sidebar folder item                            |
| `DocumentItem.svelte`       | small       | Sidebar doc item                               |
| `ChatItem.svelte`           | small       | Sidebar chat item                              |

**Phase 3: Leave complex components as scoped CSS (but standardize their tokens)**

These have genuinely complex CSS (diff viewers, code editors, responsive layouts) where utility classes would be worse. Keep scoped CSS, but make them use the shared scale from Phase 1.

| Component             | Style lines | Why keep scoped                               |
| --------------------- | ----------- | --------------------------------------------- |
| `Document.svelte`     | 308         | Diff viewer, editor states, streaming preview |
| `LandingPage.svelte`  | 253         | Responsive hero, feature grid, typography     |
| `CodeEditor.svelte`   | 168         | Code sandbox, terminal output                 |
| `PythonEditor.svelte` | 168         | Python executor, similar to CodeEditor        |
| `Composer.svelte`     | scoped      | Input area with complex states                |

**Phase 4: Clean up global CSS**

- `function-plot.css` — Replace hardcoded hex colors with CSS variables. Remove `!important`.
- `palette.css` — Replace `white`, `#6366f1`, `rgba(99, 102, 241, 0.08)` with theme variables. Consider inlining into `ModelPalette.svelte` or porting to Tailwind.
- `layout.css` — Review what's still needed vs what's been superseded by component styles. Reduce or eliminate.
- `index.css` — Already good (theme tokens). Keep as-is.

**Phase 5: Eliminate `:global()` leaks**

41 usages across 7 files. Most are components styling children they don't own (e.g., `.chatview-doc-wrap > :global(.document)`). For each:

- If the child component can accept a `class` prop, pass it instead
- If it's a shadcn primitive, use Tailwind on the wrapper
- If it's truly needed (e.g., third-party library styling), document why
