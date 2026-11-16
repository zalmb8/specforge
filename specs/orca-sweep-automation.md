---
specforge: 1
id: orca-sweep-automation
title: Orca Automation for the sweep
status: draft
depends_on: []        # ids of specs that must be done before this one can be built
acceptance:
  - id: AC-1
    text: "The documentation names the exact `orca automations create` invocation for the sweep automation."
    verify: TBD
  - id: AC-2
    text: "The documentation states the automation's schedule and the workspace it runs in, and that workspace is not one of the user's main workspaces."
    verify: TBD
  - id: AC-3
    text: "`docs/design.md` and the README describe the automation consistently, so neither contradicts the other about how the sweep is scheduled."
    verify: TBD
  - id: AC-4
    text: "A run of the automation invokes `sweep.mjs --apply`, and a worktree of a finished idea/, spec/ or build/ branch is removed according to the existing removal rules."
    verify: TBD
  - id: AC-5
    text: "After a run, a stuck worktree is still present and its branch and reason appear in the failure surface the design names."
    verify: TBD
  - id: AC-6
    text: "A second run immediately after a first removes nothing and exits 0."
    verify: TBD
  - id: AC-7
    text: "When the app token cannot be minted, the run exits non-zero before any `gh` call is made."
    verify: TBD
  - id: AC-8
    text: "With the app token unavailable, no `gh` or git call in the run uses the user's own login."
    verify: TBD
  - id: AC-9
    text: "The removal rules in `src/sweep.mjs` (which worktrees are removed versus reported stuck) are unchanged; any change to that file is limited to what the design lists for token handling and exit codes."
    verify: TBD
---

## Summary

Formalize running the specforge cleanup on a schedule through an Orca Automation, so finished worktrees are reliably removed and stuck ones are surfaced, instead of relying only on the lazy `sweep.mjs --apply` that the idea, refine and build skills run as their first step.

## Context

- `src/sweep.mjs` removes Orca worktrees (and branches) for finished `idea/`, `spec/` and `build/` branches whose PR merged at exactly the checked-out commit (or a server-side descendant of it) with a clean tree. Others are reported as stuck. It is a dry run unless `--apply` is passed. There is no explicit "unpushed" check; local commits not in the merged PR are caught by the commit comparison.
- Facts about the current code that the design must account for: the sweep never mints or requires the app token and calls `gh` with whatever credentials `gh` finds, so an unattended run would silently use the user's own login unless the caller sets `GH_TOKEN`; it exits 0 even when every worktree is reported stuck (per-item errors, including `gh` auth failures, are folded into the stuck list); its only guard against touching a user's own workspace is `!isMainWorktree`; it does not check for a live agent session in a worktree; removal with `--delete-branch` is irreversible, and ignored files in the worktree go with it.
- `docs/design.md` already says the sweep is "run by every flow, optionally on an Orca automation", but nothing defines that automation, so cleanup today happens only when another flow starts.
- Orca ships an `orca automations` command group (`list`, `show`, `create`, `edit`, `remove`, `run`, `runs`). `create` takes a name, a trigger (`hourly`, `daily`, `weekdays`, `weekly`, a cron expression or an RRULE), a prompt, an agent provider, an optional `--precheck` command (a non-zero exit skips the run), and either an existing workspace or a new worktree per run. The CLI help does not say where definitions are stored or whether they can be committed to a repo.
- Open PR #30 (spec `archive-done-specs`) is not merged. It proposes adding an `archive/` prefix to the sweep's default prefixes and a separate opt-in `archive` command (`dist/archive.mjs`, dry run by default, `--apply` opens PRs, needs `GH_TOKEN`, the app token). This spec does not depend on it. Scheduling the archive command is a follow-up once PR #30 lands, because `archive --apply` opens PRs, which is outward-facing and needs its own duplicate-PR criterion.

## Open questions

- [ ] What can an Orca Automation run: only an agent prompt (`--prompt` with `--provider`), or also a plain shell command? A prompt-driven run starts an agent session that the sweep does not clean up. If it cannot run a plain command, is a launchd or cron job the fallback? Verify against the installed Orca docs and a real `orca automations create`, as the first step of the build.
- [ ] Is an automation definition stored only in this machine's Orca, or can it be committed in the repo? This decides whether the change is documentation only.
- [ ] What schedule: hourly, daily, weekdays? Should a `--precheck` skip runs when there is nothing to do?
- [ ] Where does it run: which workspace, or a new worktree per run? It must never be one of the user's main workspaces. How is "main workspace" defined: the Orca main worktree only, or any workspace the user opened by hand? Is the existing `isMainWorktree` guard enough, or does a user's own workspace on a merged `idea/` branch need a new guard (which would change the removal rules)?
- [ ] How is `orca worktree list` scoped when run from the chosen workspace: only specforge worktrees, or every repo Orca knows about on the machine?
- [ ] Who mints the app token for an unattended run, and where does the private key come from when no human is present? Where does minting happen: a wrapper or precheck, or inside `sweep.mjs`? A refused or missing token must stop the run, never fall back to the user's credentials.
- [ ] What exit-code contract tells an auth failure apart from legitimately stuck worktrees? This may require a change to `sweep.mjs`.
- [ ] How are stuck worktrees and failures surfaced to the user: Orca run history, a notification, a workspace comment, or something else?
- [ ] Does `init` set the automation up, or does it stay documented manual setup? An automation lives on one machine while `init` configures a repo.
- [ ] Should the automation also close stale Orca sessions? The sweep removes worktrees, not sessions. Conversely, should the sweep skip a worktree with a live agent session?
- [ ] Should the first scheduled runs be dry-run only before `--apply` is enabled, given that removal is irreversible?
- [ ] Idempotence and overlap: what happens if a scheduled run overlaps a lazy sweep from a flow, or two scheduled runs overlap?

## Design

To be settled by the open questions above. The intent is that the automation runs `sweep.mjs --apply` on a schedule with the same removal rules as today, with the app token supplied by the caller, and that the lazy sweep at the start of each flow stays as a fallback. The expected deliverable is documentation (README and `docs/design.md`) plus, if the open questions require it, a narrowly scoped change to `sweep.mjs` for token handling and exit codes. If the build finds Orca cannot run the sweep unattended, it stops and reports rather than choosing a fallback.

## Out of scope

- Changing the sweep's removal rules (which worktrees count as finished).
- The archive design itself, and scheduling the `archive` command, which waits for spec `archive-done-specs` to land.
- Closing Orca sessions, unless the open question is answered in favor of it.
- Changes to `init`, unless the open question is answered in favor of it.
- Multi-machine or multi-repo scheduling.
- Giving the app Workflows or Administration permission, or using the user's own credentials.
