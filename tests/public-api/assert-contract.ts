import { expect } from 'vitest';

interface ContractMap {
	[key: string]: boolean | ContractMap;
}

// Recursively freezes a module namespace against its JSON contract:
// every expected export must exist, and no extra exports may appear.
export function expectPublicApiContract(
	actual: Record<string, unknown>,
	contract: ContractMap,
	path = 'module'
) {
	expect(Object.keys(actual).sort(), `${path} keys`).toEqual(Object.keys(contract).sort());

	for (const [key, expected] of Object.entries(contract)) {
		expect(key in actual, `${path}.${key} should exist`).toBe(true);

		if (typeof expected === 'boolean') {
			continue;
		}

		const value = actual[key];
		expect(value).toBeTypeOf('object');
		expect(value).not.toBeNull();
		expectPublicApiContract(value as Record<string, unknown>, expected, `${path}.${key}`);
	}
}
