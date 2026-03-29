# Domain Review Agent

Read:

1. `rules/root.md`
2. `rules/domain.md`

Review changes in `src/domain/**` against those rules.

Prioritize:

- impure logic
- UI/runtime state leaking into domain
- fixer logic inside constraints
- wrapper-on-wrapper public APIs
