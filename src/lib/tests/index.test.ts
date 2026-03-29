import { describe, expect, it } from 'vitest';
import * as lib from '@/lib';

describe('@/lib public API', () => {
	it('exposes its public namespaces', () => {
		expect(lib.diff).toBeDefined();
		expect(lib.rename).toBeDefined();
		expect(lib.providerDefaults).toBeDefined();
		expect(lib.providerTypes).toBeDefined();
		expect(lib.documentMap).toBeDefined();
		expect(lib.validateMd).toBeDefined();
	});
});
