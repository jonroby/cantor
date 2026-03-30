# Domain

## Purpose

`src/domain/` contains app-specific business meaning.

This is not a bucket for all pure code. It is where the rules of branching conversations live.

## What Belongs Here

- conversation tree structures
- branching invariants
- copy/promote/delete semantics
- app-specific search rules
- app-specific pure data transformations

## What Does Not Belong Here

- generic helpers
- persistence code
- network code
- browser APIs
- UI concepts
- Svelte state

## Current Examples

- [src/domain/tree/index.ts](/Users/jonroby/ai/superset-svelte/src/domain/tree/index.ts)
- [src/domain/search/index.ts](/Users/jonroby/ai/superset-svelte/src/domain/search/index.ts)
- [src/domain/models/index.ts](/Users/jonroby/ai/superset-svelte/src/domain/models/index.ts)

## Tests

Domain code should be testable with plain data.

If a module needs browser mocks, reactive store setup, or network stubs just to test the main logic, it is probably in the wrong place.

## Placement Test

Put code in `domain` if all of these are true:

- it expresses app meaning
- it is pure
- it should remain true regardless of storage technology

If it is pure but generic, it belongs in `lib`, not `domain`.
