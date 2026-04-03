import { describe, it } from 'vitest';
import * as app from '@/app';
import appContract from '@tests/contracts/app.json';
import { expectPublicApiContract } from '@tests/public-api/assert-contract';

describe('@/app public API', () => {
	// Freezes the root app namespace so added, removed, or renamed exports fail loudly.
	it('matches the frozen public API contract exactly', () => {
		expectPublicApiContract(app, appContract, '@/app');
	});
});
