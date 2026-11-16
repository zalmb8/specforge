# specforge

A Claude Code plugin that drives the software lifecycle from idea to merged PR, using Orca worktrees and a GitHub App, so one workflow can be adopted across many repos.

```
idea  ->  draft spec  ->  refined, approved spec  ->  built, verified, merged
(auto)       (auto)           (you, once)                    (auto)
```

| Flow | Branch | Merged by | Your involvement |
|---|---|---|---|
| **idea** | `idea/<slug>` | GitHub, once the gate passes | none |
| **refine** | `spec/<slug>` | GitHub, once you approve the PR | answer open questions, approve the spec, approve the PR |
| **build** | `build/<slug>` | GitHub, once the gate passes (spec `done` with passing AC evidence) | only if the spec's acceptance criteria must change, or something is refused |

**Status:** all three flows, the gate, `init` and `sweep` are implemented.

**Contents:** [How it works](#how-it-works) · [One-time setup](#one-time-setup) · [Adopt a repo](#adopt-a-repo) · [Day to day](#day-to-day) · [Keeping it updated](#keeping-it-updated) · [Configuration](#configuration) · [Troubleshooting](#troubleshooting) · [Private repos on free plans](#private-repos-on-free-plans) · [Development](#development)

## How it works

- **The spec is the state.** Each spec is `specs/<slug>.md` with YAML frontmatter: `id` (equal to the file name), `title`, `status` and `acceptance` (a list of `AC-n` criteria, each with a `verify` target). `status` moves `draft -> refining -> approved -> implementing -> done`. A validator rejects illegal moves, approved specs with open questions, and criteria with no `verify` target.
- **A gate decides what each PR needs, by branch prefix.** It reports one commit status, `specforge/gate`, that branch protection requires:
  - `idea/`: may only add draft specs under `specs/`. No human needed.
  - `spec/`: needs an approving review from a human who is not the PR author, **on the current head commit**. The status stays `pending` until then.
  - `build/`: needs a human only if acceptance criteria, `depends_on` or protected paths change. It also refuses a build whose dependencies are not `done`, and stays `pending` until the spec is `done` and committed AC evidence passes (see [Build](#build)).
- **Specs can depend on each other.** `depends_on` lists the ids of specs that must be `done` before this one can be built. The validator and gate check the whole tree: every id must exist and there must be no cycles. A spec can be renamed or removed only while it is `draft` or `approved`, and only if no spec still points at the old id, so a rename PR must update every referrer. `implementing` and `done` specs keep their names.
- **GitHub does the merging.** Agents open the PR, enable native auto-merge as the GitHub App, and stop. Nothing polls or waits. Branch protection, stale-approval dismissal, CODEOWNERS review requests and branch deletion are all native GitHub features.
- **Reviewers are independent.** A spec is reviewed by fresh agents that did not write it and have no author context, one per lens (testability, scope and risk, codebase fit, consistency). They read the codebase, because a spec cannot be judged without it.
- **Agents act as your GitHub App, never as you.** If the app is refused, they stop and ask.
- **Cleanup is a sweep.** Each flow first removes worktrees and branches of finished work (`/specforge:sweep`).

## One-time setup

Do this once per machine. Everything here assumes macOS (the App key lives in the keychain).

### 1. Check the requirements

- **A public repo, or a paid plan** (GitHub Pro/Team) for private repos. Specforge relies on branch protection, auto-merge and CODEOWNERS. See [Private repos on free plans](#private-repos-on-free-plans).
- **Orca**, with the `orca` CLI on your `PATH` (`orca status` should work). Each flow creates a worktree and an agent through it.
- **`gh`** authenticated with the `workflow` scope (`gh auth refresh -s workflow`), **Node 26** (the current LTS, which CI and the gate run on), and **Claude Code**.

### 2. Create a GitHub App

Specforge's agents open PRs, push branches and enable auto-merge as an App, so they never use your own identity.

1. GitHub, Settings, Developer settings, GitHub Apps, **New GitHub App**.
2. Give it a name. Uncheck **Webhook > Active**. Set **Where can this app be installed** to *Only on this account*.
3. Repository permissions: **Contents** read and write, **Pull requests** read and write, **Checks** read, **Commit statuses** read, **Actions** read, **Metadata** read. Nothing else. Agents read checks and statuses to see whether the gate passed, and Actions logs to fix failing CI in the build flow. In particular do **not** give it Workflows or Administration: agents must not edit workflows or loosen protection.
4. Create it and note the **App ID**.
5. On the App page, **Generate a private key**. A `.pem` file downloads. It can be downloaded only once; you can always generate another.
6. Put the key in your keychain and delete the file:
   ```
   security add-generic-password -s specforge-app-key -a "$USER" -U -w "$(cat ~/Downloads/<key>.pem)"
   rm -P ~/Downloads/<key>.pem
   ```
7. **Install App** on your account, choosing the repos you will adopt specforge in (you can add more later). The number at the end of the installation URL, `github.com/settings/installations/<id>`, is the **installation ID**.
8. Tell specforge about it:
   ```
   mkdir -p ~/.config/specforge
   cat > ~/.config/specforge/app.json <<'EOF'
   { "appId": "<App ID>", "installationId": "<installation ID>", "keychainService": "specforge-app-key" }
   EOF
   ```
9. Check it: `node <plugin dir>/dist/mint-app-token.mjs | wc -c` prints about 380 characters. The first run asks you to allow keychain access; choose Always Allow for `security`.

### 3. Install the plugin

```
claude plugin marketplace add zalmb8/specforge
claude plugin install specforge@specforge
```

Restart any open Claude Code sessions. `claude plugin details specforge@specforge` should list the skills `idea`, `refine`, `build`, `init`, `sweep` and the agent `spec-reviewer`.

## Adopt a repo

Do this once per repo. The repo must be public, or on a plan that supports branch protection (see the requirements above).

1. Add the repo to the App's installation (`github.com/settings/installations/<id>`, Repository access).
2. Open a Claude Code session in the repo and run **`/specforge:init`**. It asks one question: the test and lint commands it found, the spec directory (default `specs`) and your GitHub username for CODEOWNERS. Then it:
   - writes `.specforge/config.yml`, `.github/workflows/specforge-gate.yml`, `.github/CODEOWNERS` (`specs/ @you`) and `specs/.gitkeep`;
   - merges `.claude/settings.json` (the marketplace and `enabledPlugins`, so teammates are prompted to install) and the gitignored `.claude/settings.local.json` (lets unattended workers read the plugin directory without stalling on a permission prompt);
   - adds `.specforge/brief.md` and `.claude/settings.local.json` to `.gitignore`;
   - enables auto-merge, squash merge and delete-branch-on-merge on the repo, and **creates branch protection** on the default branch: required status `specforge/gate`, branches up to date, stale approvals dismissed, admins not enforced. It reads existing protection first and only adds to it.

   These repo and protection settings use your own `gh` login, because the App has no admin rights. That is deliberate, and it is the one place specforge uses your identity.
3. **Commit through a PR.** The App cannot push workflow files, and protection now requires the gate, so open the adoption PR yourself: branch, commit what `init` wrote (not `settings.local.json`), `gh pr create`, `gh pr merge --squash --auto`. The gate runs on that PR and merges it.
4. Check the result:
   - `gh api repos/<owner>/<repo>/branches/<default>/protection` lists `specforge/gate` as a required context;
   - `.github/workflows/specforge-gate.yml` is on the default branch;
   - the App appears in the repo's installation.
5. Every other machine that uses the repo runs `/specforge:init` once, so it gets its own `settings.local.json`. It never overwrites existing keys.

## Day to day

### Capture an idea

In any Claude session in the repo, say what the idea is, or run `/specforge:idea <idea>`. The session gives the idea to a new worktree and agent, then you carry on with your task. That agent writes a draft spec from the context (unknowns go under "Open questions", not invented), has two independent reviewers critique it, validates it, opens a PR as the App, and enables auto-merge. The gate passes within seconds and GitHub merges it. You are not asked anything.

### Refine a spec

When you want to work on a draft, run **`/specforge:refine <slug>`**. A unique prefix works, and with no argument you get a list of drafts. The session creates a `spec/<slug>` worktree and launches an interactive agent there. **Continue in that workspace.** The agent will:

1. ask you the open questions, grouped, with a recommendation each, and rewrite the design and acceptance criteria to reflect your answers;
2. replace every `verify: TBD` with a concrete target;
3. run the independent review loop (up to `loops.spec_review_max` rounds): it fixes valid findings, pushes back on wrong ones with a reason, and asks you about the questionable ones;
4. show you the final spec and ask for an explicit yes;
5. set `status: approved`, open the PR as the App, and enable auto-merge.

CODEOWNERS requests you as reviewer. The `specforge/gate` status stays `pending` until you approve. **Review the PR on GitHub and approve it.** The status flips to success and GitHub merges it and deletes the branch. The PR description lists every review finding the agent pushed back on, with its reasoning, so you can check it.

If someone pushes to the PR after you approve it, GitHub dismisses your approval and the gate goes back to `pending` until you approve the new commit. GitHub does not re-request your review when it does this, so the gate does: it asks you again, and you are listed as a requested reviewer with a new notification.

### Build

Run **`/specforge:build <slug>`** (a unique prefix works; with no argument you get the `approved` specs). The kickoff session checks that every spec in `depends_on` is `done` (it refuses, and tells you which is not, if not), creates a `build/<slug>` worktree and launches an agent that **works unattended**. It flags its Orca workspace and asks you there only when it must. The agent:

1. sets the spec to `implementing` and **writes the tests first**: it creates the thing each criterion's `verify` target names and confirms it fails before implementing;
2. implements until your `commands.test` and `commands.lint` pass;
3. runs independent code reviewers, one per lens (correctness, test quality, resiliency, AI best practices), up to `loops.code_review_max` rounds. It fixes valid findings, pushes back on wrong ones with a reason, and treats a finding that implies a spec change as an escalation;
4. opens the PR as the App and enables auto-merge. The gate stays `pending`;
5. watches CI in the background and fixes failures from the logs, up to `loops.ci_fix_max` rounds;
6. sets the spec to `done`, then an independent `ac-verifier` agent runs every `verify` target itself and commits `specs/evidence/<slug>.json`, recording the commit it verified. It posts the results table on the PR. Any later change invalidates the evidence.

The gate turns `success`, and GitHub merges the PR, only when the spec is `done`, every criterion has passing evidence for its exact `verify` text, and nothing but the evidence file changed since it was recorded. CI still runs your tests, which is the real enforcement; the evidence is the attestation.

**You are only pulled in when** a dependency is not done, an acceptance criterion cannot be met as written (the agent proposes an amendment and the PR then needs your approval), a permission is refused, a loop cap is reached, or the PR touches a protected path. A build that needs to change `.github/workflows` cannot be done autonomously, because the App cannot push workflow files.

### Clean up

Every flow sweeps first. To run it yourself: `/specforge:sweep` shows what it would remove, then removes it. A worktree is removed only when its PR merged, the local commit is contained in the merged head, the tree is clean and nothing is unpushed. Anything else is listed as stuck with the reason (PR still open, PR closed without merging, uncommitted changes, ...). You can schedule it:

```
orca automations create --name specforge-sweep --trigger daily --time 07:00 --provider claude \
  --repo path:<repo> --prompt "Run the specforge sweep skill with --apply and report stuck ideas."
```

The sweep removes worktrees, not agent sessions. Close finished sessions in Orca.

## Keeping it updated

Two things update independently.

**The plugin** (skills, agents, lenses, scripts). Update when a release is announced, or periodically:

```
claude plugin marketplace update specforge
claude plugin update specforge@specforge
```

Restart open sessions to apply. Releases are semver tags on `github.com/zalmb8/specforge`.

**The gate workflow.** Your repos call it as `uses: zalmb8/specforge/.github/workflows/gate.yml@v0`. `v0` is a floating tag, so gate fixes arrive in every repo with no PR. When a release needs a change in your own caller file (a new permission, a renamed job), the release notes say so, and you update `.github/workflows/specforge-gate.yml` from `templates/gate-caller.yml` **before** you rely on the new version; a caller that grants less than the workflow asks for fails to start. `/specforge:init --upgrade` compares the repo's config version and workflow tag with the plugin's, then migrates or reports what differs.

To check where a repo stands: the version in `claude plugin list`, the `@v` tag in the caller workflow, and the `specforge:` version in `.specforge/config.yml`.

## Configuration

`.specforge/config.yml`:

| Key | Meaning |
|---|---|
| `spec_dir` | Where specs live (default `specs`). |
| `protected_paths` | Extra regexes (for example `^migrations/`) that always need a human on a `build/` PR. `.github/`, `.specforge/` and `CODEOWNERS` always do. |
| `commands.test`, `commands.lint` | Used by the build flow. Leave a command empty if the repo has none. |
| `loops.spec_review_max` | Review rounds in refine (default 3). `ci_fix_max` and `code_review_max` are for the build flow. |
| `review_lenses` | Names of **extra spec lenses**, from `.specforge/lenses/spec/<name>.md`. |
| `exclude_lenses` | Built-in spec lenses to skip, by name. |
| `code_review_lenses` | Names of **extra code lenses** for the build flow, from `.specforge/lenses/code/<name>.md`. |
| `exclude_code_lenses` | Built-in code lenses to skip, by name. |

All built-in lenses run every time (`lenses/spec/` for specs: testability, scope-risk, codebase-fit, consistency; `lenses/code/` for builds: correctness, test-quality, resiliency, ai-best-practices), so plugin updates add lenses without a config change. To add your own, write `.specforge/lenses/spec/<name>.md` or `.specforge/lenses/code/<name>.md`: a short description of what to check and what counts as a finding, then list `<name>` under `review_lenses` or `code_review_lenses`. A repo file with a built-in's name replaces that built-in.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| A `spec/` PR is approved but not merging; `mergeStateStatus` is `BLOCKED` | Check `gh api repos/<o>/<r>/commits/<sha>/status`. If `specforge/gate` is `pending`, your approval is not on the **current head commit** (a push since). Approve again. If the status is missing, the gate did not run: see the next two rows. |
| The gate run shows `startup_failure` | The caller workflow grants less than the reusable workflow requests. Update `.github/workflows/specforge-gate.yml` from `templates/gate-caller.yml`. Open PRs read the caller file from their own branch, so update the branch from the default branch too. |
| `specforge/gate` never appears | The caller workflow is not on the default branch yet, or the repo's Actions are disabled. |
| Auto-merge refused with an "upgrade" message | The repo is private on a free plan. See below. |
| `gh pr merge` says the requirements are not met | Working as intended: the gate is red or pending and protection is enforcing it. Fix the cause. |
| A `build/` PR sits `pending` | Read the gate status description. `spec ... is implementing, not done yet`: the build is still running. `AC evidence: ...`: the evidence is missing, a criterion failed or its `verify` text differs, or files changed after verification; the agent must re-verify. |
| The gate fails with `depends_on ... is not done` or `... does not exist` | A prerequisite spec is not `done`, or a rename or deletion left a dangling reference. Finish the prerequisite, or update every spec that points at the old id in the same PR. |
| A worker stops and asks to read a file | The repo's `.claude/settings.local.json` is missing the plugin directory. Run `/specforge:init` on this machine. |
| An idea or refine session reports success but nothing happens | The agent's prompt was not delivered. Check the worktree's terminal in Orca; a started agent with an empty prompt sits idle. Relaunch the flow. |
| `git fetch` fails inside a flow | The flow stops on purpose rather than using a stale base. Fix credentials (`gh auth status`) and retry. |
| Token minting fails | Check `~/.config/specforge/app.json`, that the keychain item exists (`security find-generic-password -s specforge-app-key`), and that the App is installed on the repo. |
| The sweep lists a worktree as stuck | The reason is printed. PR still open: wait or close it. Uncommitted changes or unpushed commits: finish them or discard deliberately. |
| An agent was refused by the App | Do not work around it with your own credentials. Decide whether the App should hold that permission. |

## Private repos on free plans

Specforge leans on GitHub features that free private repos lack: branch protection and required status checks, auto-merge, stale-approval dismissal, and CODEOWNERS review requests. On such a repo the gate still reports, but nothing makes GitHub enforce it.

| Missing | Effect | Workaround |
|---|---|---|
| Branch protection, required checks | The gate is advisory; an agent could merge past it | Have agents merge only through a script that re-checks the gate and refuses on red |
| Auto-merge | Nothing merges a PR once checks pass | A workflow that merges on your approving review when the gate is green, or an agent that waits and merges |
| Dismissing stale approvals | A push after your approval still shows "approved" (the gate ignores it anyway, because it needs approval on the head commit) | A workflow that dismisses approvals on older commits and re-requests you |
| CODEOWNERS review requests | You are not added as reviewer | A script that requests reviewers through the API |

Working versions of all four were built for this plugin and live at tag [`v0.5.0`](https://github.com/zalmb8/specforge/tree/v0.5.0): `src/merge-pr.mjs`, `.github/workflows/merge-on-approval.yml`, `.github/workflows/dismiss-stale.yml` and `src/request-review.mjs`. They are not maintained here and predate the commit-status gate, so they need adapting. They also need permissions your caller must grant (`contents` and `pull-requests` write, `checks: read`), and GitHub refuses to start a reusable workflow that asks for more than its caller grants.

## Development

The repo is its own marketplace. `dist/` is committed (esbuild bundles) so consumers need no install step; run `npm run build` after changing `src/`, and `npm test`, which also runs the real bundles. Agents working in the repo should read [`CLAUDE.md`](CLAUDE.md); the reasoning behind the design is in [`docs/design.md`](docs/design.md).

Specforge runs its own gate, pinned to the last released `@v0` and not the working tree. `build/` PRs that touch the plugin's rails (`src/`, `dist/`, `skills/`, `agents/`, `lenses/`, `templates/`, manifests, `CLAUDE.md`, `package*.json`, `test/`) wait for a human approval; docs-only PRs do not. Releases stay manual.

```
.claude-plugin/   plugin and marketplace manifests
skills/           idea, refine, build, init, sweep
agents/           spec-reviewer, code-reviewer, ac-verifier
lenses/           spec/ and code/, one review lens per file
src/ dist/        validator, gate, sweep, token minting
.github/workflows reusable gate workflow, CI
templates/        spec, config, gate caller
```

Releases are manual semver tags; `v0` is the floating tag repos pin to.
 
