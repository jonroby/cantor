import fs from 'node:fs';
import path from 'node:path';
import { builtinModules } from 'node:module';

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src');
const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const declaredPackages = new Set([
	...Object.keys(packageJson.dependencies ?? {}),
	...Object.keys(packageJson.devDependencies ?? {}),
	...builtinModules,
	...builtinModules.map((name) => `node:${name}`),
	'mdast'
]);

const SOURCE_EXTENSIONS = new Set(['.ts', '.js', '.svelte']);
const TEST_FILE_RE = /\.(test|spec)\.(ts|js)$/;

const AREA_RULES = {
	domain: ['@/domain/'],
	lib: ['@/lib/'],
	state: ['@/state', '@/domain/', '@/lib/'],
	external: ['@/external/', '@/domain/', '@/lib/', '@/state'],
	app: ['@/app/', '@/state', '@/external/', '@/domain/', '@/lib/'],
	view: ['@/view/', '@/app/', '@/lib/', '@/state', '@/external/', '@/domain/']
};

function walk(dir) {
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		if (entry.name === 'canvas') continue;
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...walk(full));
			continue;
		}
		if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
			files.push(full);
		}
	}
	return files;
}

function areaFor(relPath) {
	const normalized = relPath.replaceAll('\\', '/');
	for (const area of ['domain', 'lib', 'state', 'external', 'app', 'view']) {
		if (normalized.startsWith(`src/${area}/`)) return area;
	}
	return null;
}

function importSpecs(code) {
	const specs = [];
	const patterns = [
		/\bimport\s+(?:type\s+)?[^'"]*?from\s*['"]([^'"]+)['"]/g,
		/\bexport\s+[^'"]*?from\s*['"]([^'"]+)['"]/g,
		/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
		/\bvi\.mock\(\s*['"]([^'"]+)['"]/g
	];
	for (const pattern of patterns) {
		for (const match of code.matchAll(pattern)) {
			specs.push(match[1]);
		}
	}
	return specs;
}

function isDeclaredPackage(spec) {
	if (declaredPackages.has(spec)) return true;
	const [scopeOrName, maybeName] = spec.split('/');
	const packageName = spec.startsWith('@') ? `${scopeOrName}/${maybeName}` : scopeOrName;
	return declaredPackages.has(packageName);
}

function isAllowedInternal(area, spec) {
	return AREA_RULES[area]?.some((prefix) => spec === prefix || spec.startsWith(prefix)) ?? false;
}

const violations = [];

for (const file of walk(SRC_DIR)) {
	const relPath = path.relative(ROOT, file).replaceAll('\\', '/');
	if (TEST_FILE_RE.test(relPath)) continue;
	const area = areaFor(relPath);
	if (!area) continue;
	const code = fs.readFileSync(file, 'utf8');
	for (const spec of importSpecs(code)) {
		if (spec.startsWith('.')) continue;

		if (spec === '@/state' || spec.startsWith('@/state/')) {
			if (!relPath.startsWith('src/state/') && spec !== '@/state') {
				violations.push(`${relPath}: use "@/state" instead of deep state import "${spec}"`);
				continue;
			}
		}

		if (spec.startsWith('@/')) {
			if (spec.startsWith('@/assets/')) continue;
			if (!isAllowedInternal(area, spec)) {
				violations.push(`${relPath}: ${area} is not allowed to import "${spec}"`);
			}
			continue;
		}

		if (!isDeclaredPackage(spec)) {
			violations.push(`${relPath}: package "${spec}" is not declared in package.json`);
		}
	}
}

if (violations.length > 0) {
	console.error('Import boundary check failed:\n');
	for (const violation of violations) {
		console.error(`- ${violation}`);
	}
	process.exit(1);
}

console.log('Import boundary check passed.');
