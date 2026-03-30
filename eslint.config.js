import prettier from 'eslint-config-prettier';
import path from 'node:path';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off',
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
			],
			'svelte/no-navigation-without-resolve': 'off'
		}
	},
	{
		files: ['src/**/*.{ts,js,svelte,svelte.ts,svelte.js}'],
		ignores: ['src/view/canvas/**'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					paths: [
						{
							name: '@/domain/rename',
							message: 'Use "@/lib/rename".'
						},
						{
							name: '@/domain/diff',
							message: 'Use "@/lib/diff".'
						},
						{
							name: '@/domain/document-map',
							message: 'Use "@/lib/document-map".'
						},
						{
							name: '@/domain/document-map/index',
							message: 'Use "@/lib/document-map".'
						},
						{
							name: '@/domain/validate-md',
							message: 'Use "@/lib/validate-md".'
						},
						{
							name: '@/domain/validate-md/index',
							message: 'Use "@/lib/validate-md".'
						}
					],
					patterns: [
						{
							group: ['@/state/services/**'],
							message:
								'Use the canonical "@/external/**" modules. The state/services paths are compatibility shims only.'
						}
					]
				}
			]
		}
	},
	{
		files: ['src/domain/**/*.ts', 'src/domain/**/*.js'],
		ignores: [
			'src/domain/diff.ts',
			'src/domain/rename.ts',
			'src/domain/document-map/index.ts',
			'src/domain/validate-md/index.ts'
		],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: ['@/lib/**', '@/state/**', '@/external/**', '@/app/**', '@/view/**']
				}
			]
		}
	},
	{
		files: ['src/lib/**/*.ts', 'src/lib/**/*.js'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: ['@/domain/**', '@/state/**', '@/external/**', '@/app/**', '@/view/**']
				}
			]
		}
	},
	{
		files: ['src/state/*.ts', 'src/state/*.js', 'src/state/*.svelte.ts', 'src/state/*.svelte.js'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: ['@/external/**', '@/app/**', '@/view/**']
				}
			]
		}
	},
	{
		files: ['src/app/**/*.ts', 'src/app/**/*.js'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: ['@/view/**']
				}
			]
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig
			}
		}
	}
);
