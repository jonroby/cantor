# CLAUDE.md

## Purpose

Svelte 5 + Vite single-page app. An LLM interface for power users. Browser-only state, persisted to IndexedDB.

Read `rules/` before modifying `src/`. Start with `rules/root.md`, then the rule file for the layer you are changing.

## Tooling

Always use `bun`.

- `bun install` — dependencies
- `bun run dev` — dev server
- `bun run build` — production build
- `bun run typecheck` — Svelte/TypeScript checks
- `bun run lint` — formatting/lint validation
- `bun run format` — auto-format
- `bun run test` or `bun run test:unit` — tests

Do not use `npm`, `pnpm`, or `yarn` unless explicitly asked.

## UI Stack

- UI primitives live in `src/view/primitives`
- use local primitives first before adding new third-party wrapper layers
- `bits-ui` is allowed as the headless interaction/accessibility layer
- `shadcn-svelte` and Tailwind are not part of the app UI stack anymore

## Architecture

```text
src/
├── domain/    app-specific business rules (pure)
├── lib/       generic pure support code
├── state/     app runtime state
├── external/  persistence and outside-world boundaries
├── app/       orchestration
└── view/      UI and presentation logic
```

Dependencies flow one way:

- `domain` and `lib` import nothing else
- `state` and `external` may import `domain` and `lib`
- `app` may import `domain`, `lib`, `state`, and `external`
- `view` may import only `app`

Cross-area imports must go through root barrels as namespace imports. Always use `import * as app from '@/app'`, never destructured or deep imports. No exceptions.

Within an area, cross-submodule and subfolder imports must go through the target submodule's public entrypoint. Import `@/app/chat`, not `../chat/index`, `./chat/index`, `./chat/utils`, or `@/app/chat/index`.

`bun run check:imports` enforces dependency rules. `bun run check:contracts` enforces approved public submodules.

### Action Ownership

Use this standard for all user actions and agent tools:

- one app function owns the behavior
- the UI calls it
- the agent tool calls it
- no duplicated semantics in the tool layer

In practice:

- `app.*` owns the real action
- `view` should mostly pass ids/inputs and render state
- `app.agent` tools should dispatch to `app.*`, not recreate behavior
- if a tool needs verification, that should be metadata around the action, not a second implementation of the action

This matters most for workspace actions. If a user action is currently assembled across multiple `view` callbacks or cleanup paths, prefer moving that behavior into a named `app.*` function so both UI and agent tools call the same semantic action.

Current concern:

- some workspace behaviors are still view-composed instead of app-owned
- when touching those paths, prefer collapsing them into `app.workspace` or another existing `app.*` module instead of adding more callback-specific behavior in `view`

Blurry boundary:

- some workspace capabilities are genuinely presentation-owned, not app-owned
- for those actions, it is acceptable for agent tools to call a view callback instead of an `app.*` action
- but a capability must choose one owner: either call the shared `app.*` action or call the view-owned action, never both in sequence
- current examples of acceptable view-owned actions are pane/layout choreography such as opening folder panels, closing panels, and toggling the sidebar

## Icons

Use `lucide-svelte` for all icons. Do not use inline SVG paths or one-off SVGs for icons. Import named icons from `lucide-svelte` directly in view components.

## Coding Philosophy

- Make impossible states impossible. But if the trade-off for call-site friction or performance isn't worth it, write imperative code.
- Write code that is testable. If you can't test it without heavy mocking, it's in the wrong layer. Extract pure logic into Domain. Extract orchestration into App.
- In tests, prefer the existing shared mocks under `tests/mocks`. Do not add ad hoc mock systems or per-suite mock wrappers when the shared mocks can be extended instead.
- Shared test environment setup belongs under `tests/setup`. Shared rendered harness components belong under `tests/fixtures`.
- Do not mock `@/lib` in app-layer tests unless there is no reasonable alternative. Prefer spying on the specific real export you need to override.
- In app-layer tests, avoid importing the `@/app` barrel unless the test actually needs the full root namespace. Prefer the specific module under test to avoid unnecessary import-graph churn.
- Do not add features, refactor code, or make "improvements" beyond what was asked.
- Do not add error handling, fallbacks, or validation for scenarios that can't happen. Trust internal code. Only validate at system boundaries.
- Do not create helpers or abstractions for one-time operations. Three similar lines is better than a premature abstraction.
- Prefer small focused Svelte components.

## Working Rules

- Do not confuse copies (new chats from a copied path) with side chats (sibling branches).
