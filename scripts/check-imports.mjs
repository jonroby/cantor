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

const AREA_ORDER = ['domain', 'lib', 'state', 'external', 'app', 'view'];

const GENERAL_RULES = {
	requirePublicBarrelsAcrossAreas: true
};

const APPROVED_PUBLIC_NAMESPACES = {
	app: new Set([
		'chat',
		'search',
		'runtime',
		'content',
		'documents',
		'providers',
		'files',
		'types'
	]),
	external: new Set(['persistence', 'files', 'providers', 'streams']),
	state: new Set(['chats', 'documents', 'providers'])
};

const AREA_RULES = {
	domain: {
		allowedCrossAreaImports: new Set(),
		forbiddenSourcePatterns: []
	},
	lib: {
		allowedCrossAreaImports: new Set(),
		forbiddenSourcePatterns: []
	},
	state: {
		allowedCrossAreaImports: new Set(['domain', 'lib']),
		forbiddenSourcePatterns: []
	},
	external: {
		allowedCrossAreaImports: new Set(['domain', 'lib', 'state']),
		forbiddenSourcePatterns: []
	},
	app: {
		allowedCrossAreaImports: new Set(['domain', 'lib', 'state', 'external']),
		forbiddenSourcePatterns: [
			{
				pattern: /from\s+['"]svelte-sonner['"]/,
				message: 'app may not import svelte-sonner; UI notifications belong in view'
			},
			{
				pattern: /\blocalStorage\b/,
				message: 'app may not touch localStorage directly; route persistence through external'
			}
		]
	},
	view: {
		allowedCrossAreaImports: new Set(['app']),
		forbiddenSourcePatterns: []
	}
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
	for (const area of AREA_ORDER) {
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

function escapeForRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function namespaceAliases(code) {
	const aliases = [];
	const pattern =
		/^\s*import\s+(?:type\s+)?\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s*['"](@\/(?:domain|lib|state|external|app|view))['"]/gm;
	for (const match of code.matchAll(pattern)) {
		aliases.push({ alias: match[1], spec: match[2] });
	}
	return aliases;
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
	return {
		area: match[1],
		isRoot: match[2] == null
	};
}

const violations = [];

for (const file of walk(SRC_DIR)) {
	const relPath = path.relative(ROOT, file).replaceAll('\\', '/');
	if (TEST_FILE_RE.test(relPath)) continue;
	const area = areaFor(relPath);
	if (!area) continue;
	const code = fs.readFileSync(file, 'utf8');
	for (const rule of AREA_RULES[area]?.forbiddenSourcePatterns ?? []) {
		if (rule.pattern.test(code)) {
			violations.push(`${relPath}: ${rule.message}`);
		}
	}
	for (const spec of importSpecs(code)) {
		if (spec.startsWith('.')) continue;

		if (spec.startsWith('@/')) {
			if (spec.startsWith('@/assets/')) continue;
			const target = parseInternalSpec(spec);
			if (!target) {
				violations.push(`${relPath}: unknown internal import "${spec}"`);
				continue;
			}
			if (target.area === area) {
				continue;
			}
			if (GENERAL_RULES.requirePublicBarrelsAcrossAreas && !target.isRoot) {
				violations.push(
					`${relPath}: cross-area import "${spec}" must use the public barrel "@/` +
						`${target.area}"`
				);
				continue;
			}
			if (!AREA_RULES[area]?.allowedCrossAreaImports.has(target.area)) {
				violations.push(
					`${relPath}: ${area} may not import ${target.area}; allowed cross-area imports: ` +
						`${[...AREA_RULES[area].allowedCrossAreaImports].map((name) => `"${name}"`).join(', ') || '(none)'}`
				);
				continue;
			}
			const namespacePattern = new RegExp(
				`^\\s*import\\s+(?:type\\s+)?\\*\\s+as\\s+[A-Za-z_$][\\w$]*\\s+from\\s*['"]${escapeForRegExp(spec)}['"]`,
				'm'
			);
			if (!namespacePattern.test(code)) {
				violations.push(`${relPath}: cross-area root import "${spec}" must use a namespace import`);
				continue;
			}
			continue;
		}

		if (!isDeclaredPackage(spec)) {
			violations.push(`${relPath}: package "${spec}" is not declared in package.json`);
		}
	}

	for (const { alias, spec } of namespaceAliases(code)) {
		const target = parseInternalSpec(spec);
		if (!target) continue;
		const approved = APPROVED_PUBLIC_NAMESPACES[target.area];
		if (!approved) continue;

		const memberPattern = new RegExp(`\\b${escapeForRegExp(alias)}\\.([A-Za-z_$][\\w$]*)`, 'g');
		for (const match of code.matchAll(memberPattern)) {
			const member = match[1];
			if (!approved.has(member)) {
				violations.push(
					`${relPath}: ${spec} may only expose approved namespaces ` +
						`(${[...approved].map((name) => `"${name}"`).join(', ')}); found "${alias}.${member}"`
				);
			}
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
