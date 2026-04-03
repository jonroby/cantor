# Remove `shadcn` Inventory And Migration Checklist

## Goal

Remove `shadcn` from this repo completely while keeping behavior intact, using `bits-ui` under a temporary adapter layer and migrating component families one by one.

Planned strategy:

1. Create a temporary adapter layer, for example `src/view/primitives/bits/`.
2. Mirror only the `shadcn` APIs that this repo actually uses.
3. Swap imports incrementally.
4. Leave `sidebar` for last.
5. Delete unused `shadcn` files, helpers, and dependencies only after all consumers are off them.

## Current repo state

Tailwind-style usage outside `shadcn` has already been removed.

What still remains by design:

- `src/view/primitives/shadcn/**`
- Tailwind global import in [src/view/css/index.css](/Users/jonroby/ai/cantor/src/view/css/index.css)
- Tailwind/shadcn helper dependencies in [package.json](/Users/jonroby/ai/cantor/package.json)

## Actual `shadcn` usage in this repo

This is the exact import surface currently used by app code and tests.

### App/runtime imports

- [src/view/components/app/App.svelte](/Users/jonroby/ai/cantor/src/view/components/app/App.svelte)
  - `sonner`
  - `sidebar`
- [src/view/primitives/confirm-delete-dialog/ConfirmDeleteDialog.svelte](/Users/jonroby/ai/cantor/src/view/primitives/confirm-delete-dialog/ConfirmDeleteDialog.svelte)
  - `alert-dialog`
- [src/view/components/sidebar/AppSidebar.svelte](/Users/jonroby/ai/cantor/src/view/components/sidebar/AppSidebar.svelte)
  - `sidebar`
  - `tooltip`
- [src/view/components/sidebar/ChatItem.svelte](/Users/jonroby/ai/cantor/src/view/components/sidebar/ChatItem.svelte)
  - `sidebar`
  - `dropdown-menu`
- [src/view/components/sidebar/DocumentItem.svelte](/Users/jonroby/ai/cantor/src/view/components/sidebar/DocumentItem.svelte)
  - `sidebar`
  - `dropdown-menu`
- [src/view/components/sidebar/FolderItem.svelte](/Users/jonroby/ai/cantor/src/view/components/sidebar/FolderItem.svelte)
  - `sidebar`
  - `dropdown-menu`

### Test-only imports/mocks

- [tests/fixtures/AppSidebarHarness.svelte](/Users/jonroby/ai/cantor/tests/fixtures/AppSidebarHarness.svelte)
  - `sidebar`
- [tests/fixtures/AppSidebarStateHarness.svelte](/Users/jonroby/ai/cantor/tests/fixtures/AppSidebarStateHarness.svelte)
  - `sidebar`
- [src/view/components/app/tests/App.test.ts](/Users/jonroby/ai/cantor/src/view/components/app/tests/App.test.ts)
  - `sonner` mock
  - `sidebar` mock

## `shadcn` families that are actually in use

These are the only generated `shadcn` families we need to replace for this repo.

### Required

- `alert-dialog`
- `dropdown-menu`
- `sidebar`
- `sonner`
- `tooltip`

### Not currently imported by app code, but present in generated tree

- `button`
- `input`
- `separator`
- `sheet`
- `skeleton`

Note:

- `button`, `input`, and `separator` are used internally by generated `shadcn` files.
- `sheet` and `skeleton` are used internally by the generated `sidebar`.
- They do not currently need direct app-level migration, but they matter if we replace `sidebar` incrementally.

## Full generated `shadcn` tree

This is the current generated surface under [src/view/primitives/shadcn/ui](/Users/jonroby/ai/cantor/src/view/primitives/shadcn/ui):

### `alert-dialog`

- `alert-dialog-action.svelte`
- `alert-dialog-cancel.svelte`
- `alert-dialog-content.svelte`
- `alert-dialog-description.svelte`
- `alert-dialog-footer.svelte`
- `alert-dialog-header.svelte`
- `alert-dialog-media.svelte`
- `alert-dialog-overlay.svelte`
- `alert-dialog-portal.svelte`
- `alert-dialog-title.svelte`
- `alert-dialog-trigger.svelte`
- `alert-dialog.svelte`
- `index.ts`

