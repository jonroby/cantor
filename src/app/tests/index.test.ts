import { describe, expect, it } from 'vitest';
import * as app from '@/app';

describe('@/app public API', () => {
	it('exposes its public namespaces', () => {
		expect(app.bootstrap).toBeDefined();
		expect(app.chat).toBeDefined();
		expect(app.search).toBeDefined();
		expect(app.content).toBeDefined();
		expect(app.documents).toBeDefined();
		expect(app.providers).toBeDefined();
		expect(app.files).toBeDefined();
		expect(app.types).toBeDefined();
	});
});
