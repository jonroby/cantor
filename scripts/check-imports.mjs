import fs from 'node:fs';
import path from 'node:path';
import { builtinModules } from 'node:module';
import ts from 'typescript';

import {
	ROOT,
	SRC_DIR,
	walk,
	relative,
	readSourceFile,
	getImportLikeSpecs,
	getNamespaceImports,
	getNamespaceMemberUses,
	visit,
	getStringLiteralValue
} from './ts-ast-utils.mjs';

const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const declaredPackages = new Set([
	...Object.keys(packageJson.dependencies ?? {}),
	...Object.keys(packageJson.devDependencies ?? {}),
	...builtinModules,
	...builtinModules.map((name) => `node:${name}`),
	'mdast'
]);

const AREA_ORDER = ['domain', 'lib', 'state', 'external', 'app', 'view'];

const APPROVED_PUBLIC_NAMESPACES = {
	app: new Set(['bootstrap', 'chat', 'documents', 'providers']),
	external: new Set(['persistence', 'files', 'providers', 'streams']),
	state: new Set(['chats', 'documents', 'providers'])
};

const AREA_RULES = {
	domain: { allowedCrossAreaImports: new Set(), allowedPackages: null },
	lib: { allowedCrossAreaImports: new Set(), allowedPackages: null },
	state: { allowedCrossAreaImports: new Set(['domain', 'lib']), allowedPackages: null },
	external: { allowedCrossAreaImports: new Set(['domain', 'lib']), allowedPackages: null },
	app: {
		allowedCrossAreaImports: new Set(['domain', 'lib', 'state', 'external']),
		allowedPackages: null
	},
	view: { allowedCrossAreaImports: new Set(['app']), allowedPackages: null }
};

function areaFor(relPath) {
	const normalized = relPath.replaceAll('\\', '/');
	for (const area of AREA_ORDER) {
		if (normalized.startsWith(`src/${area}/`)) return area;
	}
	return null;
}

function isDeclaredPackage(spec) {
	if (declaredPackages.has(spec)) return true;
	const [scopeOrName, maybeName] = spec.split('/');
	const packageName = spec.startsWith('@') ? `${scopeOrName}/${maybeName}` : scopeOrName;
	return declaredPackages.has(packageName);
}

function parseInternalSpec(spec) {
	const match = spec.match(/^@\/(domain|lib|state|external|app|view)(?:\/(.*))?$/);
	if (!match) return null;
	return { area: match[1], isRoot: match[2] == null };
}

function hasNamespaceImport(sourceFile, spec) {
	return getNamespaceImports(sourceFile).some((entry) => entry.spec === spec);
}

function collectRuleViolations(sourceFile, area, relPath) {
	const violations = [];

	visit(sourceFile, (node) => {
		if (
			area === 'app' &&
			ts.isImportDeclaration(node) &&
			getStringLiteralValue(node.moduleSpecifier) === 'svelte-sonner'
		) {
			violations.push(
				`${relPath}: app may not import svelte-sonner; UI notifications belong in view`
			);
		}

		if (area === 'app' && ts.isIdentifier(node) && node.text === 'localStorage') {
			violations.push(
				`${relPath}: app may not touch localStorage directly; route persistence through external`
			);
		}
	});

	return violations;
}

const violations = [];

for (const file of walk(SRC_DIR)) {
	const relPath = relative(file);
	if (relPath.endsWith('.test.ts')) continue;
	const area = areaFor(relPath);
	if (!area) continue;

	const sourceFile = readSourceFile(file);
	violations.push(...collectRuleViolations(sourceFile, area, relPath));

	for (const spec of getImportLikeSpecs(sourceFile)) {
		if (spec.startsWith('.')) continue;

		if (spec.startsWith('@/')) {
			if (spec.startsWith('@/assets/')) continue;
			const target = parseInternalSpec(spec);
			if (!target) {
				violations.push(`${relPath}: unknown internal import "${spec}"`);
				continue;
			}
			if (target.area === area) continue;

			if (!target.isRoot) {
				violations.push(
					`${relPath}: cross-area import "${spec}" must use the public barrel "@/${target.area}"`
				);
				continue;
			}

			if (!AREA_RULES[area]?.allowedCrossAreaImports.has(target.area)) {
				violations.push(
					`${relPath}: ${area} may not import ${target.area}; allowed cross-area imports: ${[...AREA_RULES[area].allowedCrossAreaImports].map((name) => `"${name}"`).join(', ') || '(none)'}`
				);
				continue;
			}

			if (!hasNamespaceImport(sourceFile, spec)) {
				violations.push(`${relPath}: cross-area root import "${spec}" must use a namespace import`);
			}
			continue;
		}

		if (!isDeclaredPackage(spec)) {
			violations.push(`${relPath}: package "${spec}" is not declared in package.json`);
		}
	}

	for (const { alias, spec } of getNamespaceImports(sourceFile)) {
		const target = parseInternalSpec(spec);
		if (!target) continue;
		if (!target.isRoot) continue;
		const approved = APPROVED_PUBLIC_NAMESPACES[target.area];
		if (!approved) continue;

		for (const member of getNamespaceMemberUses(sourceFile, alias)) {
			if (!approved.has(member)) {
				violations.push(
					`${relPath}: ${spec} may only expose approved namespaces (${[...approved].map((name) => `"${name}"`).join(', ')}); found "${alias}.${member}"`
				);
			}
		}
	}
}

if (violations.length > 0) {
	console.error('Import boundary check failed:\n');
	for (const violation of violations) console.error(`- ${violation}`);
	process.exit(1);
}

console.log('Import boundary check passed.');
