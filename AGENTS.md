# AGENTS.md

## Purpose

Svelte 5 + Vite single-page app for exploring branching chat conversations. Supports Codex, Ollama, Gemini, OpenAI-compatible, and WebLLM models. Browser-only state. Two views over the same data: Classic View (linear chat) and Canvas View (node graph).

See `ARCHITECTURE.md` for the full architecture, layer rules, data model, and branching concepts.

## Tooling

Always use `bun`.

- `bun install` — dependencies
- `bun run dev` — dev server
- `bun run build` — production build
- `bun run check` — Svelte/TypeScript checks
- `bun run lint` — formatting/lint validation
- `bun run format` — auto-format
- `bun run test` or `bun run test:unit` — tests

Do not use `npm`, `pnpm`, or `yarn` unless explicitly asked.

## Coding Philosophy

- Make impossible states impossible. But if the trade-off for call-site friction or performance isn't worth it, write imperative code.
- Write code that is testable. If you can't test it without heavy mocking, it's in the wrong layer. Extract pure logic into Domain. Extract orchestration into App.
- Do not add features, refactor code, or make "improvements" beyond what was asked.
- Do not add error handling, fallbacks, or validation for scenarios that can't happen. Trust internal code. Only validate at system boundaries.
- Do not create helpers or abstractions for one-time operations. Three similar lines is better than a premature abstraction.
- Prefer small focused Svelte components.

## Temporary Rules

- Do not worry about data migration. No migration steps when changing persisted data shapes.
- Do not inspect, read, modify, or reason about Canvas View code (`src/view/canvas/`). Treat it as if it doesn't exist.

## Working Rules

- Use custom CSS tooltips (not Floating UI) inside the Canvas View — the CSS transform breaks Floating UI positioning.
- Do not confuse copies (new chats from a copied path) with side chats (sibling branches). See `ARCHITECTURE.md`.
