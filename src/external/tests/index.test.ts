import { describe, it } from 'vitest';
import * as external from '@/external';
import externalContract from '@/tests/contracts/external.json';
import { expectPublicApiContract } from '@/tests/public-api/assert-contract';

describe('@/external public API', () => {
	// Freezes the external boundary surface so adapters do not gain or lose exports unnoticed.
	it('matches the frozen public API contract exactly', () => {
		expectPublicApiContract(external, externalContract, '@/external');
	});
});
