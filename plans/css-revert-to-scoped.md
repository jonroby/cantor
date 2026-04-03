# CSS Revert: Tailwind → Scoped CSS in components/

## Decision

Keep the file structure from the `css` branch (files moved to `src/view/components/`), but revert CSS approach back to scoped `<style>` blocks. Tailwind stays only in `src/view/primitives/shadcn/` and other primitives.

## What NOT to touch

- `src/view/components/shadcn/` — keep Tailwind
- `src/view/components/panel/` — keep as-is
- `class=` props passed to imported Svelte components (those are component APIs, not native HTML attributes)

## What to change

For every `*.svelte` file under `src/view/components/` (excluding shadcn/ and panel/):

- Remove ALL Tailwind utility classes from native HTML element `class=` attributes
- Replace with semantic class names
- Add/update `<style>` block with equivalent scoped CSS

Tailwind classes to look for: `flex`, `grid`, `items-*`, `justify-*`, `gap-*`, `p-*`, `m-*`, `w-*`, `h-*`, `text-*`, `bg-*`, `border-*`, `rounded*`, `overflow-*`, `min-*`, `max-*`, `font-*`, `leading-*`, `tracking-*`, `ring-*`, `opacity-*`, `z-*`, `top-*`, `left-*`, `right-*`, `bottom-*`, `cursor-*`, `pointer-events-*`

## File mapping (current → original on main branch)

Use `git show main:<original-path>` to read the original scoped CSS for reference.

| Current file                                                         | Original on main                                      |
| -------------------------------------------------------------------- | ----------------------------------------------------- |
| `src/view/components/agent-activity/AgentActivity.svelte`            | `src/view/AgentActivity.svelte`                       |
| `src/view/components/app/App.svelte`                                 | `src/view/App.svelte`                                 |
| `src/view/components/app/ComposerAnchor.svelte`                      | NEW — no original                                     |
| `src/view/components/chat-message/ChatMessage.svelte`                | `src/view/ChatMessage.svelte`                         |
| `src/view/components/chat-view/ChatView.svelte`                      | `src/view/ChatView.svelte`                            |
| `src/view/components/chat-view/DeleteExchangeDialog.svelte`          | NEW — no original                                     |
| `src/view/components/chat-view/ExchangeList.svelte`                  | NEW — no original                                     |
| `src/view/components/chat-view/SidePanelContext.svelte`              | NEW — no original                                     |
| `src/view/components/chat-view/SidePanelHeader.svelte`               | NEW — no original                                     |
| `src/view/components/code-editor/CodeEditor.svelte`                  | `src/view/features/code-editor/CodeEditor.svelte`     |
| `src/view/components/composer-input/ComposerInput.svelte`            | `src/view/shared/ComposerInput.svelte`                |
| `src/view/components/composer/Composer.svelte`                       | `src/view/shared/Composer.svelte`                     |
| `src/view/components/document-view/DocumentView.svelte`              | `src/view/DocumentView.svelte`                        |
| `src/view/components/document/Document.svelte`                       | `src/view/features/document/Document.svelte`          |
| `src/view/components/drawing-board/DrawingBoard.svelte`              | `src/view/features/drawing-board/DrawingBoard.svelte` |
| `src/view/components/folder-document-view/FolderDocumentView.svelte` | `src/view/FolderDocumentView.svelte`                  |
| `src/view/components/landing/LandingPage.svelte`                     | `src/view/routes/LandingPage.svelte`                  |
| `src/view/components/model-palette/ModelPalette.svelte`              | `src/view/features/model-palette/ModelPalette.svelte` |
| `src/view/components/model-palette/CredentialFlow.svelte`            | NEW — no original                                     |
| `src/view/components/model-palette/FrontierTab.svelte`               | NEW — no original                                     |
| `src/view/components/model-palette/OllamaTab.svelte`                 | NEW — no original                                     |
| `src/view/components/model-palette/WebLLMTab.svelte`                 | NEW — no original                                     |
| `src/view/components/python-editor/PythonEditor.svelte`              | `src/view/features/python-editor/PythonEditor.svelte` |
| `src/view/components/search/SearchDialog.svelte`                     | `src/view/shared/SearchDialog.svelte`                 |
| `src/view/components/sidebar/AppSidebar.svelte`                      | `src/view/shared/AppSidebar.svelte`                   |
| `src/view/components/sidebar/ChatItem.svelte`                        | `src/view/shared/ChatItem.svelte`                     |
| `src/view/components/sidebar/DocumentItem.svelte`                    | `src/view/shared/DocumentItem.svelte`                 |
| `src/view/components/sidebar/FolderItem.svelte`                      | `src/view/shared/FolderItem.svelte`                   |

## Files confirmed still needing work (as of last check)

All of the above still have Tailwind on native HTML elements. The agent run only partially completed (7 files touched, none fully clean).

## Verification

After completing, run:

```
bun run typecheck
bun run lint
```

Also grep to confirm no Tailwind remains on native elements:

```
grep -rn "class=\"[^\"]*\(flex\|grid\|items-\|justify-\|gap-\|p-\|m-[0-9]\|w-\|h-\|text-\|bg-\|border-\|rounded\)" src/view/components/ --include="*.svelte"
```

(Review results — some matches may be inside component `class=` props which are acceptable.)
