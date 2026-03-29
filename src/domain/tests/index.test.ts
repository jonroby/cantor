import { describe, expect, it } from 'vitest';
import * as domain from '@/domain';

describe('@/domain public API', () => {
	it('exposes its public namespaces', () => {
		expect(Object.keys(domain).sort()).toEqual(['constraints', 'models', 'tree']);
	});
});
