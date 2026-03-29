# Testing Svelte 5 Runes

Reference: https://svelte.dev/docs/svelte/testing

## Setup

Vitest must resolve browser entry points for runes to work:

```js
// vite.config.js
export default defineConfig({
	resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined
});
```

## Key rules

1. **Tests under `src/` must use the `*.test.ts` suffix.** Only actual Svelte components use `.svelte`; non-component test files should not include `.svelte` in the filename.

2. **`$state({...})` objects** — property mutations are synchronously visible in tests. This is why `chatState.chats = [...]` works in `chats.test.ts`.

3. **`let x = $state([]); x = [...]` (reassignment)** — the compiled setter notifies Svelte's reactivity system, but the new value is NOT immediately visible to a plain read in a test. You must call `flushSync()` to synchronize.

4. **Use `flushSync` from `'svelte'`** before assertions when testing code that mutates `$state` via reassignment or triggers `$effect`:

```ts
import { flushSync } from 'svelte';

startStream(...);
flushSync();
expect(isStreaming(exchangeId)).toBe(true);
```

5. **`$effect` in tests** — wrap in `$effect.root()` and call the returned cleanup:

```ts
test('effect', () => {
	const cleanup = $effect.root(() => {
		let count = $state(0);
		// ... test $effect-based code
		flushSync();
		// ... assertions
	});
	cleanup();
});
```

6. **Getter pattern** — when passing reactive state to functions, use `() => value` instead of `value` directly so the function always reads the current value.

## `vi.mock` + `.svelte.ts` module isolation

When `vi.mock` intercepts a dependency of a `.svelte.ts` module, vitest may create a separate module instance for the `.svelte.ts` file. This means the test imports functions that read/write a **different** instance of module-level state than the one the test's `vi.mock` factory sees.

**Symptom**: calling `startStream()` adds to `streamingIds` inside the source module, but `isStreaming()` called from the test returns `false` — two separate `Set` instances.

**Solution**: extract testable logic into a plain `.ts` file with dependency injection (same pattern as `io.ts` from `io.svelte.ts`). The `.svelte.ts` file becomes a thin wrapper binding reactive containers (`SvelteSet`, `SvelteMap`) and real dependencies. Tests import from the `.ts` file and pass plain `Set`/`Map` + mock deps.

## Why `$state({...})` vs `let $state()` behave differently in tests

- `const obj = $state({ x: 0 })` — Svelte wraps `obj` in a deep reactive proxy. Reading `obj.x` goes through the proxy's get trap and always returns the current value.
- `let x = $state(0); x = 1` — Svelte compiles this into a signal (getter/setter pair). External code reading the exported `x` goes through the compiled getter, which may not reflect the update until the next microtask or `flushSync()`.
