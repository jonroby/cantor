# Root Rules

## Purpose

These rules are for reviewing changes quickly and consistently.

They are stricter and more local than `architecture/ARCHITECTURE.md`.

## Current Layer Truth

- `view` talks only to `app`
- `app` may import `domain`, `lib`, `state`, and `external`
- `state` may import only `domain` and `lib`
- `external` may import only `domain` and `lib`
- `domain` and `lib` must stay pure

## Current Repo Truth

- `app.search`, `app.files`, and `app.content` are gone on purpose
- `app.chat.getState()` is gone
- `app.chat.getCommandHistory()` is gone
- `branch` terminology should stay gone from active code
- `commands.ts` / `queries.ts` should not be reintroduced as a pattern
- `domain.constraints` is checks-only, not fixer logic
- `external.streams` is boundary-only; it should not assemble app semantics
- `state.chats` should stay chat/tree-shaped, not raw `ExchangeMap`-bag-shaped
- `lib` should stay small

## Naming

- Prefer `document` / `documents`
- Avoid new `doc` / `docs` identifiers in code
- Prefer names that describe domain meaning, not mechanism
- Avoid stale internal shorthand leaking into public exports

## Review Priorities

Flag these first:

- boundary violations
- reintroduced deleted namespaces or exports
- app/external/state forwarding leaks
- stale naming
- new public API surface with weak ownership
- convenience helpers that should be local or private

## Current Weirdness That Is Intentional

- `lib/provider-defaults.ts` and `lib/provider-types.ts` remain in `lib`
- this is not ideal semantically
- it is required by the current import rules because `state` may not import `external`

## Default Review Mode

When reviewing changes:

1. read this file
2. read the nearest module rule file
3. judge the diff against those rules
4. prefer identifying regressions over redesign ideas
