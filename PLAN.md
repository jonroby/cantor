# Landing Page — Feature Flows Plan

## Context for New Conversations

This plan is for the `landing` branch of the Cantor repo at `/Users/jonroby/ai/cantor`.

**What Cantor is:** Svelte 5 + Vite SPA. An LLM interface for power users. Browser-only state in IndexedDB.

**What this branch does:** Replaces the old hero video on the landing page with an animated HTML demo. The demo shows feature flows across 5 sections, each as a looping animation, with a tab bar that auto-advances between sections.

---

## Naming Conventions

- **Section** — one tab (Power Tools, Model Selection, Agent Mode, Context Control, Experimental). Flashing/remounting between sections is acceptable.
- **Subsection** — one flow within a section (e.g. Side Chats, Simultaneous Streams within Power Tools). Within a section, the video must NOT flash or remount between subsections — it pauses while the title text animates, then resumes.

---

## Current State (as of 2026-04-06)

### Files

| File                                                | Status                                                                       |
| --------------------------------------------------- | ---------------------------------------------------------------------------- |
| `src/view/components/landing/LandingPage.svelte`    | Active — full layout with nav, hero, feature list, viewport, tab bar         |
| `src/view/components/landing/flows/FlowChat.svelte` | Done — Flow 1 animation (side chats demo)                                    |
| `src/view/components/landing/CantorLogo.svelte`     | Saved for later — animated SVG logo with green dots and criss-crossing lines |
| `src/view/components/landing/WorkflowChat.svelte`   | Obsolete — superseded by FlowChat                                            |
| `package.json`                                      | gsap 3.14.2 added                                                            |

### Layout (LandingPage.svelte)

- **Nav**: white, logo left + "Request a Key" / "Get Started" buttons right
- **Hero**: Single `<h1 class="tagline">` that types text with inline green accent words. Format: black text + `<span class="tagline-accent">green words</span>` + black text. Cursor blinks while typing.
- **Content row**: flex row — left feature col (160px) + center viewport (max 1150px, 16:9) + right spacer (160px)
- **Feature col**: section label + subsection list. Active subsection uses emerald→teal gradient.
- **Viewport**: `aspect-ratio: 16/9`, rounded 12px, subtle shadow. Shows `FlowChat` (or placeholder before first video).
- **Tab bar**: full-width centered below viewport. White pill with shadow. 5 tabs with lucide icons. Active tab: dark emerald bg, fill sweeps left→right with straight leading edge, text glows.
- **Progress**: `requestAnimationFrame` loop over `FLOW_DURATION = 18000ms`.

### Section / Tab order

1. Power Tools — Side Chats, Simultaneous Streams, Auto Ask, Delete Exchanges, Fork Chats
2. Model Selection — Frontier Labs, Secure & Local, Ollama
3. Agent Mode — Full Agent Control, Document Authoring, Charts & SVGs
4. Context Control — Token Monitor, Context Window, Tool Selection, Context Strategy
5. Experimental — Chat Tree

### Flow data format

Each subsection has `{ before, green, after, feature }`:

- `before` + `green` + `after` = full hero sentence
- `green` words render in emerald gradient
- `feature` = label shown in left feature col

### Hero animation (per subsection)

1. Type full sentence char by char — black, then green span, then black again
2. Hold 0.8s fully visible
3. Start video / resume video
4. Cursor hides

### Video behavior (KEY)

- Between **subsections**: video must NOT remount or flash. The GSAP timeline inside FlowChat should pause while title animates, then resume. Use a `paused` prop or exported pause/resume functions.
- Between **sections**: remounting is acceptable.

### Colors (brand)

- Emerald gradient: `linear-gradient(90deg, hsl(158 85% 40%), hsl(175 90% 38%))`
- Active tab bg: `hsl(158 80% 28%)`
- Active tab fill: `hsl(162 72% 38%)`
- Alpha badge: border `hsl(158 75% 42%)`, bg `hsl(158 70% 90%)`, text `hsl(158 80% 25%)`

### FlowChat animation sequence (current)

1. User types prompt 1 → send pulse (emerald ripple) → bubble appears
2. Response 1 streams in (6 lines)
3. Side badge appears
4. User types prompt 2 → send pulse → bubble appears
5. Response 2 streams in (3 lines)
6. Side badge pulsed → side panel opens
7. Three side chats play: What is Q?, What is K?, What is V?
8. `onComplete()` called → section advances

### User bubble style

- Background: `hsl(0 0% 94%)` (light grey)
- Text: `hsl(0 0% 9%)` (near black)

---

## Remaining Work

### 1. Subsection pause/resume (next up)

FlowChat needs to expose pause/resume so LandingPage can freeze the animation while the hero title types, then unfreeze. Options:

- Export `pause()` / `resume()` functions via `bind:this` on the component
- Pass a `paused` reactive prop that FlowChat watches

### 2. Flows 2–5 (stubs → real animations)

Each subsection within Power Tools needs its own animation segment. Currently FlowChat plays one continuous animation. It needs to be restructured so each subsection maps to a chapter in the timeline that can be seeked/resumed.

### 3. Sections 2–5

Model Selection, Agent Mode, Context Control, Experimental — all need FlowChat equivalents.

---

## Real App CSS Variables (exact values)

```css
--background: 0 0% 98% /* #f9f9f9 */ --foreground: 0 0% 9% /* #171717 */ --card: 0 0% 100%
	/* white */ --muted: 0 0% 96% /* #f5f5f5 */ --muted-foreground: 0 0% 45% /* #737373 */ --border: 0
	0% 88% /* #e0e0e0 */ --sidebar: 0 0% 97% /* #f7f7f7 */ --primary: 0 0% 12% /* #1f1f1f */
	--text-sm: 12px --text-base: 12.75px --text-md: 13.75px --text-lg: 15px --header-height: 52px;
```
