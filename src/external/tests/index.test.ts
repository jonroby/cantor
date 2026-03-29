import { describe, expect, it } from 'vitest';
import * as external from '@/external';

describe('@/external public API', () => {
	it('exposes its public namespaces', () => {
		expect(Object.keys(external).sort()).toEqual(['files', 'persistence', 'providers', 'streams']);
	});
});
