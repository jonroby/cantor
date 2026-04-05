# Landing Page — Feature Flows Plan

## Context

The landing page currently shows a single looping HTML animation (`WorkflowChat.svelte`) of a user typing a message and the sidebar collapsing. The goal is to expand this into **5 distinct feature flows**, each demonstrating a key capability of Cantor. A Railway-style tab bar below the demo frame labels each flow; when a flow's animation ends it auto-advances to the next, and the user can also click any tab to jump directly.

---

## File Structure

```
src/view/components/landing/
├── LandingPage.svelte          ← add FlowPlayer, update preview section
├── FlowPlayer.svelte           ← NEW: tab bar + flow switcher shell
├── flows/
│   ├── FlowChat.svelte         ← renamed from WorkflowChat.svelte (Flow 1)
│   ├── FlowProviders.svelte    ← NEW stub → Flow 2
│   ├── FlowTokens.svelte       ← NEW stub → Flow 3
│   ├── FlowDocuments.svelte    ← NEW stub → Flow 4
│   └── FlowAgent.svelte        ← NEW stub → Flow 5
└── index.ts                    ← no change
```

---

## Flow Registry

A single array in `FlowPlayer.svelte` defines all flows. Reordering or adding flows = editing this array only.

```ts
const flows = [
	{ id: 'chat', label: 'Conversations', component: FlowChat },
	{ id: 'providers', label: 'Providers', component: FlowProviders },
	{ id: 'tokens', label: 'Tokens', component: FlowTokens },
	{ id: 'documents', label: 'Documents', component: FlowDocuments },
	{ id: 'agent', label: 'Agent', component: FlowAgent }
];
```

---

## FlowPlayer.svelte

- Tracks `activeIndex` (which flow is playing)
- Renders the active flow component, passing an `onComplete` prop
- When `onComplete` fires, increments `activeIndex % flows.length`
- Tab bar at the bottom: 5 tabs separated by `|` dividers, active tab highlighted with a pill background (dark, matches the Railway style)
- Clicking a tab sets `activeIndex` directly and restarts that flow

### Tab bar style

- Sits below the demo frame, not inside it
- Background: transparent (inherits landing page bg)
- Tabs: muted text, active tab gets a dark rounded pill
- Separated by faint `|` dividers

---

## Flow interface

Each flow component accepts:

```ts
interface Props {
	onComplete: () => void;
}
```

The flow calls `onComplete()` at the end of its GSAP timeline (before reset, so the tab switches and the new flow fades in cleanly). The `repeat: -1` on the timeline is removed — each flow runs once, calls `onComplete`, and the parent remounts the next flow.

---

## Flow 1: Conversations (FlowChat)

Rename `WorkflowChat.svelte` → `flows/FlowChat.svelte`. Changes:

- Remove `repeat: -1, repeatDelay: 1.5` from GSAP timeline
- At end of timeline call `onComplete()`
- Keep all existing animation stages (type → send → stream response → sidebar collapse → expand)

---

## Flow 2: Providers (FlowProviders) — stub → implement later

Show:

1. Model chip in composer is clicked → model palette slides up
2. Provider logos animate in (Claude, OpenAI, Gemini, Mistral, Ollama, WebLLM)
3. A provider is selected, chip updates
4. Encrypted key badge fades in ("Keys stored locally · Web Crypto AES-256")

---

## Flow 3: Tokens (FlowTokens) — stub → implement later

Show:

1. Context window progress bar fills as messages accumulate
2. Context settings opens → three strategies shown (Full, LRU, BM25)
3. Strategy is selected, token count updates

---

## Flow 4: Documents (FlowDocuments) — stub → implement later

Show:

1. Folder panel opens in split view
2. A `.md` file opens with rendered math/SVG content
3. A function plot renders
4. Download button is clicked

---

## Flow 5: Agent (FlowAgent) — stub → implement later

Show:

1. Agent toggle activates in composer footer
2. Tools palette opens showing tool list (read_file, write_file, search, etc.)
3. Some tools are deselected ("reducing token usage" label)
4. Agent runs: tool call indicators stream in between messages

---

## LandingPage.svelte changes

- Replace `import WorkflowChat` with `import FlowPlayer`
- Replace `<WorkflowChat />` with `<FlowPlayer />`
- The `.preview` wrapper stays identical — `FlowPlayer` fills it

---

## Stub implementation

Flows 2–5 initially render a placeholder that:

- Shows the demo frame with sidebar + composer (shared base layout)
- Displays the flow label centered in the chat area
- Calls `onComplete()` after 3 seconds

This lets the tab switcher work end-to-end before the real animations are built.

---

## Critical files

| File                                                     | Action                                                  |
| -------------------------------------------------------- | ------------------------------------------------------- |
| `src/view/components/landing/LandingPage.svelte`         | Swap WorkflowChat → FlowPlayer                          |
| `src/view/components/landing/WorkflowChat.svelte`        | Rename → `flows/FlowChat.svelte`, add `onComplete` prop |
| `src/view/components/landing/FlowPlayer.svelte`          | CREATE: registry + tab bar + switcher                   |
| `src/view/components/landing/flows/FlowProviders.svelte` | CREATE: stub                                            |
| `src/view/components/landing/flows/FlowTokens.svelte`    | CREATE: stub                                            |
| `src/view/components/landing/flows/FlowDocuments.svelte` | CREATE: stub                                            |
| `src/view/components/landing/flows/FlowAgent.svelte`     | CREATE: stub                                            |

---

## Verification

1. `bun run dev` — landing page loads
2. Flow 1 plays the full chat animation then tab advances to Flow 2
3. Flow 2 stub shows placeholder for 3s then advances to Flow 3, etc.
4. Clicking any tab jumps directly to that flow
5. `bun run typecheck` — no errors
