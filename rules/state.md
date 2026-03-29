# State Rules

## Purpose

`state` is runtime in-memory app state.

It should be dumb compared to `app`.

## Good

- runtime records
- selection state
- small direct mutations
- chat/document/provider state storage

## Bad

- browser/file/persistence logic
- orchestration
- transport logic
- feature-heavy tree surgery

## Current Truth

- `state.chats` should expose chats/trees, not raw exchange-map bag helpers
- `copyToNewChat` no longer belongs in state
- `state.providers` should stay mostly raw provider runtime state

## Red Flags

- new `ExchangeMap`-only accessors/mutators in public state
- duplicated policy/config logic in state
- workflow logic that belongs in `app`
