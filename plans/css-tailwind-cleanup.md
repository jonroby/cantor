# CSS & Tailwind Cleanup Plan

## Overview

Systematic cleanup of CSS and Tailwind usage across `src/view`. The design token foundation in `index.css` is solid — the problem is inconsistent adoption throughout the codebase.

**Primary directive: Lift scoped CSS to Tailwind.** Use Tailwind utility classes by default on all elements in `src/view`. Only use scoped `<style>` blocks when Tailwind is impossible or genuinely doesn't make sense (complex dynamic selectors, `:global()` for markdown rendering, third-party library overrides, pseudo-elements with dynamic values, `@keyframes`).

**Health score: 6.5/10**

---

## Stage 1 — High Priority: Remove `!important` Flags

### Files

- `src/view/css/function-plot.css` (lines 22, 26-27, 36, 44, 64)
  - 5 instances overriding third-party chart library defaults
  - Fix: wrap chart container in a scoped selector with higher specificity, or use CSS containment

- `src/view/components/app/ComposerAnchor.svelte` (lines 126-127)
  - `:global(.composer)` forced `width: 100% !important; max-width: 720px !important;`
  - Fix: use CSS custom properties for width constraints instead

- `src/view/components/composer-input/ComposerInput.svelte` (lines 342-344)
  - `.model-chip-cta` forces background, color, border-color
  - Fix: use an explicit variant class name to avoid collision

- `src/view/components/sidebar/ChatItem.svelte` (lines 120-121)
  - `.sidebar-fade-text` forces mask-image
  - Fix: verify if scoped styles alone handle this without `!important`

---

## Stage 2 — Medium Priority: Adopt Design Tokens Consistently

### Font Sizes

Defined in `index.css` but ignored across codebase. Replace all arbitrary values with the defined scale:

```
--font-size-xs:   0.6875rem
--font-size-sm:   0.75rem
--font-size-base: 0.8125rem
--font-size-md:   0.875rem
--font-size-lg:   1rem
--font-size-xl:   1.25rem
```

Offending locations:

- `src/view/components/chat-message/ChatMessage.svelte` — `0.85rem`, `0.88rem`, `0.95rem`, `1.35em`, `1.2em`, `1.08em`
- `src/view/components/model-palette/palette.css` — `0.9rem` (lines 23, 175), `0.9375rem` (line 18)

### Duration Tokens

Defined: `--duration-fast: 120ms`, `--duration-normal: 150ms`. Replace:

- `200ms` / `250ms` — `ChatView.svelte`, `App.svelte`, `ComposerAnchor.svelte`
- `400ms` — `ChatView.svelte` (lines 781-782)
- `1.5s` — `layout.css` line 64 (shimmer animation — may intentionally differ, verify)

### Color Tokens

- `src/view/components/model-palette/palette.css` line 191 — `.palette-model-row.active` uses `background: hsl(210 100% 95%)` — hard-coded, breaks dark mode. Replace with design system color.
- `src/view/components/landing/LandingPage.svelte` (lines 110-117) — SVG fills use `#2b2b2b`, `#4a4a4a`, `#6e6e6e`, `#949494`. Replace with CSS variables.
- `src/view/components/document/Document.svelte` line 264 — `style="color: red;"` inline. Replace with `hsl(var(--destructive))`.

---

## Stage 3 — Medium Priority: Fix Magic Numbers & Inconsistent Scales

### `src/view/css/layout.css`

- `top: 1rem; left: 1rem;` — `.error-banner` positioning
- `max-width: min(42rem, calc(100vw - 2rem));` — error banner max-width (why 42rem?)
- `height: 1.9rem; width: 1.9rem;` — `.icon-chip` (non-standard)
- `top: 6rem;` — modal top position
- `width: min(56rem, calc(100vw - 2rem));` — modal width (why 56rem?)
- `font-size: 0.9rem;` — not in scale
- `6px` — `.action-tip` positioning
- Mixed opacity scale with no centralized values: `hsl(var(--destructive) / 0.22)`, `hsl(var(--destructive) / 0.1)`, `hsl(var(--foreground) / 0.18)` — establish a standard opacity scale

### `src/view/components/chat-view/ChatView.svelte`

- `calc(100vh - 150px)` — appears twice (lines 373, 793). Extract to a CSS variable.
- `height: 52px;` — should use a design token or variable

### `src/view/components/chat-message/ChatMessage.svelte`

- `0.35rem`, `0.15rem` (line 452) — off-scale spacing values
- `8px` (line 338) — mixed px/rem units

### `src/view/components/model-palette/palette.css`

