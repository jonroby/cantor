import { vi } from 'vitest';
import * as actualLib from '@/lib';
import type * as lib from '@/lib';

export function createLibMock(
	actual: typeof lib = actualLib,
	overrides?: Partial<typeof lib>
): typeof lib {
	const base = {
		...actual,
		rename: {
			renameWithDedup: vi.fn((name: string, tryRename: (candidate: string) => boolean) => {
				const trimmed = name.trim();
				if (!trimmed) return null;

				let candidate = trimmed;
				let i = 1;
				while (!tryRename(candidate)) {
					candidate = `${trimmed} (${i})`;
					i++;
				}
				return candidate;
			})
		},
		validateMd: {
			...actual.validateMd,
			validate: vi.fn(() => [])
		}
	} satisfies typeof lib;

	return {
		...base,
		...overrides
	};
}

export async function mockLibModule() {
	return createLibMock(actualLib);
}

export async function mockLibModuleFromOriginal(
	importOriginal: <T>() => Promise<T>
) {
	const actual = await importOriginal<typeof import('@/lib')>();
	return createLibMock(actual);
}
