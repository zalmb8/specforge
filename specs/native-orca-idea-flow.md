---
specforge: 1
id: native-orca-idea-flow
title: Rebuild the idea flow on native Orca features
status: draft
depends_on: []        # ids of specs that must be done before this one can be built
acceptance:
  - id: AC-1
    text: "The kickoff step of `skills/idea/SKILL.md` contains one `orca worktree create` command that includes each of `--no-parent`, `--branch idea/<slug>`, `--base-branch origin/main`, `--agent claude`, `--surface terminal`, `--prompt` and `--json`."
    verify: TBD   # text-presence check on skill prose (no behavioral test exists); a new test extracts the command block and asserts each flag
  - id: AC-2
    text: "`skills/idea/SKILL.md` contains no `orca agent launch` command; the only retry it describes is `--retry-launch <operationId>`."
    verify: TBD   # text-presence: grep -c 'orca agent launch' skills/idea/SKILL.md prints 0
  - id: AC-3
    text: "`skills/idea/SKILL.md` does not mention `.specforge/brief.md`. The `.gitignore` line and `init` handling for `.specforge/brief.md` stay, because `refine` and `build` still use it."
    verify: TBD   # grep -c '.specforge/brief.md' skills/idea/SKILL.md prints 0; grep of skills/init/SKILL.md still finds it
  - id: AC-4
    text: "`skills/idea/SKILL.md` requires `launch.prompt.outcome` to be `journaled` or `handed-to-terminal`."
    verify: TBD
  - id: AC-5
    text: "`skills/idea/SKILL.md` tells the skill to stop, without falling back to a cached `origin/main`, when the app-token fetch fails."
    verify: TBD
  - id: AC-6
    text: "`skills/idea/SKILL.md` checks slug availability both on `origin/main` and via `branch:idea/<slug>` in Orca before creating the worktree."
    verify: TBD
  - id: AC-7
    text: "`skills/idea/SKILL.md` contains `<spec_dir>/<slug>.md` and does not contain the literal `specs/<slug>.md`."
    verify: TBD   # grep -c 'specs/<slug>.md' prints 0 and grep -c '<spec_dir>/<slug>.md' prints at least 1
  - id: AC-8
    text: "The idea worker brief in `skills/idea/SKILL.md` sets workspace status `in-progress` at the start and, after the PR is opened, runs `orca worktree set --worktree active --pr <n> --workspace-status in-review --comment <PR url>`."
    verify: TBD
  - id: AC-9
    text: "The idea worker brief tells a stuck worker to run `orca worktree set --worktree active --unread` with a `--comment` giving the reason, then stop."
    verify: TBD
  - id: AC-10
    text: "The idea worker brief spawns exactly two `spec-reviewer` subagents (testability, scope-risk) and contains no instruction to use an Orca worker as reviewer."
    verify: TBD
  - id: AC-11
    text: "The idea worker brief no longer runs `gh pr checks --watch`; it enables `gh pr merge --squash --auto` and then sets the card and stops."
    verify: TBD
  - id: AC-12
    text: "The implementing PR leaves `src/sweep.mjs` and `dist/sweep.mjs` unchanged."
    verify: TBD   # git diff --exit-code origin/main -- src/sweep.mjs dist/sweep.mjs exits 0
  - id: AC-13
    text: "`skills/idea/SKILL.md` still runs `node PLUGIN/dist/sweep.mjs --apply` before kickoff, and states that no bot or automation is required."
    verify: TBD
  - id: AC-14
    text: "No added line in the implementing PR's diff mentions the Workflows or Administration permission being requested, or tells a bot run to push, open a PR or use the user's credentials."
    verify: TBD   # grep of added diff lines for Workflows|Administration; the bot-run part is reviewer judgment and is stated as such
  - id: AC-15
    text: "A worker created by the new flow in `zalmb8/specforge-sandbox` is on branch `idea/<slug>` exactly, and after its PR merges `sweep.mjs --apply` removes its worktree."
    verify: TBD   # manual end-to-end check in the sandbox; cannot be scripted until the --branch open question is answered
  - id: AC-16
    text: "The documentation states the minimum Orca version the flow needs, in `README.md`, once the minimum-version open question is answered."
    verify: TBD   # blocked on that open question; grep README.md for the stated version
