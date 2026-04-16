import { vi } from 'vitest';
import type * as lib from '@/lib';
import * as bm25 from '@/lib/bm25';
import * as embeddingSimilarity from '@/lib/embedding-similarity';
import * as providerDefaults from '@/lib/provider-defaults';
import * as providerTypes from '@/lib/provider-types';
import * as tokenEstimate from '@/lib/token-estimate';
import * as validateMd from '@/lib/validate-md';

export function createLibMock(actual?: typeof lib, overrides?: Partial<typeof lib>): typeof lib {
	const base = {
		bm25,
		embeddingSimilarity,
		providerDefaults,
		providerTypes,
		tokenEstimate,
		...(actual ?? {}),
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
			...validateMd,
			...(actual?.validateMd ?? {}),
			validate: vi.fn(() => [])
		}
	} satisfies typeof lib;

	return {
		...base,
		...overrides
	};
}

export async function mockLibModule() {
	return createLibMock();
}

export async function mockLibModuleFromOriginal(importOriginal: <T>() => Promise<T>) {
	const actual = await importOriginal<typeof import('@/lib')>();
	return createLibMock(actual);
}
