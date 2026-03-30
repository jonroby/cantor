import { describe, it } from 'vitest';
import * as domain from '@/domain';
import domainContract from '@/tests/contracts/domain.json';
import { expectPublicApiContract } from '@/tests/public-api/assert-contract';

describe('@/domain public API', () => {
	// Freezes the root domain namespace so lower-level concepts cannot drift silently.
	it('matches the frozen public API contract exactly', () => {
		expectPublicApiContract(domain, domainContract, '@/domain');
	});
});
