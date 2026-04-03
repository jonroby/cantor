import { describe, it } from 'vitest';
import * as state from '@/state';
import stateContract from '@tests/contracts/state.json';
import { expectPublicApiContract } from '@tests/public-api/assert-contract';

describe('@/state public API', () => {
	// Freezes the shared runtime state namespace so consumers only rely on approved exports.
	it('matches the frozen public API contract exactly', () => {
		expectPublicApiContract(state, stateContract, '@/state');
	});
});