---
## Summary

Rebuild the `idea` flow on native Orca features so a human's idea becomes a draft spec at `<spec_dir>/<slug>.md`, reviewed by independent reviewers, validated, and merged by GitHub as a draft. The flow should be a first-class Orca experience (a visible card per idea, a Claude terminal, status and PR shown on the card) and stay portable to other repos and machines because it needs only the `orca` CLI (written against Orca CLI 1.4.265).

This supersedes the draft `orca-sweep-automation`, which is being retired in PR #46 and is deliberately not a dependency. How and when the sweep runs is covered here as one part of the design.

## Context

Today the `idea` skill creates a worktree with no agent, writes `.specforge/brief.md` into it, then launches the agent with `orca agent launch` and a short prompt pointing at the brief. That sequence needs a gitignored brief file and a separate launch, and it has a race between the file write and the launch. The skill also hardcodes `specs/<slug>.md`, while the other skills use `<spec_dir>` from `.specforge/config.yml`.

Facts verified on Orca 1.4.265:

- `orca worktree create` accepts `--branch`, `--pr`, `--comment`, `--reference`, and `orca worktree set` accepts `--pr`, `--workspace-status`, `--comment`, `--unread`.
- `orca automations trigger-options --source github` lists `pr_opened`, `pr_pushed`, `pr_merged`, `ci_failed`, `ci_passed`, `pr_closed` and more. Filters are `in`, `subject`, `contains`, `from`, `label`; there is no branch-prefix filter.
- Only bot automations accept `--on`; plain automations take `--trigger` schedules only.
- `orca bot create --offer` posts a card the owner must accept in the app, so `init` cannot script it and every machine sets it up by hand.
- Events need the Orca GitHub app installed on the repo, which is a second app besides specforge's.
- A bot's GitHub connector acts as the owner, not as the specforge app. That conflicts with the rule never to fall back to the user's credentials, so a bot run may only notify and run the local sweep with a `GH_TOKEN` minted from the app, and must never push or open PRs.

A PR merges long after the worker has stopped, so a callback at worker finish cannot clean up. Cleanup has to be driven by something that runs later.

## Open questions

- [ ] What is the maximum length of `--prompt`, and is it safe to pass a long multi-line brief with quotes, backticks and `$` through `"$(cat file)"`?
- [ ] Does `--branch idea/<slug>` keep the slash literally in the branch name, or does Orca rewrite it?
- [ ] Does a bot automation's `contains=` filter match a PR title such as the `idea:` prefix? If not, what text does it match?
- [ ] Can a bot run be given an app-minted `GH_TOKEN`, and how?
- [ ] Is the bot documented manual setup only? (`init` cannot script it, see Out of scope.)
- [ ] What is the minimum Orca version, and how should the skill behave on an older one?
- [ ] Should a stale terminal session be closed along with the worktree when the sweep removes it?
- [ ] What happens when a bot-triggered sweep and a lazy sweep overlap?
- [ ] How is a worker failure that never opens a PR surfaced, beyond the worker setting `--unread`?

## Design

This is a starting point; the open questions above are not decided here.

**Kickoff.** The `idea` skill:

1. Runs `sweep.mjs --apply` (lazy cleanup).
2. Fetches `origin/main` with the app token and stops on failure; it never falls back to a cached ref.
3. Checks the slug is free on `origin/main` (`<spec_dir>/<slug>.md`) and via `branch:idea/<slug>` in Orca.
4. Writes the brief to a scratch file in the session scratchpad (outside the repo; the skill deletes it after the call) and makes one call:
   `orca worktree create --name idea-<slug> --no-parent --branch idea/<slug> --base-branch origin/main --agent claude --surface terminal --prompt "$(cat <scratch file>)" --comment "drafting" --json`.
   `--surface terminal` guarantees a Claude terminal rather than a chat.
