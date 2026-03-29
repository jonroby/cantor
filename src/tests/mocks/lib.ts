import { vi } from 'vitest';

import type * as lib from '@/lib';

import { mergeMock, type DeepPartial, type PublicApiMock } from './helpers';

type LibMock = PublicApiMock<typeof lib>;

export function createLibMock(overrides?: DeepPartial<LibMock>): LibMock {
	const base = {
		diff: {
			diffLines: vi.fn(() => [])
		},
		documentMap: {
			mapDocument: vi.fn(() => []),
			marked: {
				lexer: vi.fn(() => []),
				parser: vi.fn(() => ''),
				parse: vi.fn((text: string) => text)
			} as unknown as LibMock['documentMap']['marked']
		},
		providerDefaults: {
			DEFAULT_OLLAMA_URL: 'http://localhost:11434',
			WEBLLM_CONTEXT_OPTIONS: [
				{ label: '4K', value: 4_096 },
				{ label: '8K', value: 8_192 },
				{ label: '16K', value: 16_384 }
			] as const
		},
		providerTypes: {},
		rename: {
			renameWithDedup: vi.fn()
		},
		validateMd: {
			validate: vi.fn(() => [])
		}
	} satisfies LibMock;

	return mergeMock(
		base as unknown as Record<string, unknown>,
		overrides as DeepPartial<Record<string, unknown>>
	) as unknown as LibMock;
}
