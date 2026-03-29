import { describe, expect, it } from 'vitest';
import * as domain from '@/domain';

describe('@/domain public API', () => {
	it('exposes its public namespaces', () => {
		expect(domain.tree).toBeDefined();
		expect(domain.search).toBeDefined();
		expect(domain.models).toBeDefined();
	});
});
