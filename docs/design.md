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

- **Independent review**: reviewers are never the agent that wrote the spec and get no author context, but they read the codebase, because spec accuracy can't be judged without it.
- **Lenses** live in `lenses/*.md` (testability, scope-risk, codebase-fit, consistency); all built-in lenses always run, so plugin updates add lenses without any repo change; a repo adds extras in `.specforge/lenses/` listed in `review_lenses`, or skips built-ins via `exclude_lenses`. The `spec-reviewer` agent holds only the shared rules, and the caller injects exactly one lens per reviewer.
- **Approval is per commit**: a human approval only counts for the PR head commit it was given on, so a later push (by the app or anyone) needs a fresh approval. The opt-in `dismiss-stale` workflow also dismisses the stale approval and re-requests the reviewer, so GitHub's own "approved" state and the reviewer's notifications match the gate. (Native stale-approval dismissal needs branch protection, which free private repos lack. GitHub keeps an approval attached to the new head when a push only merges the base branch in, since the reviewed diff is unchanged.)
- **Caller permissions are a contract.** A reusable workflow may never request permissions its callers' templates don't already grant; GitHub refuses to start the run (`startup_failure`), and review events read the caller file from the PR's own branch, so open PRs break too. Any permission change ships as a new tag line (not a patch under `@v0`), and callers are updated first.
- **Reviewers**: refine requests `reviewers` from config (else CODEOWNERS) on the PR, never the author. CODEOWNERS alone isn't enough: GitHub only auto-requests from it on public repos or paid private plans.
- **Refine** (`/specforge:refine <id>`): kickoff session creates a `spec/<id>` worktree and launches an interactive agent there; that agent answers open questions with the user, runs the independent review loop, gets an explicit yes, sets `approved`, and opens the PR. `merge-pr` waits for the human approval (a spec/ gate is red until then) and merges.
