# External Rules

## Purpose

`external` owns boundaries:

- persistence
- browser file APIs
- provider calls
- streams
- vault/crypto

## Good

- boundary validation
- transport adapters
- persistence reads/writes
- browser and worker mechanics

## Bad

- app workflow semantics
- direct runtime-state ownership
- feature naming policy
- view concerns

## Current Truth

- `external.streams` should take prepared history, not assemble chat semantics
- `external.io` should return neutral validated shapes, not state records
- persistence may enforce constraints at the boundary

## Red Flags

- boundary code reading app state directly when explicit inputs would do
- naming/dedup policy inside `external`
- return types tied to `state`
- product-specific “what should happen” logic instead of boundary mechanics
