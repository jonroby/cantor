# App

## Purpose

`src/app/` is the orchestration layer.

This is the controller layer of the application.

## What Belongs Here

- user actions
- workflows
- multi-step operations
- orchestration across domain, state, and external
- view-facing queries or view-model builders when useful

## What Does Not Belong Here

- generic helpers
- raw persistence code
- raw network clients
- vendor UI components
- app-specific business definitions that should live in `domain`

## Core Rule

`app` is the only place that coordinates across architectural areas.

If code:

- reads runtime state
- uses business rules
- calls persistence or APIs
- writes state again

then it belongs in `app`.

## Public API Rule

The public API of `app` should stay small and intentional.

- many private helpers inside an `app` module are fine
- many exported cross-area functions are not fine
- `view` should get only what it actually needs

Good:

- a few feature-shaped actions
- a few view-facing queries
- small compatibility aliases during a transition

Bad:

- exporting every helper just because `view` might use it
- turning `app` into a giant pass-through surface for lower layers
- exposing low-level primitives when a higher-level workflow API would do

The boundary should reduce knowledge, not merely relocate it.

## Namespace Rule

`app` is consumed as an organizational namespace.

Prefer:

- `app.chat.submitPrompt()`
- `app.documents.performOpenDocument()`
- `app.files.uploadFolder()`
- `app.runtime.chatState`

Do not prefer flat named imports from `@/app` in normal source files.

The point is to keep ownership visible at the call site.

`app` submodules are explicit and finite:

- `chat`
- `search`
- `runtime`
- `content`
- `documents`
- `providers`
- `files`
- `types`

Adding a new top-level `app` submodule should be a deliberate architecture change, not an ad hoc convenience.

## Typical Flow

1. Read current state
2. Use `domain` and `lib` to decide what should happen
3. Update state
4. Call `external` if needed
5. Apply follow-up updates

## Current Examples

- chat actions
- provider workflows
- document workflows

## Relationship To Other Areas

- `app` may import `domain`, `lib`, `state`, and `external`
- `view` calls `app`
- `app` must not import `view`
