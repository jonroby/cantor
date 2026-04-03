# Agent Architecture Plan

## Goal

Make tool-enabled interaction a first-class capability without splitting conversation ownership across multiple stacks.

The product intent is:

- normal chat remains available
- agent mode is a chat session with tools, inspection, and multi-step execution
- the agent should be able to do nearly every reasonable action a human can do in the app
- the agent should be able to inspect app-readable state to verify that actions actually happened
- agent mode should expose a collapsible thinking-history timeline in the UI, with live updates while work is in progress

This plan does not change the core rule that `app` owns orchestration, `state` stays dumb, and `external` stays boundary-only.

## Architectural Position

For this codebase, the right center of gravity is still chat-owned orchestration.

Why:

- the main persistent object is still a chat tree
- streaming output is attached to chat exchanges
- document context is attached to chat submission
- the product UI is conversation-first, even when the assistant is acting more like an agent

So the architecture should be:

- `app.chat` owns submission, tool loops, agent-mode orchestration, live progress, and verification loops
- `app.agent` becomes the capability registry plus agent-mode support surfaces
- `state.chats` remains the owner of conversation data
- [x] chat mode is owned by `state.chats` and persists with the conversation
- `state.agent` should be reduced to transient agent-mode UI/runtime state, not a second conversation history
- `external.providers` remains transport-only
- `external.streams` remains streaming runtime infrastructure only for plain transport concerns, not product semantics

## Problems In Current Code

### 1. Duplicate orchestration

There are currently two separate agent/chat execution paths:

- `app.agent.submit()`
- `app.chat.submitPrompt()` with tool plumbing through `external.streams`

That creates drift in:

- message building
- tool execution
- abort behavior
- progress reporting
- final response handling

There needs to be one owner for tool-enabled chat execution.

### 2. Boundary leakage in `external.streams`

`external.streams` currently:

- executes tools
- builds multi-turn tool messages
- writes product-specific progress text into responses

That violates the repo rule that `external` is boundary-only and should not assemble app semantics.

### 3. Agent state duplicates chat state

`state.agent.history` is a second conversation log outside the chat tree.

That is the wrong ownership model if agent mode is conceptually a chat with tools.

### 4. View-shaped inputs leak upward

Some app actions currently depend on view-derived details like open-document indices.

App actions should operate on semantic ids and keys, not UI positions.

## Target Module Layout

### `app.chat`

`app.chat` becomes the only owner of conversation execution.

Responsibilities:

- build submission history
- attach system instructions for plain chat vs agent mode
- start and control provider streaming
- run the tool loop
- run verification loops
- write incremental output into the active exchange
- write agent thinking events into transient runtime state
- finalize the exchange response

Suggested internal split:

- `src/app/chat/index.ts`
- `src/app/chat/context.ts`
- `src/app/chat/agent-session.ts`
- `src/app/chat/agent-prompt.ts`

These can still export through `src/app/chat/index.ts`.

### `app.agent`

`app.agent` should stop being a parallel chat runtime.

It should instead own:

- capability definitions
- capability discovery
- tool schema generation
- tool dispatch adapters
- state inspection/read-model adapters for verification
- transient agent-mode UI state accessors if needed by view

Suggested internal split:

- `src/app/agent/index.ts`
- `src/app/agent/capabilities.ts`
- `src/app/agent/inspect.ts`
- `src/app/agent/thinking.ts`

### `state.chats`

Conversation ownership stays here.

Add chat-owned config for mode:

```ts
type ChatMode = 'chat' | 'agent';
```

Potentially:

```ts
interface ChatRecord {
  id: string;
  name: string;
  rootId: string;
  exchanges: ExchangeMap;
  activeExchangeId: string | null;
  contextStrategy: ContextStrategy;
  mode: ChatMode;
}
```

This keeps mode attached to the thing that actually owns the conversation.

### `state.agent`

Reduce this to transient runtime state only.

It should no longer own the actual conversation history.

It may own:

