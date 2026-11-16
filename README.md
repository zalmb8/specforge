# specforge

A Claude Code plugin that drives the software lifecycle from idea to merged PR, using Orca worktrees and a GitHub App, so the same workflow can be adopted across repos.

```
idea  ->  draft spec  ->  refined, approved spec  ->  built, verified, merged
(auto)       (auto)           (you, once)                    (auto)
```

| Flow | Branch | Who merges | Human involvement |
|---|---|---|---|
| **idea** | `idea/<slug>` | GitHub, once checks pass | none |
| **refine** | `spec/<slug>` | GitHub, once you approve | you answer questions and approve the PR |
| **build** | `build/<slug>` | GitHub, once checks pass | only if the spec's acceptance criteria must change |

Status: `idea`, `refine`, the gate and `init` are implemented. `build` is next.

## Requirements

- **A public repo, or a plan with branch protection and auto-merge on private repos** (GitHub Pro/Team). See [Private repos on free plans](#private-repos-on-free-plans).
- Orca and the `orca` CLI, which creates a worktree and agent per flow.
- A GitHub App you own, installed on each repo, with Contents (write), Pull requests (write), Checks (read) and Metadata (read). Its private key goes in your macOS keychain; `~/.config/specforge/app.json` holds `appId`, `installationId` and `keychainService`.
- `gh` and Node 22+.

## Install

Once per machine:

```
claude plugin marketplace add zalmb8/specforge
claude plugin install specforge@specforge
```

Once per repo, in a Claude session in that repo: `/specforge:init`. It adds `.specforge/config.yml`, the gate workflow, a `specs/` directory, the plugin settings, branch protection, auto-merge and CODEOWNERS. Updates arrive through the marketplace (`claude plugin update specforge@specforge`); workflow fixes arrive on their own because repos pin the reusable workflow to `@v0`.

## Use

| Command | What it does |
|---|---|
| `/specforge:idea <idea>` | Spawns a worktree and agent that writes a draft spec, has it independently reviewed, and opens a PR that merges itself once the gate is green. Your current task is not interrupted. |
| `/specforge:refine <id>` | Opens an interactive agent in a `spec/<id>` worktree. It asks you the open questions, runs the independent review loop, asks for your explicit approval, and opens a PR. Approving the PR merges it. |
| `/specforge:sweep` | Removes worktrees and branches of finished work and lists stuck ones. Every flow runs it first. |

## How it stays safe

- **The spec file is the state.** `status` in its frontmatter moves `draft -> refining -> approved -> implementing -> done`, and a validator rejects illegal moves, approved specs with open questions, and acceptance criteria without a `verify` target.
- **A gate decides what each PR needs**, by branch prefix. `idea/` PRs may only add draft specs; `spec/` PRs need a human approval from someone other than the author, on the current head commit; `build/` PRs escalate to a human if acceptance criteria or protected paths change. The gate is a required check, so GitHub enforces it.
- **Reviewers are independent.** A spec is reviewed by fresh agents that did not write it, one per lens (testability, scope and risk, codebase fit, consistency), and that can read the codebase.
- **Specforge cannot merge changes to its own rails** without a human: its source, skills, agents and manifests are protected paths.
- **Agents act as the GitHub App**, never as you. If the app is refused, they stop and ask.

## Private repos on free plans

Specforge leans on GitHub features that free private repos don't have. On those repos the gate still runs and reports, but nothing makes GitHub *enforce* it, and some conveniences are missing:

| Missing on free private repos | Effect | Workaround |
|---|---|---|
| Branch protection and required checks | The gate is advisory; an agent could merge past it | Make agents merge only through a script that re-checks the gate and refuses on red |
| Auto-merge | Nothing merges a PR once checks pass | A workflow that merges on your approving review when the gate is green, or an agent that waits and merges |
| Dismissing stale approvals | A push after your approval still shows "approved" (the gate ignores it anyway, because it requires approval on the head commit) | A workflow that dismisses approvals on older commits and re-requests you |
| CODEOWNERS review requests | You are not added as reviewer | A script that requests the reviewers through the API |

Working versions of all four were written for this plugin and live at tag [`v0.5.0`](https://github.com/zalmb8/specforge/tree/v0.5.0): `src/merge-pr.mjs`, `.github/workflows/merge-on-approval.yml`, `.github/workflows/dismiss-stale.yml` and `src/request-review.mjs`. They are not maintained here. Wire them into your own caller workflow if you need them, and note that they need write permissions your caller must grant (`contents`, `pull-requests`, `checks: read`) and that GitHub refuses to start a reusable workflow that asks for more than its caller grants.

## Development

The repo is its own marketplace and uses its own last released tag to develop itself. `dist/` is committed (esbuild bundles) so consumers need no install step; run `npm run build` after changing `src/`, and `npm test`, which runs the real bundles too. See [`docs/design.md`](docs/design.md).

```
.claude-plugin/   plugin and marketplace manifests
skills/           idea, refine, build, init, sweep
agents/           spec-reviewer
lenses/           one review lens per file
src/ dist/        validator, gate, sweep, token minting
.github/workflows reusable gate workflow, CI
templates/        spec, config, gate caller
```

Releases are manual semver tags; `v0` is the floating tag repos pin to.
