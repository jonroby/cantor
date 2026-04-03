# Codebase Audit Plan

## Remaining Issues

### 1. Remove or Gitignore `AGENT_ARCHITECTURE_PLAN.md`

This planning document was added on the branch. It is a working artifact, not source code, and likely should not be committed.

---

### 2. Unify Streaming: Agent Is the General Case, Chat Is Agent Without Tools

**Core idea:** There are currently two parallel streaming systems doing the same thing differently.

**System 1 — `external/streams`** (xstate state machine):

- Used for plain chat mode
- State machine with `streaming → awaiting_tools → streaming → done` lifecycle
- Already supports tool turns via `ToolExecutor` callback
- Writes responses back to the tree via injected deps
- Manages its own store (`streamingIds`, `actors`, `actorChatIds`)

**System 2 — `app/chat` inline agent loop** (manual `for` + `AbortController`):

- Used for agent mode
- Manual loop: stream → collect tool calls → execute → append messages → loop
- Owns its own abort controllers and chat ID tracking (`agentAbortControllers`, `agentRunChatIds`)
- Writes responses via `updateExchangeResponse`
- Writes thinking events to `state.agent`

Both do: stream chunks → optionally handle tool calls → write response to tree. The only real differences are:

- Agent loop writes thinking events to `state.agent`
- Agent loop runs verification after tool execution
- Agent loop builds structured Anthropic-format messages for multi-turn

**The model:**

- **Agent** = the general runtime. Streams, handles tool turns, writes responses.
- **Chat** = agent with tools disabled. Same runtime, just `tools: []`.
- Both modes exist because some provider/model combos can't handle tool use.

**Migration plan:**

**Step 1: Move agent loop from `app/chat` into `app/agent`**

Move these from `app/chat/index.ts` into `app/agent/index.ts`:

- `startAgentRun`, `runAgentLoop`
- `updateExchangeResponse`, `summarizeInput`, `buildVerificationSummary`, `getVerificationLines`
- `agentAbortControllers`, `agentRunChatIds` maps
- Agent-specific parts of `isStreaming`, `stopStream`, `stopChatStreams`

Export `agent.startRun(chatId, exchangeId, model, history, toolContext)` and `agent.stopRun(exchangeId)`.

`app/chat.submitPrompt` calls `agent.startRun(...)` for agent mode, keeps `external.streams.startStream(...)` for chat mode (for now).

**Step 2: Unify onto `external/streams`**

The xstate machine already supports tool turns (`awaiting_tools` state, `ToolExecutor` interface). Extend it so agent mode uses the same machine:

- Agent's `ToolExecutor.execute()` calls `agent.executeTool()` + verification, returns results + summary
- Thinking events are emitted via a callback or event bus that the executor writes to
- The machine handles the multi-turn message assembly (it already tracks `rawMessages`)
- `app/agent` becomes: tool definitions + tool execution + thinking state + `ToolExecutor` factory
- `external/streams` becomes: the single streaming runtime for both modes

After this, `app/chat.submitPrompt` always calls `external.streams.startStream(...)`, passing `tools` and `toolExecutor` when in agent mode, omitting them for chat mode. One path, parameterized.

**Step 3: Clean up**

- Remove the manual `for` loop, `AbortController` management, and duplicate response-writing from `app/agent`
- `state.agent` thinking/streaming state gets driven by the stream machine events
- `app/chat` shrinks significantly — no more agent orchestration code

---

### 3. `app/chat` `submitPrompt` Assembles History Inline

After the streaming unification (issue 2), revisit. The history assembly (flatMap exchanges → messages, splice document context, splice system prompt) may simplify naturally once there's one path. If it doesn't, extract a private `buildHistory` function in `app/chat`.

---

### 4. `importChat` and `importFolder` Use Unstructured `void Promise` Patterns

Low priority. These fire `void pickFile().then(...)` — callers can't await or chain. Minor smell but not blocking.

---

## CSS Cleanup

### Current State

The codebase uses three styling approaches that don't follow a clear rule:

- **Scoped `<style>` blocks** — most feature components (Document, ChatView, AgentActivity, etc.)
- **Tailwind utility classes** — shadcn components, sidebar, a handful of others
- **Global CSS files** — `layout.css`, `palette.css`, `function-plot.css`

Some components mix all three.

**Specific problems:**

