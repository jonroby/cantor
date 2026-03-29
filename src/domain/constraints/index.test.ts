import { describe, expect, it } from 'vitest';

import { enforceUniqueName, enforceUniqueNames } from './index';

describe('domain constraints', () => {
	it('enforces a unique name when there is a conflict', () => {
		expect(enforceUniqueName('Docs', ['Docs', 'Docs (2)'])).toBe('Docs (3)');
	});

	it('returns the original name when it is already unique', () => {
		expect(enforceUniqueName('Docs', ['Other'])).toBe('Docs');
	});

	it('enforces unique chat, folder, and file names in place', () => {
		const chats = [{ name: 'Chat' }, { name: 'Chat' }, { name: 'Chat (2)' }];
		const folders = [
			{
				name: 'Docs',
				files: [{ name: 'readme.md' }, { name: 'readme.md' }, { name: 'readme.md (2)' }]
			},
			{ name: 'Docs' }
		];

		expect(enforceUniqueNames(chats, folders)).toBe(true);
		expect(chats.map((chat) => chat.name)).toEqual(['Chat', 'Chat (2)', 'Chat (2) (2)']);
		expect(folders.map((folder) => folder.name)).toEqual(['Docs', 'Docs (2)']);
		expect(folders[0]?.files?.map((file) => file.name)).toEqual([
			'readme.md',
			'readme.md (2)',
			'readme.md (2) (2)'
		]);
	});

	it('reports unchanged when all names already satisfy uniqueness constraints', () => {
		const chats = [{ name: 'Chat' }];
		const folders = [{ name: 'Docs', files: [{ name: 'readme.md' }] }];

		expect(enforceUniqueNames(chats, folders)).toBe(false);
	});
});
