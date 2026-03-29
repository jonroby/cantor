import { describe, expect, it } from 'vitest';

import { hasDuplicateNames, isUniqueName } from './index';

describe('domain constraints', () => {
	it('reports false when a name conflicts', () => {
		expect(isUniqueName('Docs', ['Docs', 'Docs (2)'])).toBe(false);
	});

	it('reports true when a name is already unique', () => {
		expect(isUniqueName('Docs', ['Other'])).toBe(true);
	});

	it('detects duplicate chat, folder, and file names', () => {
		const chats = [{ name: 'Chat' }, { name: 'Chat' }, { name: 'Chat (2)' }];
		const folders = [
			{
				name: 'Docs',
				files: [{ name: 'readme.md' }, { name: 'readme.md' }, { name: 'readme.md (2)' }]
			},
			{ name: 'Docs' }
		];

		expect(hasDuplicateNames(chats, folders)).toBe(true);
	});

	it('reports false when all names satisfy uniqueness constraints', () => {
		const chats = [{ name: 'Chat' }];
		const folders = [{ name: 'Docs', files: [{ name: 'readme.md' }] }];

		expect(hasDuplicateNames(chats, folders)).toBe(false);
	});
});
