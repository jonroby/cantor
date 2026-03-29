# External

## Purpose

`src/external/` contains code that crosses the app boundary.

“External” does not mean “remote.” It means outside the in-memory app.

## What Belongs Here

- localStorage persistence
- future SQLite persistence
- provider HTTP clients
- streaming transport
- file import/export
- crypto and vault code
- browser APIs at the app boundary
- worker bridges

## What Does Not Belong Here

- workflows
- runtime app state
- UI concepts
- business rules that can be pure

## Meaning

`external` is where the app talks to:

- persistence
- the network
- the browser as a platform
- files
- worker processes

## Public API Rule

The public API of `external` should stay small.

- many private helpers inside `external` modules are fine
- many exported boundary primitives are not fine
- `app` should depend on the smallest feature-shaped external contract possible

Prefer exports like:

- `importChatFile`
- `exportFolderZip`
- `loadPersistedState`

Over exports like:

- `createBlobUrl`
- `readTextFile`
- `openFilePicker`

when the lower-level primitives do not need to cross the layer boundary.

## Namespace Rule

`external` is consumed as an organizational namespace.

Prefer:

- `external.persistence.loadFromStorage()`
- `external.files.validateChatUpload()`
- `external.providers.fetchAvailableModels()`
- `external.streams.startStream()`

The namespace should tell the reader what kind of boundary they are crossing.

## Current Examples

Likely examples in this repo:

- persistence layer
- provider integrations
- stream transport
- import/export adapters

## Relationship To Other Areas

- `external` may import `domain` and `lib`
- `external` must not import `state`
- `app` is the only layer that should coordinate `external` with the rest of the app

## Persistence Rule

Persistence rules are not domain rules.

Examples:

- “conversation tree has one root” is a domain rule
- “table has a foreign key” is a persistence rule

Persistence may enforce domain constraints, but it does not define business meaning.
