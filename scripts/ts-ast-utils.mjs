import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export const ROOT = process.cwd();
export const SRC_DIR = path.join(ROOT, 'src');
export const ROOT_AREAS = ['app', 'external', 'state', 'domain', 'lib', 'view'];
export const SOURCE_EXTENSIONS = ['.ts', '.js', '.svelte.ts', '.svelte.js', '.svelte'];

export function normalizePath(value) {
	return value.replaceAll('\\', '/');
}

export function relative(filePath) {
	return normalizePath(path.relative(ROOT, filePath));
}

export function readFile(filePath) {
	return fs.readFileSync(filePath, 'utf8');
}

export function ensureDir(dirPath) {
	fs.mkdirSync(dirPath, { recursive: true });
}

export function readSourceFile(filePath) {
	return ts.createSourceFile(
		filePath,
		readFile(filePath),
		ts.ScriptTarget.Latest,
		true,
		scriptKind(filePath)
	);
}

function scriptKind(filePath) {
	if (filePath.endsWith('.js')) return ts.ScriptKind.JS;
	if (filePath.endsWith('.svelte')) return ts.ScriptKind.TS;
	return ts.ScriptKind.TS;
}

export function resolveModulePath(fromFile, spec) {
	const basePath = path.resolve(path.dirname(fromFile), spec);
	for (const extension of SOURCE_EXTENSIONS) {
		const candidate = `${basePath}${extension}`;
		if (fs.existsSync(candidate)) return candidate;
	}

	for (const extension of SOURCE_EXTENSIONS) {
		const candidate = path.join(basePath, `index${extension}`);
		if (fs.existsSync(candidate)) return candidate;
	}

	throw new Error(`Could not resolve "${spec}" from ${relative(fromFile)}`);
}

export function walk(dir) {
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		if (entry.name === 'canvas') continue;
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...walk(full));
			continue;
		}
		if (SOURCE_EXTENSIONS.some((ext) => full.endsWith(ext))) {
			files.push(full);
		}
	}
	return files;
}

export function visit(node, callback) {
	callback(node);
	ts.forEachChild(node, (child) => visit(child, callback));
}

export function getStringLiteralValue(node) {
	if (!node) return null;
	if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
		return node.text;
	}
	return null;
}

export function getImportLikeSpecs(sourceFile) {
	const specs = [];

	visit(sourceFile, (node) => {
		if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
			const spec = getStringLiteralValue(node.moduleSpecifier);
			if (spec) specs.push(spec);
			return;
		}

		if (
			ts.isCallExpression(node) &&
			node.expression.kind === ts.SyntaxKind.ImportKeyword &&
			node.arguments.length === 1
		) {
			const spec = getStringLiteralValue(node.arguments[0]);
			if (spec) specs.push(spec);
			return;
		}

		if (
			ts.isCallExpression(node) &&
			ts.isPropertyAccessExpression(node.expression) &&
			ts.isIdentifier(node.expression.expression) &&
			node.expression.expression.text === 'vi' &&
			node.expression.name.text === 'mock' &&
			node.arguments.length > 0
		) {
			const spec = getStringLiteralValue(node.arguments[0]);
			if (spec) specs.push(spec);
		}
	});

	return specs;
}

export function getNamespaceImports(sourceFile) {
	const imports = [];

	for (const statement of sourceFile.statements) {
		if (!ts.isImportDeclaration(statement)) continue;
		const spec = getStringLiteralValue(statement.moduleSpecifier);
		if (!spec) continue;
		const clause = statement.importClause;
		const namespace = clause?.namedBindings;
		if (namespace && ts.isNamespaceImport(namespace)) {
			imports.push({ alias: namespace.name.text, spec });
		}
	}

	return imports;
}

export function getNamespaceMemberUses(sourceFile, alias) {
	const members = [];
	visit(sourceFile, (node) => {
		if (
			ts.isPropertyAccessExpression(node) &&
			ts.isIdentifier(node.expression) &&
			node.expression.text === alias
		) {
			members.push(node.name.text);
		}
	});
	return members;
}

export function parseExports(filePath, seen = new Set()) {
	const normalizedFile = path.resolve(filePath);
	if (seen.has(normalizedFile)) return {};
	seen.add(normalizedFile);

	const sourceFile = readSourceFile(normalizedFile);
	const exportsMap = {};

	for (const statement of sourceFile.statements) {
		if (ts.isExportDeclaration(statement)) {
			const spec = getStringLiteralValue(statement.moduleSpecifier);
			if (statement.exportClause && ts.isNamespaceExport(statement.exportClause) && spec) {
				exportsMap[statement.exportClause.name.text] = parseExports(
					resolveModulePath(normalizedFile, spec),
					new Set(seen)
				);
				continue;
			}

			if (!statement.exportClause && spec) {
				Object.assign(
					exportsMap,
					parseExports(resolveModulePath(normalizedFile, spec), new Set(seen))
				);
				continue;
			}

			if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
				if (statement.isTypeOnly) continue;
				for (const element of statement.exportClause.elements) {
					if (element.isTypeOnly) continue;
					exportsMap[element.name.text] = true;
				}
				continue;
			}
		}

		const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
		if (!modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;

		if (
			ts.isFunctionDeclaration(statement) ||
			ts.isClassDeclaration(statement) ||
			ts.isEnumDeclaration(statement)
		) {
			if (statement.name) exportsMap[statement.name.text] = true;
			continue;
		}

		if (ts.isVariableStatement(statement)) {
			for (const declaration of statement.declarationList.declarations) {
				if (ts.isIdentifier(declaration.name)) {
					exportsMap[declaration.name.text] = true;
				}
			}
			continue;
		}
	}

	return sortExportMap(exportsMap);
}

function sortExportMap(value) {
	if (value === true) return true;
	const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
	return Object.fromEntries(entries.map(([key, child]) => [key, sortExportMap(child)]));
}
