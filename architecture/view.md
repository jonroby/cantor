# View

## Purpose

`src/view/` contains the Svelte UI.

It owns rendering, presentation logic, and UI-only state.

## What Belongs Here

- Svelte components
- routes
- layout
- CSS
- local UI state
- presentation logic
- UI-only view models

## What Does Not Belong Here

- persistence clients
- provider/network clients
- direct external boundary code
- cross-layer orchestration
- domain or runtime state ownership

## UI-Only Concepts

These belong in `view` even when they contain logic:

- panels
- dialogs
- tabs
- hover state
- focus state
- expanded/collapsed state
- layout-specific shaping
- display-only projections

If something only exists because the UI exists, it belongs here.

## Relationship To Other Areas

- `view` may import `app` and `view`
- `view` must not import `domain`, `lib`, `state`, or `external`

That restriction is intentional. It removes placement ambiguity and forces workflows through `app`.

## How View Gets Data

`view` should receive:

- actions from `app`
- view-facing data from `app`

This keeps the UI layer focused on rendering and interaction, not architecture decisions.

## Current Examples

- classic chat components
- canvas UI
- shared components
- feature components
- route-level composition