### `button`

- `button.svelte`
- `index.ts`

### `dropdown-menu`

- `dropdown-menu-checkbox-group.svelte`
- `dropdown-menu-checkbox-item.svelte`
- `dropdown-menu-content.svelte`
- `dropdown-menu-group-heading.svelte`
- `dropdown-menu-group.svelte`
- `dropdown-menu-item.svelte`
- `dropdown-menu-label.svelte`
- `dropdown-menu-portal.svelte`
- `dropdown-menu-radio-group.svelte`
- `dropdown-menu-radio-item.svelte`
- `dropdown-menu-separator.svelte`
- `dropdown-menu-shortcut.svelte`
- `dropdown-menu-sub-content.svelte`
- `dropdown-menu-sub-trigger.svelte`
- `dropdown-menu-sub.svelte`
- `dropdown-menu-trigger.svelte`
- `dropdown-menu.svelte`
- `index.ts`

### `input`

- `input.svelte`
- `index.ts`

### `separator`

- `separator.svelte`
- `index.ts`

### `sheet`

- `sheet-close.svelte`
- `sheet-content.svelte`
- `sheet-description.svelte`
- `sheet-footer.svelte`
- `sheet-header.svelte`
- `sheet-overlay.svelte`
- `sheet-portal.svelte`
- `sheet-title.svelte`
- `sheet-trigger.svelte`
- `sheet.svelte`
- `index.ts`

### `sidebar`

- `constants.ts`
- `context.svelte.ts`
- `index.ts`
- `is-mobile.ts`
- `sidebar-content.svelte`
- `sidebar-footer.svelte`
- `sidebar-group-action.svelte`
- `sidebar-group-content.svelte`
- `sidebar-group-label.svelte`
- `sidebar-group.svelte`
- `sidebar-header.svelte`
- `sidebar-input.svelte`
- `sidebar-inset.svelte`
- `sidebar-menu-action.svelte`
- `sidebar-menu-badge.svelte`
- `sidebar-menu-button.svelte`
- `sidebar-menu-item.svelte`
- `sidebar-menu-skeleton.svelte`
- `sidebar-menu-sub-button.svelte`
- `sidebar-menu-sub-item.svelte`
- `sidebar-menu-sub.svelte`
- `sidebar-menu.svelte`
- `sidebar-provider.svelte`
- `sidebar-rail.svelte`
- `sidebar-separator.svelte`
- `sidebar-trigger.svelte`
- `sidebar.svelte`

### `skeleton`

- `skeleton.svelte`
- `index.ts`

### `sonner`

- `sonner.svelte`
- `index.ts`

### `tooltip`

- `tooltip-content.svelte`
- `tooltip-portal.svelte`
- `tooltip-provider.svelte`
- `tooltip-trigger.svelte`
- `tooltip.svelte`
- `index.ts`

## `shadcn` helpers that must disappear at the end

### Files

- [src/view/primitives/shadcn/index.ts](/Users/jonroby/ai/cantor/src/view/primitives/shadcn/index.ts)
- [src/view/primitives/shadcn/utils.ts](/Users/jonroby/ai/cantor/src/view/primitives/shadcn/utils.ts)
- [components.json](/Users/jonroby/ai/cantor/components.json)

### Helper dependencies

Used by `src/view/primitives/shadcn/utils.ts`:

- `clsx`
- `tailwind-merge`

Generated-wrapper dependency:

- `tailwind-variants`

Likely removable after `shadcn` is gone:

- `clsx`
- `tailwind-merge`
- `tailwind-variants`
- `components.json`

Potentially removable only if Tailwind is no longer needed anywhere:

- `tailwindcss`
- `@tailwindcss/vite`
- `prettier-plugin-tailwindcss`

Important:

- If `bits-ui` replacement still uses global Tailwind import or utility classes anywhere, do not remove Tailwind packages yet.

## Recommended temporary adapter layout

Create a temporary folder:

- `src/view/primitives/bits/`

