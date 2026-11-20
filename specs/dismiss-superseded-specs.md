---
specforge: 1
id: dismiss-superseded-specs
title: Dismiss or supersede a spec without deleting it
status: draft
depends_on: []        # ids of specs that must be done before this one can be built
acceptance:
  - id: AC-1
    text: "The validator accepts a spec whose status is `dismissed` or `superseded` and whose `## Disposition` section is valid. Validation failure means an error is returned and the validate CLI exits non-zero."
    verify: TBD
  - id: AC-2
    text: "The validator, comparing a spec against its version on the base ref, accepts a status change from `draft` or `approved` to `dismissed` or `superseded`."
    verify: TBD
  - id: AC-3
    text: "The validator rejects a status change from `implementing` to `dismissed` or `superseded`."
    verify: TBD
  - id: AC-4
    text: "The validator rejects a status change from `done` to `dismissed` or `superseded`."
    verify: TBD
  - id: AC-5
    text: "The validator rejects any status change away from `dismissed` or `superseded` (to `draft`, `refining`, `approved`, `implementing` or `done`)."
    verify: TBD
  - id: AC-6
    text: "The validator rejects a `dismissed` or `superseded` spec that has no `## Disposition` section."
    verify: TBD
  - id: AC-7
    text: "The validator rejects a `dismissed` or `superseded` spec whose `## Disposition` section contains only whitespace."
    verify: TBD
  - id: AC-8
    text: "The validator rejects a `superseded` spec whose `## Disposition` section does not contain a backticked id of an existing spec in `<spec_dir>` or `<spec_dir>/archive/`, and rejects one that names itself."
    verify: TBD
  - id: AC-9
    text: "The gate rejects a PR from an `idea/` branch that changes a spec's status to `dismissed` or `superseded`."
    verify: TBD
  - id: AC-10
    text: "The gate rejects a PR from a `build/` branch that changes a spec's status to `dismissed` or `superseded`."
    verify: TBD
  - id: AC-11
    text: "For a PR from a `spec/` branch that dismisses a spec, the gate decision requires human approval from someone who is not the author, and the exact-move auto-approval is not applied."
    verify: TBD
  - id: AC-12
    text: "The dependency-tree check, at validate time, reports an error when a spec's `depends_on` names a `dismissed` or `superseded` spec."
    verify: TBD
  - id: AC-13
    text: "Existing gate behavior is unchanged: an `idea/` PR that deletes a spec is still rejected, a `build/` PR that deletes a spec is still rejected, and a `spec/` PR that deletes a `draft` or `approved` spec is still allowed (the existing gate tests for these cases still pass)."
    verify: TBD
  - id: AC-14
    text: "`skills/dismiss/SKILL.md` exists and contains one `orca worktree create` command with `--branch spec/<id>`, `--agent claude`, `--surface terminal` and `--prompt`. Its worker behavior (open the `spec/` PR, enable auto-merge as the GitHub App, stop) is verified by a manual run in `zalmb8/specforge-sandbox`, not by a test."
    verify: TBD
  - id: AC-15
    text: "The validator rejects a status change from `refining` to `dismissed` or `superseded`."
    verify: TBD
  - id: AC-16
    text: "The validator rejects a spec file that is new on the PR (absent on the base ref) and has status `dismissed` or `superseded`."
    verify: TBD
---

## Summary

