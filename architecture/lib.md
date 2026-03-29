# Lib

## Purpose

`src/lib/` contains generic pure support code.

`lib` is preferred over a generic `utils` bucket because it implies deliberate shared code, not miscellaneous helpers.

## What Belongs Here

- generic text helpers
- generic parsing helpers
- generic diffing or transform helpers
- pure support code that could work in many unrelated apps

## What Does Not Belong Here

- app-specific business rules
- state
- side effects
- orchestration
- UI workflows

## Typical Modules

Examples that often fit here:

- generic rename/dedup helpers
- generic markdown utilities
- generic line diffing

## Placement Test

Put code in `lib` if:

- it is pure
- it is generic
- it does not encode the business meaning of this app

If it only makes sense for branching conversations, it is probably `domain`, not `lib`.
