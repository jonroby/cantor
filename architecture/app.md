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
