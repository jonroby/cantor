# Code Review: Issues & Proposed Solutions

## Architecture / Clarity

### 1. `App.svelte` is 910 lines and handles too many concerns

**File:** `src/App.svelte`

This single file manages: session state, hydration/persistence, model selection, streaming orchestration, delete dialogs, search, canvas rendering, composer UI, header visibility, and keyboard shortcuts. It's readable but fragile — any change to one concern risks touching another.

**Proposed approach:** The CLAUDE.md says to preserve this architecture unless there's clear reason. But consider extracting at least:

- Streaming/provider orchestration into a `useChat` module (state + `submitPrompt` + abort logic)
- Persistence (hydration + save effect) into a `usePersistence` module
- Keyboard shortcut handling into a separate module

---

### 2. `ModelPalette.svelte` is 924 lines, mostly CSS (low priority)

**File:** `src/lib/components/ModelPalette.svelte`

~700 of those lines are CSS. The logic (~230 lines) is clean. The CSS could benefit from using more Tailwind utility classes to reduce raw CSS volume, but this is cosmetic.
