import fs from 'node:fs';
import path from 'node:path';

import {
	SRC_DIR,
	ROOT_AREAS,
	ensureDir,
	parseExports,
	readFile,
	relative
} from './ts-ast-utils.mjs';

const CONTRACTS_DIR = path.join(process.cwd(), 'tests', 'contracts');
const WRITE_MODE = process.argv.includes('--write');

function diffMaps(actual, expected, currentPath = []) {
	const diffs = [];
	const actualKeys = new Set(Object.keys(actual));
	const expectedKeys = new Set(Object.keys(expected));

	for (const key of [...actualKeys].sort()) {
		if (!expectedKeys.has(key))
			diffs.push(`unexpected export "${[...currentPath, key].join('.')}"`);
	}

	for (const key of [...expectedKeys].sort()) {
		if (!actualKeys.has(key)) {
			diffs.push(`missing export "${[...currentPath, key].join('.')}"`);
			continue;
		}

		const actualValue = actual[key];
		const expectedValue = expected[key];
		const actualLeaf = actualValue === true;
		const expectedLeaf = expectedValue === true;

		if (actualLeaf !== expectedLeaf) {
			diffs.push(
				`shape mismatch at "${[...currentPath, key].join('.')}": expected ${expectedLeaf ? 'leaf' : 'namespace'}, got ${actualLeaf ? 'leaf' : 'namespace'}`
			);
			continue;
		}

		if (!actualLeaf && !expectedLeaf) {
			diffs.push(...diffMaps(actualValue, expectedValue, [...currentPath, key]));
		}
	}

	return diffs;
}

function contractPath(area) {
	return path.join(CONTRACTS_DIR, `${area}.json`);
}

const failures = [];

ensureDir(CONTRACTS_DIR);

for (const area of ROOT_AREAS) {
	const sourceFile = path.join(SRC_DIR, area, 'index.ts');
	const exportMap = parseExports(sourceFile);
	const snapshotPath = contractPath(area);

	if (WRITE_MODE) {
		fs.writeFileSync(snapshotPath, `${JSON.stringify(exportMap, null, 2)}\n`);
		continue;
	}

	if (!fs.existsSync(snapshotPath)) {
		failures.push(`${relative(snapshotPath)}: missing public API contract snapshot`);
		continue;
	}

	const contract = JSON.parse(readFile(snapshotPath));
	const diffs = diffMaps(exportMap, contract);
	for (const diff of diffs) failures.push(`${area}: ${diff}`);
}

if (WRITE_MODE) {
	console.log('Public API contracts written to tests/contracts.');
	process.exit(0);
}

if (failures.length > 0) {
	console.error('Public API contract check failed:\n');
	for (const failure of failures) console.error(`- ${failure}`);
	process.exit(1);
}

console.log('Public API contract check passed.');
