import { describe, expect, it } from 'vitest';
import * as external from '@/external';

describe('@/external public API', () => {
	it('exposes its public namespaces', () => {
		expect(external.persistence).toBeDefined();
		expect(external.files).toBeDefined();
		expect(external.providers).toBeDefined();
		expect(external.streams).toBeDefined();
	});
});
