# Landing Page — Feature Flows Plan

## Context for New Conversations

This plan is for the `landing` branch of the Cantor repo at `/Users/jonroby/ai/cantor`.

**What Cantor is:** Svelte 5 + Vite SPA. An LLM interface for power users. Browser-only state in IndexedDB.

**What this branch does:** Replaces the old hero video on the landing page with an animated HTML demo. The demo shows 5 feature flows, each as a looping animation, with a Railway-style tab bar that auto-advances between flows.

**Current state:**

- `src/view/components/landing/LandingPage.svelte` — landing page, imports `WorkflowChat` in the `.preview` section
- `src/view/components/landing/WorkflowChat.svelte` — a single GSAP-animated HTML component (Flow 1 prototype). Has sidebar + main panel + composer. Currently uses `repeat: -1` (infinite loop). Needs to be moved to `flows/FlowChat.svelte` and converted to call `onComplete()` once instead of looping.
- `PLAN.md` — this file, at repo root
- `package.json` — gsap 3.14.2 added as dependency
- No videos, no SVGs for the demo — pure HTML/CSS/GSAP

**Key constraint:** The demo HTML must be a pixel-perfect replica of the real app UI. Do NOT approximate — use the exact class names, CSS values, and measurements documented below.

---

## Real App CSS Variables (exact values)

```css
/* Colors */
--background: 0 0% 98% /* hsl → #f9f9f9 */ --foreground: 0 0% 9% /* hsl → #171717 */ --card: 0 0%
	100% /* white */ --muted: 0 0% 96% /* #f5f5f5 */ --muted-foreground: 0 0% 45% /* #737373 */
	--border: 0 0% 88% /* #e0e0e0 */ --sidebar: 0 0% 97% /* #f7f7f7 */ --sidebar-foreground: 0 0% 15%
	/* #262626 */ --sidebar-accent: 0 0% 91% /* #e8e8e8 */ --sidebar-border: 0 0% 88% /* #e0e0e0 */
	--primary: 0 0% 12% /* #1f1f1f */ /* Typography */ --text-sm: 12px --text-base: 12.75px
	--text-md: 13.75px --text-lg: 15px --text-sidebar: 13.75px /* Radius */ --radius-sm: 4px
	--radius-md: 8px --radius-lg: 12px --radius-full: 999px /* Layout */ --header-height: 52px
	--pane-content-width: 720px /* Surfaces */ --surface-tint: hsl(var(--foreground) / 0.08)
	--sidebar-surface-tint: hsl(var(--sidebar-accent) / 0.92) --surface-floating-shadow: 0 18px 40px
	hsl(var(--foreground) / 0.12) /* Icons */ --icon-muted: rgba(23, 23, 23, 0.56)
	--icon-strong: rgba(23, 23, 23, 0.88) --sidebar-icon-muted: hsl(var(--sidebar-foreground) / 0.52);
```

---

## Real App Component Measurements

### Sidebar (`AppSidebar.svelte`)

- Root bg: `hsl(var(--sidebar))` = `#f7f7f7`
- Border-right: `1px solid hsl(var(--border))` = `1px solid #e0e0e0`
- Header row height: `52px`, padding: `0 0.75rem 0 2rem`
- Brand name: `font-size: 17px; font-weight: 600; color: hsl(var(--sidebar-foreground) / 0.88)`
- Primary action buttons: `border-radius: 0.5rem; padding: 0.5rem 0.75rem 0.5rem 1.5rem`
- Section separator: `border-top: 1px solid hsl(var(--sidebar-border)); margin: 0.5rem 0`
- Section label: `font-size: 12px; color: hsl(var(--sidebar-foreground) / 0.5); padding: 0 0.75rem 0 1.5rem`
- Menu button height: `2.5rem` (40px), active bg: `hsl(var(--sidebar-accent))`
- Menu button active font-weight: `500`
- Content padding: `0.5rem` left and right

### Composer (`ComposerInput.svelte`)

- Shell: `border-radius: 1.25rem; border: 1px solid var(--border-color); background: hsl(var(--card)); box-shadow: 0 12px 40px hsl(var(--foreground) / 0.12)`
- Row padding: `0.85rem 1rem`
- Footer padding: `0.85rem 1rem`
- Footer border-top: `1px solid var(--border-color)`
- Attach button: `height: 2.25rem; width: 2.25rem; border-radius: 50%; border: 1px solid var(--border-color)`
- Send button: `border-radius: 50%`
- Textarea: `font-size: var(--text-lg)` = 15px, `line-height: 1.5`
- Footer right: `border-left: 1px solid var(--border-color); padding-left: 0.75rem; gap: 0.65rem`
- Progress track: `height: 0.35rem; border-radius: 999px; background: hsl(var(--muted))`
- Context label/count: `color: hsl(var(--muted-foreground))`
- Context settings btn: `width: 1.375rem; height: 1.375rem; border-radius: var(--radius-sm)`
- Model chip / mode chip: `ui-button-outline ui-button-size-sm` → `height: 2.1rem; padding: 0 0.85rem; border: 1px solid var(--border-color); background: hsl(var(--background))`

### Chat View (`ChatView.svelte`)

- Header height: `52px`, bg: inherits from `Header` primitive
- Title: `font-size: 13.75px; font-weight: 600`
- Exchanges container: `max-width: 720px; margin: 0 auto; gap: 1rem; padding-top: 1.5rem`
- Bottom spacer: `height: 8rem`
- User bubble: right-aligned, dark bg `hsl(var(--primary))` = `#1f1f1f`

