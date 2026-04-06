# Landing Page — Feature Flows Plan

## Context for New Conversations

This plan is for the `landing` branch of the Cantor repo at `/Users/jonroby/ai/cantor`.

**What Cantor is:** Svelte 5 + Vite SPA. An LLM interface for power users. Browser-only state in IndexedDB.

**What this branch does:** Replaces the old hero video on the landing page with an animated HTML demo. The demo shows 5 feature flows, each as a looping animation, with a Railway-style tab bar that auto-advances between flows.

---

## Current State (as of 2026-04-06)

### Files

| File | Status |
|------|--------|
| `src/view/components/landing/LandingPage.svelte` | Done — full layout with nav, hero, feature list, viewport, tab bar |
| `src/view/components/landing/flows/FlowChat.svelte` | Done — Flow 1 animation (side chats demo) |
| `src/view/components/landing/WorkflowChat.svelte` | Obsolete — superseded by FlowChat |
| `package.json` | gsap 3.14.2 added |

### Layout (LandingPage.svelte)

- **Nav**: white, 56px, logo left + "Request a Key" / "Get Started" buttons right, 24px horizontal padding
- **Hero**: `LLMs for Power Users` — "Power Users" in emerald→teal gradient (`hsl(158 85% 40%)` → `hsl(175 90% 38%)`)
- **Content row**: flex row — left feature col (160px) + center viewport (max 1150px, 16:9) + right spacer (160px)
- **Feature col**: "POWER TOOLS" label + 5 items list (`Side Chats`, `Multi Streaming`, `Quick Ask`, `Delete Nodes`, `Fork Chats`). Active item uses same emerald→teal gradient. `padding-bottom: 80px` to visually center against viewport.
- **Viewport**: `aspect-ratio: 16/9`, rounded 12px, subtle shadow. Contains `{#key key}<FlowChat onComplete={advance} />{/key}`
- **Tab bar**: full-width centered below viewport, 28px padding top/bottom. White pill with shadow. 5 tabs: `Side Chats`, `Context`, `Agents`, `Documents`, `Providers` with lucide icons.
- **Active tab**: dark emerald bg (`hsl(158 80% 28%)`), fill sweeps left→right (`border-radius: 999px 0 0 999px`, straight right edge), text has subtle glow.
- **Progress**: `requestAnimationFrame` loop over `FLOW_DURATION = 18000ms`. `advance()` bumps `activeIndex` and `key`, remounting FlowChat.

### Colors (brand)

- Emerald gradient: `linear-gradient(90deg, hsl(158 85% 40%), hsl(175 90% 38%))`
- Active tab bg: `hsl(158 80% 28%)`
- Active tab fill: `hsl(162 72% 38%)`
- Alpha badge: border `hsl(158 75% 42%)`, bg `hsl(158 70% 90%)`, text `hsl(158 80% 25%)`

### FlowChat animation sequence

1. User types prompt 1 (`How does attention work in transformers?`) → send pulse (emerald ripple) → bubble appears
2. Response 1 streams in (6 lines)
3. Side badge appears (right-aligned, after exchange 1)
4. User types prompt 2 (`Can you give a concrete example?`) → send pulse → bubble appears
5. Response 2 streams in (3 lines)
6. Side badge pulsed → side panel opens (width 0 → 50%)
7. Three side chats play: `What is Q?`, `What is K?`, `What is V?` — each types, sends (pulse), gets response
8. `onComplete()` called → tab advances

### Ripple pulse

- Color: `rgba(16, 185, 129, ...)` — emerald green (Tailwind emerald-500)
- Width/height: 0 → 72px, opacity 1 → 0, over 0.85s

---

## Remaining Work

### Flows 2–5 (stubs → real animations)

Each stub currently: renders same shell, calls `onComplete()` after timeout.

Planned animations:
- **Flow 2 (Context)**: context window bar fills, settings popover opens, strategy selected
- **Flow 3 (Agents)**: agent toggle activates, tools palette opens, agent runs with tool call indicators
- **Flow 4 (Documents)**: folder panel opens, `.md` file renders with math, download clicked
- **Flow 5 (Providers)**: model chip clicked, provider palette slides up, provider selected, badge fades in

### Feature list
The left-side "Power Tools" list currently cycles by `activeIndex % features.length`. Eventually each item should correspond to what's actually being shown in the active flow.

### Timing
`FLOW_DURATION = 18000` is a placeholder. Tighten once real flow durations are known.

---

## Real App CSS Variables (exact values)

```css
--background: 0 0% 98%      /* #f9f9f9 */
--foreground: 0 0% 9%       /* #171717 */
--card: 0 0% 100%           /* white */
--muted: 0 0% 96%           /* #f5f5f5 */
--muted-foreground: 0 0% 45% /* #737373 */
--border: 0 0% 88%          /* #e0e0e0 */
--sidebar: 0 0% 97%         /* #f7f7f7 */
--primary: 0 0% 12%         /* #1f1f1f */
--text-sm: 12px
--text-base: 12.75px
--text-md: 13.75px
--text-lg: 15px
--header-height: 52px
```
