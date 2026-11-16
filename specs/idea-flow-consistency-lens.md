---
specforge: 1
id: idea-flow-consistency-lens
title: Run the consistency lens in the idea flow
status: draft
depends_on: []        # ids of specs that must be done before this one can be built
acceptance:
  - id: AC-1
    text: "The review step of the idea worker brief in `skills/idea/SKILL.md` names `PLUGIN/lenses/spec/consistency.md` as the source of a third lens text."
    verify: TBD   # grep scoped to the Brief template section of skills/idea/SKILL.md; grep-based because there is no behavioral test for skill prose
  - id: AC-2
    text: "The review step of the idea brief spawns exactly three `spec-reviewer` agents (testability, scope-risk, consistency) in parallel."
    verify: TBD
  - id: AC-3
    text: "`skills/idea/SKILL.md` no longer contains the phrase `do not name other lenses`, and its review step still contains `One round only`."
    verify: TBD
  - id: AC-4
    text: "Step 1 of the idea brief (amending its existing `depends_on` sentence) says to set `depends_on` only for ids that exist on origin/main, drafts included."
    verify: TBD
  - id: AC-5
    text: "Step 1 of the idea brief says a prerequisite that is not on origin/main (for example only on an open PR) is recorded in the spec text as an Open question and not placed in `depends_on`."
    verify: TBD
  - id: AC-6
    text: "`docs/design.md` states next to its Lenses bullet that the idea flow runs the testability, scope-risk and consistency lenses while refine runs all built-in lenses."
    verify: TBD
  - id: AC-7
    text: "`git diff --name-only origin/main...HEAD` on the build PR lists only paths under `skills/`, `docs/`, `test/`, `specs/idea-flow-consistency-lens.md` and `specs/evidence/idea-flow-consistency-lens.json`."
    verify: TBD
---

## Summary

Run the `consistency` spec lens in the idea flow's single review round, so a prerequisite that an idea spec names in prose is not lost because `depends_on` was left empty.

## Context

- Observed problem: the idea spec `orca-sweep-automation` named a prerequisite spec (`archive-done-specs`) in prose but left `depends_on` empty, and nothing flagged it.
- Cause: the idea worker brief in `skills/idea/SKILL.md` (Brief template, step 2) spawns two `spec-reviewer` agents, with the `testability` and `scope-risk` lenses only, and says "do not name other lenses". The `consistency` lens (`lenses/spec/consistency.md`) is the one that checks that `depends_on` lists every spec the prose says this one builds on. Refine already runs all lenses.
- Decided scope: add `consistency` to the idea flow's single review round. At idea time it is enough to document an identified dependency: set `depends_on` when the id exists on origin/main (a draft counts; the validator only needs the id to exist), otherwise record it explicitly in the spec text, for example as an Open question. Finalizing and verifying `depends_on` stays in refine step 2b, before the spec moves to approved.
- `skills/` and `test/` are protected paths, so the build PR needs a human approval.

## Open questions

- [ ] What exact wording should the idea brief give the worker for AC-4 and AC-5? The rule is decided (see Design); only the literal phrases are open, to be fixed in the ACs before approval.
- [ ] Should refine's step 2b be reworded to say it verifies dependencies noted at idea time (including any recorded in Open questions), or is the current wording ("ask when the prose names a prerequisite") enough? If reworded, an AC is added; if not, refine 2b moves to Out of scope.
- [ ] Should the idea worker list existing specs (`ls specs/`) to find candidate dependencies before drafting, or is the consistency reviewer, which reads the spec directory, sufficient? If yes, an AC is added; if no, it moves to Out of scope.
- [ ] How is a skill-text change tested? The proposal is a grep-based verify against `skills/idea/SKILL.md` (and `docs/design.md`), stated explicitly as such, because there is no behavioral test for skill prose. Is that acceptable, or should `test/` gain a check that the idea brief names every built-in spec lens? If a test is added, each AC's verify names it; if not, `test/` is dropped from AC-7.

## Design

Decided rule (amends the existing `depends_on` sentence in step 1 of the brief, which already says to list the id of an existing spec; it adds no second rule): at idea time a dependency is documented, not finalized. "Existing" means the id is on origin/main, a draft counting. Such an id goes in `depends_on`. A prerequisite not on origin/main, such as one on an open PR, is recorded in the spec text as an Open question and kept out of `depends_on`, because the validator would reject an unknown id and fail the idea PR. Refine step 2b finalizes and verifies `depends_on`.

Changes: the Brief template's review step in `skills/idea/SKILL.md` (a third parallel reviewer on `consistency`, "one round only" kept, "do not name other lenses" removed) and step 1's dependency sentence; `docs/design.md` gains a new statement beside the Lenses bullet, which today implies all lenses always run, qualifying it for the idea flow. The README is intentionally untouched. Refine step 2b, an `ls specs/` step and a `test/` check depend on the open questions. The review stays a single round, so a consistency finding is fixed by the worker without a second check. No new validator or gate checks.

## Out of scope

- New validator or gate checks for `depends_on`.
- Forward references to specs that do not exist yet.
- Running any lens other than `consistency` in addition to the current two in the idea flow, or making the idea flow run all lenses.
- Changing refine's review loop or the lenses' own text.
- Changing the validator, gate, `src/` or `dist/`.
- The idea flow's hardcoded lens list ignores `review_lenses` and `exclude_lenses` from `.specforge/config.yml`; applying them to idea is not part of this change.
- Edits to `README.md`.
