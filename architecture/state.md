# State

## Purpose

`src/state/` contains app runtime state.

This is the app’s working memory while it is running.

## What Belongs Here

- chats in memory
- active chat or selection state
- provider selection state
- document state in memory
- shared runtime state needed by workflows

## What Does Not Belong Here

- localStorage access
- SQLite access
- `fetch`
- stream transport
- file APIs
- crypto
- browser boundary code
- orchestration

## Meaning

`state` is not:

- local UI state
- persistence
- external data sources

It is app-owned in-memory state.

## Current Examples

Likely examples in this repo:

- chat state
- document state
- provider runtime state

## Relationship To Other Areas

- `state` may import `domain` and `lib`
- `state` must not import `external`
- `app` reads and writes `state`

If state needs to be loaded from persistence or updated from external data, `app` coordinates that through `external`.
