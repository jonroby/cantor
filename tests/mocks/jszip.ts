import { vi } from 'vitest';

export function createJSZipMock() {
	const file = vi.fn();
	const generateAsync = vi.fn(async () => new Blob(['zip-content']));

	class MockJSZip {
		file = file;
		generateAsync = generateAsync;
	}

	return {
		default: MockJSZip,
		file,
		generateAsync
	};
}

export async function mockJSZipModule() {
	return createJSZipMock();
}
