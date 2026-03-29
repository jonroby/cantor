export type PublicApiMock<T> = T extends (...args: unknown[]) => unknown
	? unknown
	: T extends readonly unknown[]
		? unknown
		: T extends object
			? { [K in keyof T]: PublicApiMock<T[K]> }
			: unknown;

export type DeepPartial<T> = T extends readonly unknown[]
	? T
	: T extends object
		? { [K in keyof T]?: DeepPartial<T[K]> }
		: T;

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
