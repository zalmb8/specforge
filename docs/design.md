# specforge design

Lifecycle: `idea/` (auto-merged draft spec) -> `spec/` (human-approved) -> `build/` (auto-merged implementation).

- **State lives in the spec frontmatter** (`status`: draft, refining, approved, implementing, done). The spec file is `<spec_dir>/<id>.md`, with the slug as both the file name and the `id`; the gate enforces that. Validator: `src/spec.mjs`.
- **Policy lives in the gate** (`src/gate.mjs`, run by `.github/workflows/gate.yml` as the required check `specforge/gate`). It exists because rulesets match the target branch, never the source branch; the head branch prefix decides the rules:
  - `idea/`: only `specs/**`, draft only, no edits to non-draft specs.
  - `spec/`: always needs a human approval from someone who is not the PR author, given on the current head commit.
  - `build/`: spec must be approved/implementing; AC edits or protected paths need a human.
- **The gate reports a commit status**, `specforge/gate` (pending while it waits for a human, success when satisfied, failure for violations), and branch protection requires that context. It must not be a check run: runs from different events (opened, then review) do not replace each other, so an early red run would block the merge forever. It needs `statuses: write` on the caller's gate job.
- **GitHub does the rest, natively**: required checks (branch protection), dismissing stale approvals, auto-merge, delete-head-branch, and CODEOWNERS review requests. Agents never poll or merge themselves; they open the PR, run `gh pr merge --squash --auto` as the app, and stop. Public repos or paid plans only; the README lists what fails on free private repos and the workarounds (reference implementations live at tag `v0.5.0`).
- **Independent review**: reviewers are never the agent that wrote the spec and get no author context, but they read the codebase, because spec accuracy can't be judged without it.
- **Lenses** live in `lenses/*.md` (testability, scope-risk, codebase-fit, consistency). All built-in lenses always run, so plugin updates add lenses without any repo change; a repo adds extras in `.specforge/lenses/` listed in `review_lenses`, or skips built-ins via `exclude_lenses`. The `spec-reviewer` agent holds only the shared rules; the caller injects exactly one lens per reviewer.
- **Refine** (`/specforge:refine <id>`): the kickoff session creates a `spec/<id>` worktree and launches an interactive agent there; that agent answers open questions with the user, runs the independent review loop, gets an explicit yes, sets `approved`, opens the PR and enables auto-merge.
- **Cleanup**: `src/sweep.mjs` removes finished `idea/`, `spec/` and `build/` worktrees lazily (run by every flow, optionally on an Orca automation).
- **Identity**: agents act as the GitHub App (`dist/mint-app-token.mjs`); if the app token is refused, stop and ask rather than fall back to the user's credentials.
- **Versioning**: semver tags; consumers pin the reusable workflow to a major tag (`@v0` until 1.0). Specforge develops itself using the last released tag. Its own rails (src, dist, skills, agents, manifests) are protected paths.
- **Caller permissions are a contract**: a reusable workflow may never request permissions its callers don't already grant (GitHub refuses to start the run, and open PRs read the caller file from their own branch). Callers are updated before a tag moves.
- `dist/` is committed (esbuild bundles) so repos need no install step; CI fails if it is stale and the tests run the real bundles.
