import { describe, expect, it } from 'vitest';
import * as lib from '@/lib';

describe('@/lib public API', () => {
	it('exposes its public namespaces', () => {
		expect(Object.keys(lib).sort()).toEqual([
			'providerDefaults',
			'providerTypes',
			'rename',
			'validateMd'
		]);
	});
});
