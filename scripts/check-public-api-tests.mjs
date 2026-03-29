import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

import {
	SRC_DIR,
	ROOT_AREAS,
	readSourceFile,
	getImportLikeSpecs,
	relative,
	getNamespaceImports
} from './ts-ast-utils.mjs';

const TEST_SUFFIXES = ['index.test.ts'];
const MOCKS_DIR = path.join(SRC_DIR, 'tests', 'mocks');
const failures = [];

function capitalize(value) {
	return value[0].toUpperCase() + value.slice(1);
}

for (const area of ROOT_AREAS) {
	const testDir = path.join(SRC_DIR, area, 'tests');
	const existingTest = TEST_SUFFIXES.map((name) => path.join(testDir, name)).find((candidate) =>
		fs.existsSync(candidate)
	);

	if (!existingTest) {
		failures.push(`${relative(testDir)}: missing public API test for @/${area}`);
	} else {
		const sourceFile = readSourceFile(existingTest);
		const specs = new Set(getImportLikeSpecs(sourceFile));
		if (!specs.has(`@/${area}`)) {
			failures.push(`${relative(existingTest)}: public API test must import "@/${area}"`);
		}
	}

	const mockFile = path.join(MOCKS_DIR, `${area}.ts`);
	if (!fs.existsSync(mockFile)) {
		failures.push(`${relative(mockFile)}: missing mock module for @/${area}`);
		continue;
	}

	const mockSource = readSourceFile(mockFile);
	const expectedFactory = `create${capitalize(area)}Mock`;
	const namespaceImports = getNamespaceImports(mockSource);
	if (!namespaceImports.some((entry) => entry.spec === `@/${area}`)) {
		failures.push(`${relative(mockFile)}: mock module must import namespace from "@/${area}"`);
	}

	let exportsFactory = false;
	for (const statement of mockSource.statements) {
		if ('name' in statement && statement.name?.text === expectedFactory) {
			const modifiers = statement.modifiers ?? [];
			exportsFactory = modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
		}
	}
	if (!exportsFactory) {
		failures.push(`${relative(mockFile)}: expected exported factory "${expectedFactory}"`);
	}
}

if (failures.length > 0) {
	console.error('Public API test check failed:\n');
	for (const failure of failures) console.error(`- ${failure}`);
	process.exit(1);
}

console.log('Public API test check passed.');