5. Requires `launch.prompt.outcome` to be `journaled` or `handed-to-terminal`, and retries only with `--retry-launch <operationId>`.

Passing the brief in `--prompt` removes `.specforge/brief.md` and the create, write-file, launch sequence with its race from the `idea` flow only. The gitignore line and `init` handling stay, because `refine` and `build` still write `.specforge/brief.md`. CLAUDE.md currently says briefs never go in a scratch path; that rule was written for workers that read a file, and CLAUDE.md and `docs/design.md` are updated by the implementing PR to say the `idea` flow passes its brief in `--prompt` (a human step, since CLAUDE.md is a protected path). After create, the skill checks that the worktree's branch equals `idea/<slug>`, because the gate keys on that prefix.

**Worker.** In its own Orca worktree, shown as a card in the sidebar. It sets the workspace status to `in-progress`, drafts the spec from the template, runs two review passes as independent Claude `spec-reviewer` subagents (one lens each: testability, scope-risk), runs `validate-cli.mjs`, pushes as the GitHub App, opens the PR, enables `gh pr merge --squash --auto`, then (replacing the old `gh pr checks --watch` and retry step, which hangs on the gate's pending status) runs `orca worktree set --worktree active --pr <n> --workspace-status in-review --comment "<PR url>"` and stops. A stuck worker sets `--unread` plus a comment. Reviewers stay subagents for ideas because they are one-shot and unattended; Orca worker reviewers would need end-turn-and-wake, where a missed wake looks like success. Orca workers, and a different agent such as Codex as reviewer, are better kept for `build` and `ac-verifier`.

**Lint** has two layers: `validate-cli.mjs` locally, then the `specforge/gate` commit status in CI (an `idea/` PR may touch only `<spec_dir>/**`, drafts only).

**Consistency fix.** Replace the hardcoded `specs/<slug>.md` in the skill and brief with `<spec_dir>/<slug>.md`, with `spec_dir` read from `.specforge/config.yml`.

**Completion and cleanup.**

- Portable fallback: the lazy `sweep.mjs --apply` at the start of every flow, optionally also run by a scheduled non-bot Orca automation. This works on any machine with only the `orca` CLI.
- Optional upgrade: a per-machine Orca bot with a `github.pr_merged` automation (`orca automations create --bot <name> --on "github.pr_merged ..."`) that runs the sweep, marks the card completed and notifies the user. `github.ci_failed` can notify about a stuck idea PR.
- A bot run may only notify and run the local sweep with `GH_TOKEN` minted from the app. It must never push or open PRs, and never uses the user's credentials.

**Deliverables.** The `idea` skill and its brief, README, CLAUDE.md and `docs/design.md`. The bot, the scheduled automation and the `ci_failed` notification are documentation only (optional setup), not shipped code.

**Risks and safeguards.** Adopters pin `v0`, so the change reaches them on release; an Orca without `--surface`, `--prompt` on create or `--retry-launch` would fail at kickoff, so the skill must fail with a clear message (behavior pinned once the minimum version is known). Rollback is a revert PR plus a release, which is a human step. Existing worktrees created by the old flow keep working because the sweep is unchanged. Terminal sessions are not removed by the sweep, so they can accumulate; accepted for now, see the open question. This spec has no dependency on PR #46 or on `orca-sweep-automation`.

## Out of scope

- Changing the sweep's removal rules.
- Giving the GitHub App Workflows or Administration permission.
- Using the user's own credentials for any step, including bot runs.
- Moving `refine`, `build` or `ac-verifier` to Orca workers; only `idea` changes here.
- Scripting bot creation in `init`, which is blocked by the owner-accept card (see Open questions).
- Changing `refine`, `build` or `init`'s `.specforge/brief.md` handling.
- Releasing, tagging or moving `v0`, which are human steps.
