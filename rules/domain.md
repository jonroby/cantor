# Domain Rules

## Purpose

`domain` is app-specific meaning and rules.

It is not a generic utility bucket.

## Good

- pure domain constraints
- pure tree/chat/document logic
- stable semantic names
- structural operations and projections

## Bad

- app runtime/session state
- browser/platform concerns
- UI wording or view models
- fixer behavior inside constraints

## Current Truth

- `domain.tree` was reduced heavily
- `domain.tree.constraints` owns `canDoX`-style checks
- `domain.constraints` is checks-only

## Red Flags

- new wrapper-on-wrapper exports
- public helpers that are one-line convenience compositions
- names that expose current storage shape instead of domain meaning
- public APIs that fabricate fake data to satisfy a type