- pending document proposal
- current thinking events for the active exchange
- whether the thinking panel is expanded/collapsed
- last tool activity summary if needed for UI

## Capability System

## Goal

The agent should be able to discover what it can do by reading a structured module surface rather than relying only on a giant prompt paragraph.

The capability system should expose:

- what actions exist
- what reads/inspection calls exist
- what inputs each action accepts
- what verification reads can confirm success
- what actions are intentionally unavailable

## Shape

Each capability should be app-owned and feature-shaped.

Example conceptual shape:

```ts
interface AgentCapability {
  id: string;
  description: string;
  actions: AgentAction[];
  reads: AgentRead[];
}

interface AgentAction {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (input: Record<string, unknown>, ctx: AgentActionContext) => AgentActionResult;
  verifyWith?: string[];
}

interface AgentRead {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (input: Record<string, unknown>, ctx: AgentReadContext) => string;
}
```

This should be built from app-level modules, not from `view`, and not from direct `state` mutation helpers.

## Initial capability modules

### Documents capability

Actions:

- create file
- rename document
- delete document
- move document
- create folder
- rename folder
- delete folder
- open document
- open folder
- propose edit to current document

Reads:

- list folders
- read document
- inspect open document
- inspect current folder contents

### Chats capability

Actions:

- create chat
- select chat
- rename chat
- delete chat

Reads:

- list chats
- inspect active chat
- inspect active exchange

### Workspace capability

Actions:

- close panel
- potentially other safe workspace actions that humans can do

Reads:

- [x] inspect current workspace panels
- [x] inspect active document key
- [x] inspect sidebar state

## Progress

- [x] Workspace shell state (`panels`, `sidebarOpen`, `expandedFolders`) moved out of `view` local state and into `state.workspace`
- [x] `app.bootstrap` now hydrates and persists workspace state as an app-owned source of truth
- [x] Agent workspace inspection reads actual app/state-backed workspace state instead of view-local state

This module should explicitly omit toggling the user-facing chat/agent mode, per product intent.

## Capability System Rules

- Capabilities should wrap app semantics, not raw state mutation helpers.
- Reads should be easy for the agent to call after every action.
- Actions should return structured results with ids and names when possible.
- A capability should declare which reads are useful for verification.
- The agent prompt should summarize capabilities, but the registry should be the source of truth.

## Verification Model

## Goal

Agents hallucinate. The runtime should make verification easy and cheap.

Every important action should be followed by a read path the agent can use to confirm the result.

Examples:

- after creating a file, read folder contents or read the file by id
- after renaming a folder, list folders and confirm the new name
- after opening a document, inspect workspace panels and active document key

## Design

Actions should return structured metadata:

```ts
interface AgentActionResult {
  ok: boolean;
  message: string;
  createdIds?: string[];
  updatedIds?: string[];
  suggestedVerificationReads?: Array<{
    name: string;
    input: Record<string, unknown>;
  }>;
}
```

This lets the tool loop do one of two things:

- expose the result and let the model decide to verify
- or automatically encourage a follow-up verification read in the next turn

The key requirement is that the app surface exposes enough state inspection for the agent to confirm its own work.

## Verification policy

Use verification by default for:

- create
- rename
- delete
- move
- open/selection changes
- document proposal application

Verification can be skipped for clearly read-only operations.

## Tool Loop Design

## Single owner

There should be one tool-enabled execution pipeline in `app.chat`.

High-level flow:

1. Build chat history from the chat tree.
2. Add agent-mode system instructions and capability summary.
3. Stream provider output.
4. Collect tool calls.
5. Dispatch tool calls through `app.agent` capability registry.
6. Record live thinking events.
7. Run verification reads when needed.
8. Continue until the provider produces a final assistant response.
9. Write the final assistant response into the chat exchange.

## Provider boundary

`external.providers.stream` may expose:

- text deltas
- tool-use blocks
- stop metadata

It should not:

- execute tools
- decide what progress text to show the user
- mutate chats
- build verification summaries

## `external.streams`

Two acceptable options:

