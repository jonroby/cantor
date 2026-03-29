import { describe, expect, it } from 'vitest';
import * as view from '@/view';

describe('@/view public API', () => {
	it('exposes its public namespaces', () => {
		expect(view.classic).toBeDefined();
		expect(view.shared).toBeDefined();
	});
});
