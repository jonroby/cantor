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

## Icons

Use `lucide-svelte` for all icons. Do not use inline SVG paths or one-off SVGs for icons. Import named icons from `lucide-svelte` directly in view components.

## Coding Philosophy

- Make impossible states impossible. But if the trade-off for call-site friction or performance isn't worth it, write imperative code.
- Write code that is testable. If you can't test it without heavy mocking, it's in the wrong layer. Extract pure logic into Domain. Extract orchestration into App.
- Do not add features, refactor code, or make "improvements" beyond what was asked.
- Do not add error handling, fallbacks, or validation for scenarios that can't happen. Trust internal code. Only validate at system boundaries.
- Do not create helpers or abstractions for one-time operations. Three similar lines is better than a premature abstraction.
- Prefer small focused Svelte components.

## Temporary Rules

- When changing persisted data shapes, handle migration from the previous shape in `external/persistence`.

## Working Rules

- Do not confuse copies (new chats from a copied path) with side chats (sibling branches).