---

## File Structure

```
src/view/components/landing/
├── LandingPage.svelte          ← swap WorkflowChat → FlowPlayer
├── FlowPlayer.svelte           ← NEW: registry + tab bar + switcher
├── WorkflowChat.svelte         ← DELETE after moving to flows/FlowChat.svelte
├── flows/
│   ├── FlowChat.svelte         ← moved from WorkflowChat.svelte + onComplete prop
│   ├── FlowProviders.svelte    ← stub
│   ├── FlowTokens.svelte       ← stub
│   ├── FlowDocuments.svelte    ← stub
│   └── FlowAgent.svelte        ← stub
└── index.ts                    ← no change
```

---

## Flow Registry (in FlowPlayer.svelte)

```ts
const flows = [
	{ id: 'chat', label: 'Conversations', component: FlowChat },
	{ id: 'providers', label: 'Providers', component: FlowProviders },
	{ id: 'tokens', label: 'Tokens', component: FlowTokens },
	{ id: 'documents', label: 'Documents', component: FlowDocuments },
	{ id: 'agent', label: 'Agent', component: FlowAgent }
];
```

Reordering or adding flows = editing this array only.

---

## FlowPlayer.svelte

- Tracks `activeIndex` (which flow is playing)
- Renders the active flow component via `{#key activeIndex}<ActiveFlow onComplete={advance}/>{/key}`
- `{#key}` remounts the component on each switch so GSAP timelines restart cleanly
- When `onComplete` fires: `activeIndex = (activeIndex + 1) % flows.length`
- Tab bar sits **below** the demo frame (not inside it)
- Active tab: dark rounded pill background
- Inactive tabs: muted text, separated by faint `|` dividers
- Clicking a tab sets `activeIndex` directly

---

## Flow interface

Each flow component:

```ts
interface Props {
	onComplete: () => void;
}
```

- No `repeat: -1` on the GSAP timeline
- Call `onComplete()` at the natural end of the timeline (after the final hold, before any reset)

---

## Flow 1: Conversations (FlowChat) — move + adapt WorkflowChat

Current `WorkflowChat.svelte` animation sequence:

1. User types into composer (character by character via `onUpdate`)
2. User bubble slides up, composer clears
3. Response lines stream in one by one
4. Response cursor blinks
5. Sidebar collapses (width 216 → 0, main margin-left 216 → 0)
6. Hold
7. Sidebar expands back

Changes needed:

- Remove `repeat: -1, repeatDelay: 1.5`
- Add `onComplete` prop
- Call `onComplete()` at end of timeline

---

## Flow 2: Providers — stub (implement later)

Animation plan:

1. Model chip clicked → palette slides up from composer
2. Provider logos appear (Claude, OpenAI, Gemini, Mistral, Ollama, WebLLM)
3. Provider selected → chip label updates
4. Badge fades in: "Keys stored locally · Web Crypto AES-256"

---

## Flow 3: Tokens — stub (implement later)

Animation plan:

1. Context window bar fills as messages appear
2. Context settings popover opens → Full / LRU / BM25 options shown
3. Strategy selected → token count updates

---

## Flow 4: Documents — stub (implement later)

Animation plan:

1. Folder panel opens in split view
2. `.md` file opens with rendered math/SVG
3. Function plot renders
4. Download button clicked

---

## Flow 5: Agent — stub (implement later)

Animation plan:

1. Agent toggle activates in composer footer
2. Tools palette opens — list of tools shown
3. Some tools deselected ("reducing token usage")
4. Agent runs with tool call indicators streaming in

---

## LandingPage.svelte changes

- Replace `import WorkflowChat` with `import FlowPlayer`
- Replace `<WorkflowChat />` with `<FlowPlayer />`
- `.preview` wrapper is unchanged

---

## Stub implementation (Flows 2–5)

Each stub:

- Renders the same demo frame shell (sidebar + main + composer)
- Shows the flow label centered in the chat area
- Calls `onComplete()` after 3 seconds via `setTimeout`

---

## Critical files

| File                                                     | Action                                                                     |
| -------------------------------------------------------- | -------------------------------------------------------------------------- |
| `src/view/components/landing/LandingPage.svelte`         | Swap WorkflowChat → FlowPlayer                                             |
| `src/view/components/landing/WorkflowChat.svelte`        | Move → `flows/FlowChat.svelte`, add `onComplete` prop, remove `repeat: -1` |
| `src/view/components/landing/FlowPlayer.svelte`          | CREATE                                                                     |
| `src/view/components/landing/flows/FlowChat.svelte`      | CREATE (from WorkflowChat)                                                 |
| `src/view/components/landing/flows/FlowProviders.svelte` | CREATE stub                                                                |
| `src/view/components/landing/flows/FlowTokens.svelte`    | CREATE stub                                                                |
| `src/view/components/landing/flows/FlowDocuments.svelte` | CREATE stub                                                                |
| `src/view/components/landing/flows/FlowAgent.svelte`     | CREATE stub                                                                |

---

## Verification

1. `bun run dev` — landing page loads, Flow 1 plays
2. Flow 1 completes → tab advances to Flow 2 stub (3s placeholder)
3. Continues through all 5 flows in a loop
4. Clicking any tab jumps to that flow
5. `bun run typecheck` — no errors