Let a `draft` or `approved` spec be closed out as `dismissed` (won't do) or `superseded` (replaced by another spec) instead of being deleted. The spec file stays, so history is kept, the reasoning is recorded, and the decision is explicit. Prose references to the spec no longer dangle.

## Context

Retiring the draft spec `orca-sweep-automation`, which another idea superseded, was not possible from an `idea/` branch: the gate rejects it ("idea/ branches may not delete specs", `src/gate.mjs`). Deletion works today only from a `spec/` branch, which needs human approval, and only for `draft` or `approved` specs. It also discards the reasoning.

Current facts, to be re-verified by whoever refines this spec:

- Statuses are `draft, refining, approved, implementing, done` (`STATUSES` and the legal-transition table in `src/spec.mjs`).
- Frontmatter allows no fields beyond the documented schema, except the optional `depends_on`.
- `src/gate.mjs`: a spec that is not `draft` or `approved` cannot be deleted or renamed; `idea/` and `build/` branches may not delete specs; `spec/` PRs always need a human approval from someone who is not the author.
- `src/spec-tree.mjs` checks the dependency tree: every id exists, no cycles, and a build requires every `depends_on` spec to be `done`.
- `src/archive.mjs` and `src/archive-plan.mjs` move `done` specs and their evidence to `<spec_dir>/archive/`, and the gate auto-approves an exact move.
- `src/sweep.mjs` removes worktrees for finished `idea/`, `spec/` and `build/` branches.
- The rails (`src`, `dist`, `skills`, `agents`, `lenses`, `templates`, tests) are protected paths, so building this spec needs the human.

## Open questions

- [ ] Are `dismissed` and `superseded` two statuses, or one status with a reason?
- [ ] Does the successor id belong in a validated field or in the `## Disposition` prose? A new frontmatter field breaks the "no extra fields" rule.
- [ ] Can a dismissed or superseded spec ever be restored, and how? Archive restore is a human `spec/` PR today.
- [ ] Can an `approved` spec with an open `build/` branch or worktree be dismissed?
- [ ] Are dismissed specs archived automatically, or only by the opt-in `archive` setting?
- [ ] How do the README status line and `docs/design.md` change?
- [ ] What is the minimum plugin version, and how does `init --upgrade` migrate the validator in adopting repos?
- [ ] How does `dismiss` behave when other specs depend on the target? The repo-wide tree check could turn main red if a dismissal merges while dependents exist; should the validator or the skill reject such a PR, or should dependents be edited in the same PR?
- [ ] How is the successor id extracted from `## Disposition` prose (a `Superseded by:` line, any backticked id), and is it checked only at dismissal time if the successor is later dismissed?
- [ ] What does `dismiss` do when a `build/<id>` branch or PR exists for the target (refuse?), and does sweep need any change or only the existing branch/PR rules?
- [ ] What is the recovery path for a mistaken dismissal, given the validator forbids leaving a terminal status (admin bypass, or a human-approved restore)?
- [ ] Does any gate change need a new permission? The reusable gate must not ask for permissions callers do not grant.
- [ ] How does the release ordering protect adopters still pinned to an older `v0`, whose validator rejects unknown statuses?

## Design

Starting point, not settled; the open questions above may change it.

- Add two terminal statuses, `dismissed` and `superseded`. No new frontmatter fields. The reason goes in a required `## Disposition` section; for `superseded` it names the successor spec id, which the validator checks exists.
- Only `draft` and `approved` specs may move to them; `implementing` and `done` specs may not, mirroring the existing delete/rename rule. They are terminal; leaving them needs a restore.
- A dismissal is a one-file edit (status plus the Disposition section) on a `spec/` branch, so it needs the human approval the gate already demands there. An `idea/` or `build/` branch must not be able to dismiss.
- Dependency tree: a spec whose `depends_on` names a dismissed or superseded spec fails the tree check until the dependent is edited, the same way an unfinished dependency blocks a build.
- Archive: dismissed and superseded specs become archivable by `archive.mjs` into `<spec_dir>/archive/`, keeping history; the gate's exact-move auto-approval must cover them.
- Sweep: worktrees for a dismissed spec's branches are handled as finished work.
- New skill `/specforge:dismiss <id> [--superseded-by <id>] "<reason>"` opens the `spec/` PR with auto-merge as the GitHub App and stops. It launches its worker the native Orca way: one `orca worktree create --branch spec/<id> --agent claude --surface terminal --prompt ...`, as the idea skill does.
- Existing rules are not weakened: `idea/` and `build/` still cannot delete specs, and a `spec/` delete of a `draft` or `approved` spec stays allowed. The app never gets Workflows or Administration permission and agents never use the user's own credentials.
- In scope when built: README and `docs/design.md` updates, tests, and rebuilding the committed `dist/`.
- Archive, sweep and rollout behavior have no acceptance criteria yet: they depend on the open questions and get criteria when those are resolved.
- Rollout: the validator is the contract adopting repos run via the pinned release, so new statuses must not be introduced to a repo before its pinned plugin version understands them.

## Out of scope

- Archive and sweep changes, unless the open questions above resolve them into criteria.

- Restoring a dismissed or superseded spec.
- Changing how `done` specs are archived.
- Dismissing `implementing` or `done` specs.
- Deleting specs from `idea/` or `build/` branches.
- Migrating existing deleted or draft specs (including `orca-sweep-automation`) to the new statuses.
