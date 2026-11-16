# specforge design

Lifecycle: `idea/` (auto-merged draft spec) -> `spec/` (human-approved) -> `build/` (auto-merged implementation).

- **State lives in the spec frontmatter** (`status`: draft, refining, approved, implementing, done). Validator: `src/spec.mjs`.
- **Policy lives in the gate** (`src/gate.mjs`, run by `.github/workflows/gate.yml` as the required check `specforge/gate`). The head branch prefix decides the rules:
  - `idea/`: only `specs/**`, draft only, no edits to non-draft specs. Auto-merge.
  - `spec/`: always needs a non-author human approval.
  - `build/`: spec must be approved/implementing; AC edits or protected paths need a human.
- **Cleanup**: `src/sweep.mjs` removes finished `idea/` worktrees lazily (run by every flow and optionally on an Orca automation).
- **Versioning**: semver tags; consumers pin the reusable workflow to a major tag (`@v0` until 1.0). Specforge develops itself using the last released tag, never the working tree.
- **Self-protection**: `.specforge/config.yml` `protected_paths` + CODEOWNERS keep the automation from auto-merging edits to its own rails.

`dist/` is committed (bundled with esbuild) so repos need no install step. Run `npm run build` after changing `src/`; CI fails if dist is stale.
