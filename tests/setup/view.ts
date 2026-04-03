import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/svelte';

// jsdom doesn't implement scrollIntoView
if (typeof Element !== 'undefined') {
	Element.prototype.scrollIntoView = function () {};
}

function createStorage(): Storage {
	const store = new Map<string, string>();

	return {
		get length() {
			return store.size;
		},
		clear() {
			store.clear();
		},
		getItem(key: string) {
			return store.get(key) ?? null;
		},
		key(index: number) {
			return Array.from(store.keys())[index] ?? null;
		},
		removeItem(key: string) {
			store.delete(key);
		},
		setItem(key: string, value: string) {
			store.set(key, String(value));
		}
	};
}

const localStorageMock = createStorage();
const sessionStorageMock = createStorage();

Object.defineProperty(globalThis, 'localStorage', {
	value: localStorageMock,
	configurable: true
});

Object.defineProperty(globalThis, 'sessionStorage', {
	value: sessionStorageMock,
	configurable: true
});

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
	Object.defineProperty(window, 'matchMedia', {
		value: vi.fn().mockImplementation((query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			addListener: vi.fn(),
			removeListener: vi.fn(),
			dispatchEvent: vi.fn()
		})),
		configurable: true
	});
}

if (typeof globalThis.ResizeObserver === 'undefined') {
	class ResizeObserverMock {
		observe() {}
		unobserve() {}
		disconnect() {}
	}

	Object.defineProperty(globalThis, 'ResizeObserver', {
		value: ResizeObserverMock,
		configurable: true
	});
}

beforeEach(() => {
	localStorageMock.clear();
	sessionStorageMock.clear();
});

afterEach(() => cleanup());
