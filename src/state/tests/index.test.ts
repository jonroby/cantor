import { describe, expect, it } from 'vitest';
import * as state from '@/state';

describe('@/state public API', () => {
	it('exposes its public namespaces', () => {
		expect(Object.keys(state).sort()).toEqual(['chats', 'documents', 'providers']);
	});
});
