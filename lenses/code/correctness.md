# Lens: correctness

Does the code do what the spec's acceptance criteria say, and nothing it should not? All code in this repo is AI-written, so treat the typical failure modes of generated code as correctness bugs.

- Bugs: wrong logic, off-by-one, unhandled edge cases, wrong error handling, race conditions, behavior that differs from what a comment or name claims.
- Conformance: for each acceptance criterion, find the code that satisfies it. Flag a criterion with no implementation, and code that implements something the spec does not ask for.
- Invented things: APIs, functions, flags, config keys, imports or packages that do not exist in this repo or in the library version it uses. Verify against the source or the manifest; do not assume.
- Needless additions: new dependencies the repo does not already use, abstractions with one caller, unused or dead code, and defensive handling of cases that cannot happen.
- Fit: naming, structure, error style and helpers should match the surrounding code. Flag a reinvented utility that already exists.