- `border: 1px solid hsl(var(--foreground) / 0.15)` (line 85) — 0.15 opacity arbitrary
- `gap: 0 2rem` (line 164) — model-grid gap not on scale
- `gap: 1rem` (line 36) — verify against spacing scale
- Various padding values not on spacing scale

### `src/view/css/function-plot.css`

- `12px`, `5px` (lines 69, 84) — may be intentional for chart rendering fidelity, verify before changing

---

## Stage 3b — Medium Priority: Specificity Issues

### Conflicting rules

- `src/view/css/layout.css` — `.chatview-close-btn` and `.chatview-close-btn:hover` define overlapping properties without clear cascade intent. Consolidate.
- `src/view/components/chat-message/ChatMessage.svelte` — `.chatmsg :global(.icon-chip)` combines a scoped selector with `:global()`, giving it higher specificity than intended. Scoped + global mixing creates unpredictable specificity.

---

## Stage 4 — Medium Priority: Reduce `:global()` Coupling

### `src/view/components/chat-message/ChatMessage.svelte`

- 30+ lines of `:global()` styles for markdown rendering (`<p>`, `<h1>`–`<h6>`, `<ul>`, `<ol>`, `<blockquote>`, `<pre>`, `<code>`, etc.)
- Fix: extract to a dedicated `src/view/css/markdown.css` file and apply the parent class globally

### `src/view/components/chat-view/ChatView.svelte`

- `.chatview-doc-wrap > :global(.document)` and `:global(.docs-header)` — parent styling child internals
- Fix: use CSS custom properties passed into child component, or expose a styling class on the child

### `src/view/components/composer-input/ComposerInput.svelte`

- Multiple `:global(.composer-*)` definitions coupling ComposerInput to Composer
- Fix: move shared styles to a shared CSS file or consolidate ownership

---

## Stage 5 — Low Priority: Dead Code & Organization

### Dead code

- `src/view/css/layout.css` — `.palette-tab-content` is empty (line 3), remove
- `src/view/components/model-palette/palette.css` — `.palette-tab-content` also empty (lines 3-5), remove

### Inline styles to extract

- `src/view/components/composer-input/ComposerInput.svelte` line 202 — `style="height: 1.15rem; width: 1.15rem; object-fit: contain;"` on logo image. Replace with a class.

### Split `palette.css` (377 lines)

Currently mixes unrelated functional areas. Split into:

- `palette-provider-grid.css` — provider/model grid layout
- `palette-model-row.css` — individual model row styles
- `palette-vault.css` — vault/auth-related styles
- `palette-webllm.css` — WebLLM-specific styles

---

## Stage 6 — Mobile Responsiveness

Currently only one breakpoint at 900px throughout `layout.css` and `palette.css`.

- Add `< 640px` rules for modal panels
- Scrollbar width in `ChatView.svelte` is fixed at 8px — hide or reduce on mobile
- Image thumbnails in `ComposerInput.svelte` are fixed 64px — make responsive

---

## Stage 7 — Tailwind Arbitrary Values in Shadcn Components

The shadcn sidebar components use some non-standard Tailwind patterns:

- `src/view/primitives/shadcn/ui/sidebar/sidebar.svelte` — `w-(--sidebar-width)` references a CSS variable inside a Tailwind utility; verify this works correctly with the Tailwind version in use
- `src/view/primitives/shadcn/ui/sidebar/sidebar-menu-sub-button.svelte` — `-translate-x-px` (arbitrary pixel translation)
- `src/view/primitives/shadcn/ui/sidebar/sidebar-group-label.svelte` — `-mt-8` with opacity transitions mixed with arbitrary pixel values

Note: shadcn components are generated/copied code. Modifying them risks diverging from upstream. Only fix if the patterns cause real bugs or theme inconsistencies.

---

## What NOT to Fix

- Dynamic inline styles (`style="left: {x}px; top: {y}px;"`, token progress bar width) are correct — these are genuinely runtime values.
- `function-plot.css` pixel values (`12px`, `16px`, `5px`) may be intentional for chart rendering fidelity — verify before changing.
- `@keyframes` animations must stay in CSS.
- `:global()` for markdown rendering body styles (rendered HTML from LLM output) — Tailwind cannot reach these dynamic elements, keep in CSS.
- Shadcn-generated sidebar components — avoid modifying upstream generated code unless causing real bugs.

## When Scoped CSS Is Acceptable

Only reach for a `<style>` block for:

1. `@keyframes` / animation definitions
2. `:global()` styles targeting rendered HTML content (e.g. markdown output)
3. Third-party library overrides (e.g. function-plot chart)
4. Pseudo-elements that need dynamic CSS variable values Tailwind can't express
5. Complex selectors that Tailwind's `[&_...]` syntax would make unreadable
