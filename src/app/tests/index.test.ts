import { describe, expect, it } from 'vitest';
import * as app from '@/app';

describe('@/app public API', () => {
	it('exposes its public namespaces', () => {
		expect(Object.keys(app).sort()).toEqual([
			'bootstrap',
			'chat',
			'documents',
			'providers'
		]);
	});
});
