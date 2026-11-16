---
specforge: 1
id: archive-done-specs
title: Archive location for done specs
status: draft
depends_on: []        # ids of specs that must be done before this one can be built
acceptance:
  - id: AC-1
    text: "validateTree returns no errors for a tree in which an active spec's depends_on names a done spec that lives in the archive location."
    verify: TBD
  - id: AC-2
    text: "The build flow's dependency check treats a depends_on that names an archived done spec as satisfied, and still reports a dependency that is missing or not done."
    verify: TBD
  - id: AC-3
    text: 'A spec file in the archive whose file name does not equal its id fails the gate with the error "file name must match id".'
    verify: TBD
  - id: AC-4
    text: For a build PR whose spec is archived, the gate reads the evidence from the path the design defines, and reports pending when that file is missing or has a failing result.
    verify: TBD
  - id: AC-5
    text: A tree that contains a referrer spec and its depends_on target moved into the archive validates with the referrer file unchanged.
    verify: TBD
  - id: AC-6
    text: The gate fails a PR that places a spec whose status is not done in the archive, with an error naming the spec.
    verify: TBD
  - id: AC-7
    text: A PR whose only spec change moves a done spec (and its evidence) into the archive with unchanged content gets a non-failure gate status, with the approval path the design chooses.
    verify: TBD
  - id: AC-8
    text: A PR that deletes a done spec without a matching addition in the archive still fails the gate.
    verify: TBD
  - id: AC-9
    text: With no archive directory present, the gate and validator results for existing fixtures are unchanged.
    verify: TBD
  - id: AC-10
    text: "The gate's listing of specs at the base and head refs includes archived specs, so validateTree sees them."
    verify: TBD
  - id: AC-11
    text: The sweep behaves correctly for a merged archive PR (the design says what correct means).
    verify: TBD
---

## Summary

Give done specs a place to live outside the active `specs/` directory, so the active list stays short as implemented specs accumulate. A done spec and its AC evidence (`specs/evidence/<id>.json`) should be able to move there without breaking dependency resolution, validation, the gate, the build flow or the sweep.

## Context

Today every spec is `<spec_dir>/<id>.md` and every evidence file is `<spec_dir>/evidence/<id>.json`. Nothing ever leaves: done specs stay beside drafts and approved specs.

What the code assumes, and an archive must not break:

- `src/gate.mjs`: `inSpecDir` treats any `.md` path under `<spec_dir>/` as a spec, including nested paths, and the file-name-equals-id check uses only the last path segment. `evidencePath(specDir, id)` is hardcoded to `<spec_dir>/evidence/<id>.json`.
- `src/gate.mjs`: a spec file deletion (which is how a move looks in the diff) fails the gate unless the base status was `draft` or `approved`, so `implementing` and `done` specs cannot be moved at all today. `idea/` and `build/` branches may never delete specs.
- `src/gate.mjs`: `idea/` branches may only touch `<spec_dir>/**` and only draft specs; `spec/` branches may only touch `<spec_dir>/**` and always need a human; `build/` may only touch specs that are approved or implementing.
- `src/spec.mjs`: `validateTree` checks every `depends_on` id exists and that there are no cycles, over whatever list of specs it is given (the whole tree at the PR head). `done` has no legal outgoing status transition.
- The build flow checks that dependencies are `done` against the base branch's specs, so it needs to see archived specs as well.
- `docs/design.md` and `CLAUDE.md` state that `implementing` and `done` specs keep their names.

`specs/gate-probe-1.md` is a leftover test probe, not a real spec, and is ignored here.

## Open questions

- [ ] Where does the archive live: a fixed subdirectory such as `specs/archive/`, or a configurable location via a config key such as `archive_dir` in `.specforge/config.yml`?
- [ ] Is archiving manual, a final step of the build flow, or automatic when a spec becomes `done`? Is it opt-in per repo?
- [ ] Does the evidence file move with the spec? If so, to where (for example `<archive>/evidence/<id>.json`), and does the gate still require it at the old path for a build PR?
- [ ] How do `depends_on` resolution, the validator and the gate find an archived spec: do they scan both locations, or is there an index?
- [ ] Which branch prefix does an archive move use, and does it need a human approval? The existing prefixes do not fit: `idea/` is draft-only and cannot delete, `build/` cannot delete, and `spec/` always needs a human. Is a new prefix (or a new gate rule) wanted?
- [ ] Do the "file name equals id" rule and the "done specs keep their names" rule still hold in the archive? Does a move count as a rename or delete that the gate rejects today?
- [ ] How are existing done specs migrated, in one bulk PR or gradually, and is the migration reversible?
- [ ] Should anything touching the archive count as a protected path, or can archived specs be edited at all? (A done spec has no legal status transition today.)
- [ ] How does the sweep (`src/sweep.mjs`) and the build flow's evidence lookup treat archived specs?

## Design

To be decided. The open questions on location, branch prefix and approval, and evidence must all be resolved before this spec is approved: they change the gate's human-approval model, not just a path. Constraints any design must meet:

- Whether the archive sits inside `spec_dir` (where `inSpecDir` already treats nested `.md` files as specs, so `spec/` and `idea/` PRs could edit them) or beside it (where the `<spec_dir>/**` path restrictions would block moves) has a different blast radius; tests must cover the chosen layout.
- Whether archived files are immutable (no edits to a done spec's body or acceptance after archiving) is decided here, since an edit could silently invalidate its evidence.
- Rollback: git history, plus a revert PR that restores the files, which the gate must allow.
- Release impact: adopters pin `v0`, so a gate change reaches all of them at once; an archive-unaware repo keeps today's behavior.

- No existing `depends_on` reference needs editing because a spec moved: the id is stable, only the location changes.
- The dependency tree check runs over active and archived specs together, so a missing id or a cycle is still caught.
- The change to the gate, the validator and the evidence path lookup stays in one place per concern (no second hardcoded path).
- A repo that never archives anything behaves exactly as today.

## Out of scope

- Migrating existing done specs, unless the design decides to include it (see open questions).
- Un-archiving a spec or changing a done spec's status.
- Archiving specs that are not `done`.
- Deleting specs or evidence permanently.
