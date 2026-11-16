# specforge: instructions for agents working in this repo

A Claude Code plugin (and its own marketplace) that drives idea -> draft spec -> approved spec -> merged build through Orca worktrees and a GitHub App. Read `README.md` for the user-facing manual and `docs/design.md` for why it is built this way. This file is about how to change the repo safely.

## Commands

- `npm test` runs unit tests and the real `dist/` bundles. `npm run build` bundles `src/` into `dist/` with esbuild.
- `dist/` is committed so adopting repos need no install step. After any `src/` change run `npm run build` and commit `dist/`; CI fails if it is stale.
- CI (`ci.yml`) and the reusable gate (`gate.yml`) pin Node 26, the current LTS, so local and CI match. When the LTS moves, change both pins in one PR and check nodejs.org first; do not use `lts/*`, which would change CI silently.

## How to change things

- **Never push to `main`.** Work on a branch, open a PR, and let it merge natively. Acting as the GitHub App is the norm: `export GH_TOKEN=$(node dist/mint-app-token.mjs)`, push with a one-off credential helper (`git -c credential.helper= -c "credential.helper=!f() { echo username=x-access-token; echo password=$GH_TOKEN; }; f" push ...`), `gh pr create`, `gh pr merge --squash --auto`.
- **If the app token is refused, stop and ask.** Never fall back to the user's own `gh` or git credentials to get past a permission gap. The app deliberately has no Workflows or Administration permission and should not be given them. One-time repo setup the user asked for (init's branch protection, the first push of workflow files) may use the user's login, but say so.
- Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. PR bodies end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- Say "independent" for spec reviewers. Do not use the old label for them anywhere: code, docs, commits, PR text. Independent means a different agent than the author with no author context, but with full read access to the codebase.

## Releasing

Releases are manual semver tags, and `v0` is the floating tag adopting repos pin to. After merging:

1. Bump the version in **both** `package.json` and `.claude-plugin/plugin.json` in the same PR.
2. `git tag vX.Y.Z && git tag -f v0`, then push `vX.Y.Z` and force-push `v0`.
3. Update this machine's install: `claude plugin marketplace update specforge && claude plugin update specforge@specforge`. Running sessions need a restart.

**Permissions are a contract.** A reusable workflow may never ask for permissions its callers do not already grant, or GitHub refuses to start the run (`startup_failure`), and open PRs read the caller file from their own branch so they break too. If a change needs a new permission: update callers first, then move `v0`. Check which repos have adopted before you move it.

## Design rules that were learned the hard way

- **The gate reports a commit status, `specforge/gate`, not a check run.** Check runs from different events never replace each other, so an early red run keeps a PR `BLOCKED` forever. Statuses are replaced per context. Branch protection requires the context `specforge/gate`.
- **Rely on GitHub natively** (branch protection, auto-merge, stale-approval dismissal, CODEOWNERS, delete head branches). Agents open the PR, enable auto-merge as the app, and stop. They never poll, wait, or merge another way. The workarounds for free private repos were deleted in 0.6.0; they live at tag `v0.5.0` for reference and must not be re-added.
- Rulesets match the target branch only. "A `spec/` PR needs a human, an `idea/` PR does not" cannot be expressed natively, which is why the gate exists and keys on the head branch prefix.
- The gate job holds `pull-requests: write` so it can re-request review when a push makes an approval stale (GitHub dismisses but does not re-request). It runs only the pinned release, never PR code.
- Approval counts only on the current head commit. GitHub keeps an approval attached when a push merely merges the base branch in, since the reviewed diff is unchanged.
- Spec files are `<spec_dir>/<id>.md` and the file name must equal the `id`. No frontmatter fields beyond the documented schema; `depends_on` is the one optional addition. A rename or delete must keep the dependency tree intact, and only `draft`/`approved` specs can be renamed.
- A build PR is `pending` until the spec is `done` with passing AC evidence at `<spec_dir>/evidence/<id>.json`. The evidence commit may change only that file. When a flow verifies work, an independent agent does it; the author never self-certifies.
- Build workers ask the user only in the cases listed in the build skill, and never get around a refused permission with the user's credentials.
- `gh run watch <id> --exit-status` waits for CI; `gh pr checks --watch` would hang forever on the gate's own pending status.
- Skills receive `${CLAUDE_PLUGIN_ROOT}` but spawned workers do not. When a skill hands work to another agent, write the literal path into the brief, and tell the worker to use it exactly as written.
- Spawned workers cannot read outside their worktree without a permission prompt, which stalls an unattended run. `init` allow-lists the plugin cache directory in the repo's uncommitted `.claude/settings.local.json`. Briefs go in a gitignored `.specforge/brief.md` inside the worktree, never in a scratch path.
- Launch a worker's agent only after its brief exists, and check `launch.prompt.outcome` is `journaled` or `handed-to-terminal`. An empty launch leaves an idle agent that looks like success.
- Always `fetch` with the app token and stop on failure. Never fall back to a cached `origin/main`.
- A merged PR's head can move on the server (update-branch, a merge from main). The sweep compares commits instead of requiring equality.

## Testing

Unit tests are not enough. Both bugs that mattered most were invisible to them: the bundles crashed on load, and the gate could not unblock a PR under real branch protection. Test end to end in `zalmb8/specforge-sandbox`, which is public, has real protection, and resets to a clean state with `git reset --hard blank` and a force-push (it is scratch; no other repo gets that treatment).

- Test the real path: install from the marketplace, then run `/specforge:init`, `/specforge:idea`, `/specforge:refine` in a fresh session.
- Test negative cases too: a PR the gate must reject, and confirm GitHub refuses to merge it.
- A worker that stalls or reports a problem is data. Fix the tool, not the symptom, and add a test that would have caught it.
- Close every Orca session you launch for a test as soon as you have read its result. The sweep removes worktrees, not sessions. Do not launch sessions in the user's main workspaces.
- `gh api repos/.../actions/jobs/<id>/logs` refuses to print logs containing escape sequences unless you pass `--allow-escape-sequences`; strip the ANSI codes before grepping. That is the reliable way to read a failed job's output.

## Layout

```
skills/      idea, refine, build, init, sweep
agents/      spec-reviewer, code-reviewer (shared rules only; the caller injects one lens), ac-verifier
lenses/      spec/ and code/, one review lens per file; all built-ins always run
src/ dist/   validator (spec.mjs), gate (gate.mjs, gate-cli.mjs), sweep, token minting
templates/   spec, config, gate caller
.github/     reusable gate workflow (gate.yml), CI
```

Specforge does not yet run its own gate; its `.specforge/config.yml` `protected_paths` describe the intent for when the build flow lets it develop itself. Until then its own PRs need only the `test` check.