- **Units are inconsistent.** `px` and `rem` used interchangeably for the same kinds of values. `gap: 8px` next to `gap: 0.4rem`. Padding ranges from `6px 10px` to `0.75rem 0.85rem`.
- **No type scale.** 13+ font sizes: `11px`, `12px`, `13px`, `14px`, `15px`, `16px`, `18px`, `20px`, `0.7rem`, `0.78rem`, `0.8125rem`, etc.
- **No radius scale.** `4px`, `6px`, `8px`, `12px`, `0.4rem`, `0.5rem`, `0.7rem`, `0.75rem`, `999px`, `50%` all used for similar elements.
- **Repeated patterns everywhere.** `gap: 8px` appears 11 times, `border: 1px solid hsl(var(--border))` 7 times, `margin: 0 auto` 6 times, `border-radius: 12px` 6 times.
- **41 `:global()` usages** across 7 files — component style boundaries leaking.
- **4 `!important` uses** — `function-plot.css` (hardcoded colors) and `App.svelte` (composer width).
- **Hardcoded colors** in `function-plot.css` (`#1a1a1a`, `#999`, `#fff`) and `palette.css` (`white`, `#6366f1`).

### Plan

**Phase 1: Define a shared scale in Tailwind config / CSS variables**

Establish tokens for the repeated values so both Tailwind classes and any remaining scoped CSS reference the same scale:

- **Spacing:** Standardize on Tailwind's scale (`gap-1` = 4px, `gap-2` = 8px, etc.). Stop mixing px and rem.
- **Font sizes:** Pick 5-6 sizes and name them. The most common is `13px` (used 15 times) — that's the base.
- **Border radius:** Pick 3-4 values (e.g., `sm` = 4px, `md` = 8px, `lg` = 12px, `full` = 999px).
- **Transitions:** Standardize on 1-2 durations (currently `120ms`, `150ms`, `200ms`, `250ms` all in use).

**Phase 2: Port simple components to Tailwind**

Migrate components with small or medium style blocks. These are the ones where scoped CSS is just applying common utilities (flex, gap, padding, colors) and Tailwind would be a direct replacement with less code.

Candidates (roughly ordered by simplicity):

| Component                   | Style lines | Notes                                          |
| --------------------------- | ----------- | ---------------------------------------------- |
| `ChatView.svelte`           | ~30         | Mostly layout, `:global()` for child overrides |
| `App.svelte`                | ~75         | Panel layout, composer anchor                  |
| `FolderDocumentView.svelte` | ~149        | Folder header, dropdown, file picker           |
| `AgentActivity.svelte`      | ~177        | Thinking events, streaming indicators          |
| `ModelPalette.svelte`       | ~68         | Plus separate `palette.css` (324 lines)        |
| `DrawingBoard.svelte`       | ~99         | Canvas wrapper                                 |
| `FolderItem.svelte`         | small       | Sidebar folder item                            |
| `DocumentItem.svelte`       | small       | Sidebar doc item                               |
| `ChatItem.svelte`           | small       | Sidebar chat item                              |

**Phase 3: Leave complex components as scoped CSS (but standardize their tokens)**

These have genuinely complex CSS (diff viewers, code editors, responsive layouts) where utility classes would be worse. Keep scoped CSS, but make them use the shared scale from Phase 1.

| Component             | Style lines | Why keep scoped                               |
| --------------------- | ----------- | --------------------------------------------- |
| `Document.svelte`     | 308         | Diff viewer, editor states, streaming preview |
| `LandingPage.svelte`  | 253         | Responsive hero, feature grid, typography     |
| `CodeEditor.svelte`   | 168         | Code sandbox, terminal output                 |
| `PythonEditor.svelte` | 168         | Python executor, similar to CodeEditor        |
| `Composer.svelte`     | scoped      | Input area with complex states                |

**Phase 4: Clean up global CSS**

- `function-plot.css` — Replace hardcoded hex colors with CSS variables. Remove `!important`.
- `palette.css` — Replace `white`, `#6366f1`, `rgba(99, 102, 241, 0.08)` with theme variables. Consider inlining into `ModelPalette.svelte` or porting to Tailwind.
- `layout.css` — Review what's still needed vs what's been superseded by component styles. Reduce or eliminate.
- `index.css` — Already good (theme tokens). Keep as-is.

**Phase 5: Eliminate `:global()` leaks**

41 usages across 7 files. Most are components styling children they don't own (e.g., `.chatview-doc-wrap > :global(.document)`). For each:

- If the child component can accept a `class` prop, pass it instead
- If it's a shadcn primitive, use Tailwind on the wrapper
- If it's truly needed (e.g., third-party library styling), document why
