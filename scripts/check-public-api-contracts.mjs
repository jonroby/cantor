import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src');
const CONTRACTS_DIR = path.join(SRC_DIR, 'tests', 'contracts');

const ROOT_AREAS = ['app', 'external', 'state', 'domain', 'lib', 'view'];
const SOURCE_EXTENSIONS = ['.ts', '.js', '.svelte.ts', '.svelte.js'];

const WRITE_MODE = process.argv.includes('--write');

function normalizePath(value) {
	return value.replaceAll('\\', '/');
}

function readFile(filePath) {
	return fs.readFileSync(filePath, 'utf8');
}

function ensureDir(dirPath) {
	fs.mkdirSync(dirPath, { recursive: true });
}

function stripComments(code) {
	return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function resolveModulePath(fromFile, spec) {
	const basePath = path.resolve(path.dirname(fromFile), spec);
	for (const extension of SOURCE_EXTENSIONS) {
		const candidate = `${basePath}${extension}`;
		if (fs.existsSync(candidate)) return candidate;
	}

	for (const extension of SOURCE_EXTENSIONS) {
		const candidate = path.join(basePath, `index${extension}`);
		if (fs.existsSync(candidate)) return candidate;
	}

	throw new Error(
		`Could not resolve "${spec}" from ${normalizePath(path.relative(ROOT, fromFile))}`
	);
}

function sortedObject(value) {
	if (value === true) return true;
	const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
	return Object.fromEntries(entries.map(([key, child]) => [key, sortedObject(child)]));
}

function mergeExports(target, source) {
	for (const [key, value] of Object.entries(source)) {
		target[key] = value;
	}
}

function parseExports(filePath, seen = new Set()) {
	const normalizedFile = path.resolve(filePath);
	if (seen.has(normalizedFile)) {
		return {};
	}
	seen.add(normalizedFile);

	const code = stripComments(readFile(normalizedFile));
	const exportsMap = {};

	for (const match of code.matchAll(
		/export\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s+['"](\.[^'"]+)['"]/g
	)) {
		const [, alias, spec] = match;
		exportsMap[alias] = parseExports(resolveModulePath(normalizedFile, spec), new Set(seen));
	}

	for (const match of code.matchAll(/export\s+\*\s+from\s+['"](\.[^'"]+)['"]/g)) {
		const [, spec] = match;
		mergeExports(exportsMap, parseExports(resolveModulePath(normalizedFile, spec), new Set(seen)));
	}

	for (const match of code.matchAll(/export\s*\{\s*([^}]+)\s*\}\s*from\s*['"](\.[^'"]+)['"]/g)) {
		const [, clause] = match;
		for (const part of clause.split(',')) {
			const trimmed = part.trim();
			if (!trimmed) continue;
			const aliasMatch = trimmed.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
			if (!aliasMatch) continue;
			const [, original, alias] = aliasMatch;
			exportsMap[alias ?? original] = true;
		}
	}

	for (const match of code.matchAll(
		/export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g
	)) {
		const [, name] = match;
		exportsMap[name] = true;
	}

	for (const match of code.matchAll(/export\s*\{\s*([^}]+)\s*\}(?!\s*from)/g)) {
		const [, clause] = match;
		for (const part of clause.split(',')) {
			const trimmed = part.trim();
			if (!trimmed) continue;
			const aliasMatch = trimmed.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
			if (!aliasMatch) continue;
			const [, original, alias] = aliasMatch;
			exportsMap[alias ?? original] = true;
		}
	}

	return sortedObject(exportsMap);
}

function diffMaps(actual, expected, currentPath = []) {
	const diffs = [];
	const actualKeys = new Set(Object.keys(actual));
	const expectedKeys = new Set(Object.keys(expected));

	for (const key of [...actualKeys].sort()) {
		if (!expectedKeys.has(key)) {
			diffs.push(`unexpected export "${[...currentPath, key].join('.')}"`);
		}
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

function relative(filePath) {
	return normalizePath(path.relative(ROOT, filePath));
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
	for (const diff of diffs) {
		failures.push(`${area}: ${diff}`);
	}
}

if (WRITE_MODE) {
	console.log('Public API contracts written to src/tests/contracts.');
	process.exit(0);
}

if (failures.length > 0) {
	console.error('Public API contract check failed:\n');
	for (const failure of failures) {
		console.error(`- ${failure}`);
	}
	process.exit(1);
}

console.log('Public API contract check passed.');
