import * as lib from '@/lib';
import libContract from '@/tests/contracts/lib.json';

import { mergeMock, mockFn, type DeepPartial, type PublicApiMock } from './helpers';

type LibMock = PublicApiMock<typeof lib, typeof libContract>;

export function createLibMock(overrides?: DeepPartial<LibMock>): LibMock {
	const base = {
		providerDefaults: {
			DEFAULT_OLLAMA_URL: lib.providerDefaults.DEFAULT_OLLAMA_URL,
			WEBLLM_CONTEXT_OPTIONS: lib.providerDefaults.WEBLLM_CONTEXT_OPTIONS
		},
		providerTypes: {},
		rename: {
			renameWithDedup: mockFn<typeof lib.rename.renameWithDedup>()
		},
		validateMd: {
			validate: mockFn<typeof lib.validateMd.validate>(() => [])
		}
	} satisfies LibMock;

	return mergeMock<LibMock>(base, overrides);
}
