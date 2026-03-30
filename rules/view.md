# View Rules

## Purpose

`view` owns presentation, UI state, and rendering helpers.

## Good

- components
- panel state
- rendering pipelines
- UI-local derivations
- visual behavior

## Bad

- imports from `domain`, `lib`, `state`, or `external`
- browser boundary work that should be in `external`
- business rules that should be in `domain`
- orchestration that should be in `app`

## Current Truth

- non-canvas active code should use `side chat`, not `branch`
- visual structure should not be changed casually
- frontend-owned helpers like KaTeX block rendering should stay in `view`

## Red Flags

- direct lower-layer imports
- state mutation logic in components
- feature orchestration bypassing `app`
- rendering helpers being moved into `lib`
