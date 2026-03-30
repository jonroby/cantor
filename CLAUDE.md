# CLAUDE.md

## Purpose

Svelte 5 + Vite single-page app. An LLM interface for power users. Browser-only state.

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

Cross-area imports must go through root barrels as namespace imports (e.g. `import * as app from '@/app'`). No deep imports across area boundaries.

`bun run check:imports` enforces dependency rules. `bun run check:contracts` enforces approved public submodules.

## Coding Philosophy

- Make impossible states impossible. But if the trade-off for call-site friction or performance isn't worth it, write imperative code.
- Write code that is testable. If you can't test it without heavy mocking, it's in the wrong layer. Extract pure logic into Domain. Extract orchestration into App.
- Do not add features, refactor code, or make "improvements" beyond what was asked.
- Do not add error handling, fallbacks, or validation for scenarios that can't happen. Trust internal code. Only validate at system boundaries.
- Do not create helpers or abstractions for one-time operations. Three similar lines is better than a premature abstraction.
- Prefer small focused Svelte components.

## Temporary Rules

- Do not worry about data migration. No migration steps when changing persisted data shapes.

## Working Rules

- Do not confuse copies (new chats from a copied path) with side chats (sibling branches).
