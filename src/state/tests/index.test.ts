import { describe, expect, it } from 'vitest';
import * as state from '@/state';

describe('@/state public API', () => {
	it('exposes its public namespaces', () => {
		expect(state.chats).toBeDefined();
		expect(state.documents).toBeDefined();
		expect(state.providers).toBeDefined();
	});
});
