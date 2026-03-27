import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/svelte';

// jsdom doesn't implement scrollIntoView
if (typeof Element !== 'undefined') {
	Element.prototype.scrollIntoView = function () {};
}

afterEach(() => cleanup());
