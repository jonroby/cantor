# Lib Rules

## Purpose

`lib` is small shared support code.

It should stay generic enough to justify cross-layer reuse.

## Good

- pure reusable helpers
- parsing/validation helpers
- naming helpers used in multiple places

## Bad

- app-specific workflows
- rendering/view infrastructure
- provider transport logic
- large generic “toolbox” growth

## Current Truth

- `rename` belongs here
- `validate-md` belongs here
- provider defaults/types remain here because `state` may import only `domain` and `lib`

## Red Flags

- view-owned logic moving back into `lib`
- one-off helpers exported just to avoid local code
- provider-specific logic that is not actually shared across layers
