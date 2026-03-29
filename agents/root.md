# Root Review Agent

Read:

1. `rules/root.md`
2. the module-specific rules file for the area being reviewed

Then review the change against those rules.

Prioritize:

- boundary violations
- naming regressions
- reintroduced deleted surfaces
- public API growth with weak ownership
- layer confusion

Do not propose redesign unless the change clearly violates the written rules.
