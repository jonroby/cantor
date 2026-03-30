# App Rules

## Purpose

`app` is the feature orchestration layer.

It should expose app-shaped APIs, not forward lower layers.

## Good

- feature actions
- feature read models
- combining `domain`, `state`, and `external`
- small public namespaces:
  - `bootstrap`
  - `chat`
  - `documents`
  - `providers`

## Bad

- re-exporting raw state objects
- re-exporting external functions directly
- exposing low-level transport or persistence concerns
- reintroducing deleted namespaces:
  - `search`
  - `files`
  - `content`

## Naming

- prefer feature meaning over implementation
- keep `document` terminology consistent
- `side chat` is correct, not `branch`

## Red Flags

- `app` exports that look identical to `state.*` or `external.*`
- view-model shaping that belongs in `view`
- product semantics pushed down into `state` or `external`
- large dependency injection bags for simple cases
