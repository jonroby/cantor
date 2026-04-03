import { describe, it } from 'vitest';
import * as lib from '@/lib';
import libContract from '@tests/contracts/lib.json';
import { expectPublicApiContract } from '@tests/public-api/assert-contract';

describe('@/lib public API', () => {
	// Freezes the shared utility surface so lib does not quietly become a dumping ground again.
	it('matches the frozen public API contract exactly', () => {
		expectPublicApiContract(lib, libContract, '@/lib');
	});
});
