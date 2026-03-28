/**
 * Attempts a rename. If the name conflicts, auto-increments ("name (1)", "name (2)", ...)
 * until it succeeds. Returns the final name used, or null if the input was empty.
 */
export function renameWithDedup(
	name: string,
	tryRename: (candidate: string) => boolean
): string | null {
	const trimmed = name.trim();
	if (!trimmed) return null;

	let candidate = trimmed;
	let i = 1;
	while (!tryRename(candidate)) {
		candidate = `${trimmed} (${i})`;
		i++;
	}
	return candidate;
}