Suggested initial shape:

- `src/view/primitives/bits/alert-dialog/`
- `src/view/primitives/bits/dropdown-menu/`
- `src/view/primitives/bits/tooltip/`
- `src/view/primitives/bits/sonner/`
- `src/view/primitives/bits/sidebar/`
- `src/view/primitives/bits/index.ts`

Optional helpers if useful:

- `src/view/primitives/bits/shared/`
- `src/view/primitives/bits/types.ts`

Rule:

- Mirror the smallest API surface needed by current imports.
- Do not replicate the entire generated `shadcn` tree unless a real consumer needs it.

## Migration order

This order minimizes blast radius.

1. `tooltip`
2. `alert-dialog`
3. `dropdown-menu`
4. `sonner`
5. `sidebar`

Reasoning:

- `tooltip`, `alert-dialog`, `dropdown-menu`, and `sonner` have small consumer surfaces.
- `sidebar` is the largest and depends on internal `sheet`, `separator`, `input`, `button`, `tooltip`, and `skeleton` behavior.

## Complete replacement checklist

### Phase 0: Prepare adapter folder

- [ ] Create `src/view/primitives/bits/`
- [ ] Add a short README or comment describing it as a temporary migration layer
- [ ] Decide whether to preserve `shadcn`-like named exports or use a slimmer API

### Phase 1: Tooltip

Target imports:

- [src/view/components/sidebar/AppSidebar.svelte](/Users/jonroby/ai/cantor/src/view/components/sidebar/AppSidebar.svelte)

Checklist:

- [ ] Implement `bits` tooltip adapter
- [ ] Support current `Tooltip.Root`, `Tooltip.Trigger`, `Tooltip.Content`
- [ ] Preserve current `class` passthrough behavior
- [ ] Replace imports in `AppSidebar.svelte`
- [ ] Remove old tooltip test mocks if any become stale

### Phase 2: Alert dialog

Target imports:

- [src/view/primitives/confirm-delete-dialog/ConfirmDeleteDialog.svelte](/Users/jonroby/ai/cantor/src/view/primitives/confirm-delete-dialog/ConfirmDeleteDialog.svelte)

Checklist:

- [ ] Implement `bits` alert dialog adapter
- [ ] Support `Root`, `Portal`, `Overlay`, `Content`, `Header`, `Title`, `Description`, `Footer`, `Cancel`, `Action`
- [ ] Replace import in `ConfirmDeleteDialog.svelte`
- [ ] Verify delete dialogs in sidebar still work

### Phase 3: Dropdown menu

Target imports:

- [src/view/components/sidebar/ChatItem.svelte](/Users/jonroby/ai/cantor/src/view/components/sidebar/ChatItem.svelte)
- [src/view/components/sidebar/DocumentItem.svelte](/Users/jonroby/ai/cantor/src/view/components/sidebar/DocumentItem.svelte)
- [src/view/components/sidebar/FolderItem.svelte](/Users/jonroby/ai/cantor/src/view/components/sidebar/FolderItem.svelte)

Checklist:

- [ ] Implement `bits` dropdown-menu adapter
- [ ] Support `Root`, `Trigger`, `Portal`, `Content`, `Item`, `Separator`
- [ ] Replace imports in all three sidebar item components
- [ ] Verify click, keyboard, positioning, and destructive actions

### Phase 4: Sonner

Target imports:

- [src/view/components/app/App.svelte](/Users/jonroby/ai/cantor/src/view/components/app/App.svelte)
- [src/view/components/app/tests/App.test.ts](/Users/jonroby/ai/cantor/src/view/components/app/tests/App.test.ts)

Checklist:

- [ ] Decide whether to keep `svelte-sonner` directly without `shadcn` wrapper
- [ ] Add local `Toaster` export under `bits/` or local primitives
- [ ] Replace import in `App.svelte`
- [ ] Update test mocks

### Phase 5: Sidebar

Target imports:

