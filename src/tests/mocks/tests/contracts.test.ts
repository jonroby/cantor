import { describe, expect, it } from 'vitest';

import appContract from '@/tests/contracts/app.json';
import domainContract from '@/tests/contracts/domain.json';
import externalContract from '@/tests/contracts/external.json';
import libContract from '@/tests/contracts/lib.json';
import stateContract from '@/tests/contracts/state.json';
import viewContract from '@/tests/contracts/view.json';
import {
	createAppMock,
	createDomainMock,
	createExternalMock,
	createLibMock,
	createStateMock,
	createViewMock
} from '@/tests/mocks';

function expectShape(actual: unknown, contract: unknown, currentPath: string[] = []) {
	expect(actual).toBeDefined();

	if (contract === true) {
		return;
	}

	expect(typeof actual).toBe('object');
	expect(actual).not.toBeNull();

	const actualObject = actual as Record<string, unknown>;
	const contractObject = contract as Record<string, unknown>;
	expect(Object.keys(actualObject).sort()).toEqual(Object.keys(contractObject).sort());

	for (const [key, child] of Object.entries(contractObject)) {
		expectShape(actualObject[key], child, [...currentPath, key]);
	}
}

describe('public API mocks', () => {
	it('match the app contract', () => {
		expectShape(createAppMock(), appContract);
	});

	it('match the domain contract', () => {
		expectShape(createDomainMock(), domainContract);
	});

	it('match the external contract', () => {
		expectShape(createExternalMock(), externalContract);
	});

	it('match the lib contract', () => {
		expectShape(createLibMock(), libContract);
	});

	it('match the state contract', () => {
		expectShape(createStateMock(), stateContract);
	});

	it('match the view contract', () => {
		expectShape(createViewMock(), viewContract);
	});
});
