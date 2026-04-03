import { describe, it } from 'vitest';
import * as view from '@/view';
import viewContract from '@tests/contracts/view.json';
import { expectPublicApiContract } from '@tests/public-api/assert-contract';

describe('@/view public API', () => {
	// Freezes the view barrel so only intentionally exported components remain importable.
	it('matches the frozen public API contract exactly', () => {
		expectPublicApiContract(view, viewContract, '@/view');
	});
});
