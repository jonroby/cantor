import { vi } from 'vitest';

export type PublicApiMock<T, TContract> = TContract extends true
	? T
	: TContract extends object
		? {
				[K in keyof TContract]: K extends keyof T ? PublicApiMock<T[K], TContract[K]> : never;
			}
		: never;

export type DeepPartial<T> = T extends readonly unknown[]
	? T
	: T extends object
		? { [K in keyof T]?: DeepPartial<T[K]> }
		: T;

export function mockFn<T extends (...args: never[]) => unknown>(
	implementation?: (...args: Parameters<T>) => ReturnType<T>
): T {
	return vi.fn(implementation as T | undefined) as T;
}

export function mergeMock<T>(base: T, overrides?: DeepPartial<T>): T {
	if (!overrides) return base;
	if (Array.isArray(base) || Array.isArray(overrides)) {
		return overrides as T;
	}

	const output: Record<string, unknown> = { ...(base as Record<string, unknown>) };
	for (const [key, value] of Object.entries(overrides as Record<string, unknown>)) {
		if (value === undefined) continue;

		const current = output[key];
		if (
			current &&
			value &&
			typeof current === 'object' &&
			typeof value === 'object' &&
			!Array.isArray(current) &&
			!Array.isArray(value)
		) {
			output[key] = mergeMock(current, value as DeepPartial<typeof current>);
			continue;
		}

		output[key] = value;
	}

	return output as T;
}