- [src/view/components/app/App.svelte](/Users/jonroby/ai/cantor/src/view/components/app/App.svelte)
- [src/view/components/sidebar/AppSidebar.svelte](/Users/jonroby/ai/cantor/src/view/components/sidebar/AppSidebar.svelte)
- [src/view/components/sidebar/ChatItem.svelte](/Users/jonroby/ai/cantor/src/view/components/sidebar/ChatItem.svelte)
- [src/view/components/sidebar/DocumentItem.svelte](/Users/jonroby/ai/cantor/src/view/components/sidebar/DocumentItem.svelte)
- [src/view/components/sidebar/FolderItem.svelte](/Users/jonroby/ai/cantor/src/view/components/sidebar/FolderItem.svelte)
- [tests/fixtures/AppSidebarHarness.svelte](/Users/jonroby/ai/cantor/tests/fixtures/AppSidebarHarness.svelte)
- [tests/fixtures/AppSidebarStateHarness.svelte](/Users/jonroby/ai/cantor/tests/fixtures/AppSidebarStateHarness.svelte)
- [src/view/components/app/tests/App.test.ts](/Users/jonroby/ai/cantor/src/view/components/app/tests/App.test.ts)

Checklist:

- [ ] Decide whether to preserve current `Sidebar.*` names for easier swap
- [ ] Implement `Provider`, `Root`, `Inset`, `Header`, `Content`, `Group`, `GroupLabel`, `GroupContent`, `Menu`, `MenuItem`, `MenuButton`, `Separator`, `Rail`
- [ ] Support `useSidebar()` behavior currently relied on by `AppSidebar.svelte`
- [ ] Support `bind:open` / open-state changes used by `App.svelte`
- [ ] Preserve current collapse behavior enough for existing UI/tests
- [ ] Replace imports in app and sidebar components
- [ ] Replace imports in tests and fixtures
- [ ] Verify drag/drop, collapse, hover affordances, and menu interactions

### Phase 6: Delete `shadcn`

- [ ] Remove all imports from `@/view/primitives/shadcn`
- [ ] Remove [src/view/primitives/shadcn/index.ts](/Users/jonroby/ai/cantor/src/view/primitives/shadcn/index.ts)
- [ ] Remove [src/view/primitives/shadcn/utils.ts](/Users/jonroby/ai/cantor/src/view/primitives/shadcn/utils.ts)
- [ ] Remove unused `src/view/primitives/shadcn/ui/*` families
- [ ] Remove [components.json](/Users/jonroby/ai/cantor/components.json)
- [ ] Update tests and mocks

### Phase 7: Remove dead deps

- [ ] Remove `clsx` if unused
- [ ] Remove `tailwind-merge` if unused
- [ ] Remove `tailwind-variants` if unused
- [ ] Remove `prettier-plugin-tailwindcss` if no longer useful
- [ ] Remove Tailwind runtime/build deps only if no longer needed anywhere
- [ ] Update lockfile

## Verification checklist

### Import checks

- [ ] `rg "@/view/primitives/shadcn" src tests` returns nothing
- [ ] `rg "components.json|tailwind-variants|tailwind-merge|clsx" src tests package.json` only shows intentional remaining usage

### Behavior checks

- [ ] Sidebar opens and collapses
- [ ] Sidebar tooltips render correctly
- [ ] Chat/document/folder overflow menus work
- [ ] Delete confirmation dialogs work
- [ ] Toasts still render
- [ ] App test mocks still match the new import paths

### Static checks

- [ ] `bun run typecheck`
- [ ] `bun run lint`
- [ ] `bun run test`

## Recommended first implementation slice

Start here:

1. Build `src/view/primitives/bits/tooltip`
2. Build `src/view/primitives/bits/alert-dialog`
3. Replace imports in:
   - [src/view/components/sidebar/AppSidebar.svelte](/Users/jonroby/ai/cantor/src/view/components/sidebar/AppSidebar.svelte)
   - [src/view/primitives/confirm-delete-dialog/ConfirmDeleteDialog.svelte](/Users/jonroby/ai/cantor/src/view/primitives/confirm-delete-dialog/ConfirmDeleteDialog.svelte)

This gives a low-risk first pass before touching dropdown menus or sidebar state machinery.