- keep `external.streams` only for plain streaming runtime mechanics and remove tool semantics from it
- or bypass it for agent-mode runs and let `app.chat` own the loop directly

Either option is fine. The important thing is that tool semantics leave `external`.

## Thinking History

## Product intent

This is not for one-off plain chats.

This is specifically for agent-mode runs where the assistant is doing staged work like:

- inspecting available functions
- deciding what to call
- calling tools
- checking whether work succeeded
- continuing if verification fails

The current behavior of writing rolling text directly into the chat response is not the right model for this.

## Desired behavior

In agent mode:

- live status should update while the agent is working
- the user should see concise current progress without flooding the main chat exchange
- the full step-by-step history should be available in a collapsible UI item
- once the run completes, the assistant should still write a normal final chat response

## Data model

Thinking history should be a structured event stream, not a freeform second chat transcript.

Conceptual shape:

```ts
type ThinkingEvent =
  | { type: 'note'; text: string; createdAt: number }
  | { type: 'tool_call'; toolName: string; inputSummary: string; createdAt: number }
  | { type: 'tool_result'; toolName: string; resultSummary: string; createdAt: number }
  | { type: 'verification'; text: string; createdAt: number }
  | { type: 'status'; text: string; createdAt: number };
```

Suggested runtime ownership:

- keyed by active exchange id
- stored in transient state
- resettable when a run ends or when the user dismisses it

## UX behavior

- main exchange shows a compact live status while running
- the thinking history panel is collapsible
- the final assistant answer remains the user-facing completion message
- thinking history remains inspectable after completion until the user navigates away or dismisses it

## Important distinction

Thinking history is not chain-of-thought capture.

It is an execution log of user-visible work, such as:

- what capability the agent is inspecting
- what tool it is calling
- what happened
- how it verified the result

It should be written as operational progress, not hidden reasoning.

## App-State Inspection Surface

The agent needs easy reads across app-owned state.

That means providing read tools backed by app-level projections, such as:

- active chat summary
- list of chats
- active document summary
- document-by-id read
- folder tree read
- workspace panel summary
- active selection summary

These should be exposed as stable app read models, not direct raw `state` internals.

The goal is:

- easy to inspect
- easy to verify
- stable enough to prompt against

## Implementation Phases

## Phase 1: Unify ownership

- [x] move tool-enabled orchestration into `app.chat`
- [x] remove tool execution and progress semantics from `external.streams`
- [x] reduce `app.agent` to capability registry plus support surfaces
- [x] remove `state.agent.history`

## Phase 2: Capability registry

- [x] add capability module definitions
- [x] generate tool definitions from the registry
- [x] route execution through registry-owned dispatch
- [x] add read/inspection tools
- [x] make capability metadata the source of truth for agent prompting
- [~] expand capabilities toward full human-parity app actions

## Phase 3: Verification

- [x] return structured action results
- [x] add verification read helpers
- [x] make the tool loop append verification events into thinking history
- [x] tighten verification policy so important writes always verify before final response

## Phase 4: Thinking history

- [x] add transient thinking-event state keyed by exchange
- [x] add live status updates
- [x] expose a collapsible history model to the UI
- [x] stop using the main exchange as the live work log
- [x] polish agent-history presentation across all relevant chat surfaces

## Phase 5: Cleanup

- [x] update tests and API contracts
- [x] remove dead `app.agent.submit()` style surfaces if no longer needed
- [x] tighten names so the public API reflects ownership clearly

## Non-Goals

- making `agent` the top-level persistent domain object right now
- turning chats into just one tool under a task-first architecture
- exposing raw internal state mutation helpers directly as agent tools
- allowing the agent to toggle product mode/state that should remain user-controlled

## Future Revisit

If the product later becomes truly agent-first, revisit a larger redesign where:

- `agent session` becomes the primary domain object
- chats become one projection or one capability among several
- long-running tasks exist independently of any one chat thread

That is a valid future direction, but it is not the smallest coherent change from the current codebase.
