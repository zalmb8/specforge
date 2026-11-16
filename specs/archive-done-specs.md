---
specforge: 1
id: archive-done-specs
title: Archive location for done specs
status: approved
depends_on: []        # ids of specs that must be done before this one can be built
acceptance:
  - id: AC-1
    text: "validateTree returns no errors for a tree in which an active spec's depends_on names a done spec that lives under <spec_dir>/archive/."
    verify: "node --test --test-reporter=spec --test-name-pattern='^archive: validateTree resolves a dependency on an archived spec$' test/archive.test.mjs 2>&1 | grep -q '^✔ archive: validateTree resolves a dependency on an archived spec ('"
  - id: AC-2
    text: "On a build/ PR, the gate treats a depends_on that names an archived done spec as satisfied, and still reports a dependency that is missing or not done."
    verify: "node --test --test-reporter=spec --test-name-pattern='^archive: build gate dependency check sees archived specs$' test/archive.test.mjs 2>&1 | grep -q '^✔ archive: build gate dependency check sees archived specs ('"
  - id: AC-3
    text: 'A spec file under <spec_dir>/archive/ whose file name does not equal its id fails the gate with the error "file name must match id".'
    verify: "node --test --test-reporter=spec --test-name-pattern='^archive: archived file name must match its id$' test/archive.test.mjs 2>&1 | grep -q '^✔ archive: archived file name must match its id ('"
  - id: AC-4
    text: "An archive/<id> PR fails the gate in each of these cases: the evidence file is not added at <spec_dir>/archive/evidence/<id>.json; its content differs from the base's <spec_dir>/evidence/<id>.json; the active evidence file is not deleted."
    verify: "node --test --test-reporter=spec --test-name-pattern='^archive: the evidence must move byte-identical with the spec$' test/archive.test.mjs 2>&1 | grep -q '^✔ archive: the evidence must move byte-identical with the spec ('"
  - id: AC-5
    text: "A PR that moves a depends_on target into the archive, leaving the referring spec's file unchanged, produces no tree errors."
    verify: "node --test --test-reporter=spec --test-name-pattern='^archive: a move leaves referrers valid and unchanged$' test/archive.test.mjs 2>&1 | grep -q '^✔ archive: a move leaves referrers valid and unchanged ('"
  - id: AC-6
    text: "The gate fails a PR that adds a spec whose status is not done under <spec_dir>/archive/, with an error naming the spec."
    verify: "node --test --test-reporter=spec --test-name-pattern='^archive: only done specs may be archived$' test/archive.test.mjs 2>&1 | grep -q '^✔ archive: only done specs may be archived ('"
  - id: AC-7
    text: "An archive/<id> PR that moves a done spec and its evidence, content unchanged, and touches nothing else, with no changed path matching protected_paths, gets no errors, no human requirement and no pending reason, so gateState is success."
    verify: "node --test --test-reporter=spec --test-name-pattern='^archive: a clean move passes with no human$' test/archive.test.mjs 2>&1 | grep -q '^✔ archive: a clean move passes with no human ('"
  - id: AC-8
    text: "A PR that deletes a done spec without an identical addition at its archive path still fails the gate, on each of archive/, idea/, spec/ and build/ branches."
    verify: "node --test --test-reporter=spec --test-name-pattern='^archive: deleting a done spec without moving it fails$' test/archive.test.mjs 2>&1 | grep -q '^✔ archive: deleting a done spec without moving it fails ('"
  - id: AC-9
    text: "With no <spec_dir>/archive/ files in the base or the head, evaluateGate returns the same errors, humanRequired and pending as before for a fixed list of scenarios that the test itself defines with expected values: an idea/ add, an idea/ edit of an approved spec, a spec/ edit, a build/ PR with an unbuilt dependency, a draft rename, and a done-spec delete."
    verify: "node --test --test-reporter=spec --test-name-pattern='^archive: no archive leaves existing gate results unchanged$' test/archive.test.mjs 2>&1 | grep -q '^✔ archive: no archive leaves existing gate results unchanged ('"
  - id: AC-10
    text: "specsAt from src/spec-tree.mjs, the function the gate CLI uses to list specs at a git ref, returns archived specs together with active ones, and skips the evidence JSON files."
    verify: "node --test --test-reporter=spec --test-name-pattern='^archive: specsAt lists archived specs in a real repo$' test/archive.test.mjs 2>&1 | grep -q '^✔ archive: specsAt lists archived specs in a real repo ('"
  - id: AC-11
    text: "planArchive returns one move per done spec that sits outside the archive. It returns no moves when archive is not true. It excludes a spec that is not done, a spec whose id has had an archive/<id> PR in any state, and a spec with no evidence file; the prior-PR and missing-evidence cases are each listed in `skipped` with a reason."
    verify: "node --test --test-reporter=spec --test-name-pattern='^archive: planArchive picks exactly the done unarchived specs$' test/archive.test.mjs 2>&1 | grep -q '^✔ archive: planArchive picks exactly the done unarchived specs ('"
  - id: AC-12
    text: "The sweep's default prefix list, exported as SWEEP_PREFIXES from src/prefixes.mjs, contains idea/, spec/, build/ and archive/."
    verify: "node --test --test-reporter=spec --test-name-pattern='^archive: the sweep prefix list includes archive$' test/archive.test.mjs 2>&1 | grep -q '^✔ archive: the sweep prefix list includes archive ('"
  - id: AC-13
    text: "Any modification of an existing file under <spec_dir>/archive/, spec or evidence, fails the gate on each of archive/, idea/, spec/ and build/ branches."
    verify: "node --test --test-reporter=spec --test-name-pattern='^archive: archived files are immutable$' test/archive.test.mjs 2>&1 | grep -q '^✔ archive: archived files are immutable ('"
  - id: AC-14
    text: "On a spec/ PR, deleting an archived spec and its evidence while adding them back byte-identical at the active paths yields no errors and a humanRequired entry; the same change on idea/, build/ and archive/ branches yields an error; and a restore that changes any content, or restores only one of the two files, yields an error."
    verify: "node --test --test-reporter=spec --test-name-pattern='^archive: restore needs a spec branch and a human$' test/archive.test.mjs 2>&1 | grep -q '^✔ archive: restore needs a spec branch and a human ('"
  - id: AC-15
    text: "An archive/<id> PR fails the gate if it changes any path other than the spec and evidence of <id>, or if the moved spec's id is not <id>; and it requires a human, like any other PR, if one of its changed paths matches protected_paths."
    verify: "node --test --test-reporter=spec --test-name-pattern='^archive: an archive PR moves exactly its own spec$' test/archive.test.mjs 2>&1 | grep -q '^✔ archive: an archive PR moves exactly its own spec ('"
  - id: AC-16
    text: "The build skill's step 4 (Check dependencies) and step 1 of its worker brief both name the archive path as well as the active path. This is a documentation presence check; the behavior itself is covered by AC-2."
    verify: "grep -E '^4\\. \\*\\*Check dependencies' skills/build/SKILL.md | grep -qF '<spec_dir>/archive/<id>.md' && grep -E '^> \\*\\*1\\. Read\\*\\*' skills/build/SKILL.md | grep -qF '<spec_dir>/archive/<id>.md'"
  - id: AC-17
    text: "src/sweep.mjs takes its default prefixes from SWEEP_PREFIXES (imports it and no longer lists the prefixes inline), so a merged archive/<id> worktree is removed like the other kinds."
    verify: "grep -qF 'SWEEP_PREFIXES' src/sweep.mjs && ! grep -qF \"'idea/', 'spec/', 'build/'\" src/sweep.mjs"
  - id: AC-18
    text: "Running the bundled dist/archive.mjs in a repo whose .specforge/config.yml does not set archive: true exits 0, prints a message that archiving is not enabled, and creates no branch or worktree."
    verify: "node --test --test-reporter=spec --test-name-pattern='^archive: the command does nothing unless archive is true$' test/archive.test.mjs 2>&1 | grep -q '^✔ archive: the command does nothing unless archive is true ('"
  - id: AC-19
    text: "validateTree reports an error naming the id when two specs in the list share an id, for example an active spec and an archived one."
    verify: "node --test --test-reporter=spec --test-name-pattern='^archive: validateTree rejects a duplicate id across active and archived$' test/archive.test.mjs 2>&1 | grep -q '^✔ archive: validateTree rejects a duplicate id across active and archived ('"
---

## Summary

Give done specs a place to live outside the active `specs/` directory, so the active list stays short as implemented specs accumulate. A done spec and its AC evidence move into `<spec_dir>/archive/`, in a PR that the gate auto-approves because it only relocates identical files, without breaking dependency resolution, validation, the gate, the build flow or the sweep. Archiving is opt-in per repo. A new `archive` command, run after builds merge (by hand or by any scheduler), opens one archive PR per done spec it finds on the default branch.

## Context

Today every spec is `<spec_dir>/<id>.md` and every evidence file is `<spec_dir>/evidence/<id>.json`. Nothing ever leaves: done specs stay beside drafts and approved specs.

What the code assumes, and an archive must not break:

- `src/gate.mjs`: `inSpecDir` treats any `.md` path under `<spec_dir>/` as a spec, including nested paths, and the file-name-equals-id check uses only the last path segment. Evidence is JSON, so `inSpecDir` never sees it. `evidencePath(specDir, id)` is hardcoded to `<spec_dir>/evidence/<id>.json`.
- `src/gate.mjs`: a spec file deletion (which is how a move looks in the diff, since the gate diffs with `--no-renames`) fails unless the base status was `draft` or `approved`, so `implementing` and `done` specs cannot be moved today. `idea/` and `build/` branches may never delete specs. Each `c` in `changes` carries `base`/`head` only for its own path, so a move shows as unrelated D and A entries.
- `src/gate.mjs`: `idea/` may only touch `<spec_dir>/**` and only draft specs; `spec/` may only touch `<spec_dir>/**` and always needs a human; `build/` may only touch specs that are approved or implementing, and checks `protectedPaths` only for `build/`.
- `src/gate-cli.mjs`: `specsAt(ref)` is a one-argument local function that closes over the module's `git`, `show` and `specDir`; it lists specs with `git ls-tree -r` under `<spec_dir>/`, so nested archive files are already listed. The file runs top-level side effects, so a test cannot import it.
- `src/spec.mjs`: `validateTree` checks every `depends_on` id exists and that there are no cycles, over whatever list of specs it is given. `validateSpec` with no `baseText` rejects any non-draft spec as new; with a `baseText`, staying in the same status is always legal, and `done` has no legal outgoing transition.
- `skills/build/SKILL.md` step 4 (and step 1 of the worker brief) read dependencies "on `origin/main`" and require them `done`.
- `src/sweep.mjs` is a script run by the idea, refine and build skills as a lazy first step (`sweep.mjs --apply`); it only removes worktrees, reads PRs and opens nothing. It must stay that way.
- `docs/design.md` and `CLAUDE.md` state that `implementing` and `done` specs keep their names.

`specs/gate-probe-1.md` is a leftover test probe, not a real spec, and is ignored here.

## Open questions

- [x] Where does the archive live? **Answer:** a fixed subdirectory `<spec_dir>/archive/`, inside `spec_dir`; no new location config key. Nested `.md` files there already count as specs for the gate and the listing.
- [x] Is archiving manual, a final step of the build flow, or automatic? Opt-in per repo? **Answer:** it follows the build flow: after a build PR merges and the spec is `done` on the default branch, the `archive` command opens the archive PR. It is a separate command from the sweep (the lazy sweep that every flow runs must stay cleanup-only), run by hand or by any scheduler. It is opt-in: the config key `archive: true` in `.specforge/config.yml`, default off.
- [x] Does the evidence file move with the spec, and where? **Answer:** yes, to `<spec_dir>/archive/evidence/<id>.json`, byte-identical. A build PR is unchanged: it still writes `<spec_dir>/evidence/<id>.json` while the spec is being built, because a spec is archived only after it is merged as `done`. The archive PR itself is where the gate checks the evidence moved intact (AC-4).
- [x] How do `depends_on` resolution, the validator and the gate find an archived spec? **Answer:** no index. The archive is inside `spec_dir`, so the recursive listing returns active and archived specs together. `validateTree` and the build gate's dependency lookup need no change; the listing function is extracted so it can be tested (see Design), with its behavior unchanged. Pinned by AC-1, AC-2, AC-5, AC-10. The build skill's step 4 is updated to look in both locations (AC-16).
- [x] Which branch prefix does an archive move use, and does it need a human? **Answer:** a new `archive/<id>` prefix, auto-merged with no human, because the gate verifies the move is exact. The gate enforces one spec per PR: the PR may only delete `<spec_dir>/<id>.md` and `<spec_dir>/evidence/<id>.json` and add the byte-identical files under `<spec_dir>/archive/`; anything else is an error (AC-7, AC-15). Exactness is the only control, so `protected_paths` still applies to an archive PR (AC-15).
- [x] Do "file name equals id" and "done specs keep their names" still hold in the archive? **Answer:** yes. A move keeps the id and the file name, so it is not a rename. The file-name check applies to archived paths (AC-3). The move is allowed only by the archive rule below, not by loosening the delete rule: the delete rule still rejects deleting a `done` spec anywhere else (AC-8).
- [x] How are existing done specs migrated, and is it reversible? **Answer:** no special migration. With `archive: true`, the `archive` command opens one `archive/<id>` PR per done spec it finds on the default branch, so existing done specs go one by one. It is reversible by a human restore PR on a `spec/` branch, which the gate allows with human approval (AC-14).
- [x] Should anything touching the archive be a protected path, and can archived specs be edited? **Answer:** archived files are immutable: any modification of an existing archived file fails on every branch kind (AC-13), because an edit could silently invalidate its evidence. The archive is not added to `protected_paths`; the immutability rule and the human-approved restore path cover it. Only `done` specs may enter the archive (AC-6).
- [x] How does the sweep and the build flow's evidence lookup treat archived specs? **Answer:** the sweep adds `archive/` to its default prefixes, so merged archive worktrees are removed (AC-12), and does nothing else new. Archive PRs are opened by the separate `archive` command (AC-11). Evidence lookup for build PRs is unchanged (see evidence answer). The build skill reads dependencies in both locations (AC-16).
- [x] Where does archive-PR creation live: the sweep or its own command? **Answer:** its own entry point, `dist/archive.mjs`, because idea, refine and build run `sweep --apply` first and archiving there would be a hidden side effect (token minting, pushes, PRs). Dry run by default; `--apply` opens PRs.
- [x] What stops a restored spec, or a spec whose archive PR failed or was closed, from being re-archived forever? **Answer:** `planArchive` skips any id that has had an `archive/<id>` branch or PR in any state, and skips and reports a done spec that has no evidence file (AC-11). A human reopens a skipped one by hand. A new "reopen / rework" status for done specs is a schema change and is its own spec, not part of this one.
- [x] Dependencies of this spec: **Answer:** `depends_on` is empty. The only other spec under `specs/` is the ignored probe.
- [x] How does the Orca Automation that runs the sweep on a schedule relate to this spec? **Answer:** it is out of scope here and is to be captured as its own spec (not yet written). Archiving works whenever the `archive` command runs, manually or on any scheduler.

## Design

**Layout.** Active specs stay at `<spec_dir>/<id>.md` with evidence at `<spec_dir>/evidence/<id>.json`. Archived: `<spec_dir>/archive/<id>.md` and `<spec_dir>/archive/evidence/<id>.json`. Paths are derived in one place: `src/gate.mjs` exports `archivePath(specDir, id)` and `archiveEvidencePath(specDir, id)` next to `evidencePath`; nothing else hardcodes them. An exported helper `isArchived(specDir, path)` tells the gate which side a path is on; it matches `.json` as well as `.md` under `<spec_dir>/archive/`, because evidence never passes `inSpecDir`.

**Listing.** `specsAt` moves out of `src/gate-cli.mjs` into a new `src/spec-tree.mjs`, which exports the `git` and `show` helpers (so `gate-cli.mjs` imports them instead of keeping a second copy, and `archive.mjs` reuses them) and takes `(ref, specDir, cwd)`, so a test can run it against a real temporary git repo. The return shape (`{ path, id, status, depends_on, acceptance }`) and the empty `catch` for a missing spec directory are unchanged, and `gate-cli.mjs` imports it. It keeps using `git ls-tree -r`, so it lists active and archived `.md` specs together and ignores evidence JSON. `validateTree` gains one check, a duplicate id error (an active and an archived spec cannot share an id; it cannot fire today because file name equals id, so no existing result changes), and runs over both, so a missing id or a cycle is caught as before, and moving a target never requires editing a referrer.

**Gate ordering (`src/gate.mjs`).** Before the existing per-spec loop, `evaluateGate` pairs paths from the flat `changes` list: a deleted active spec/evidence with an added archived one of the same id (a move), and the reverse (a restore), matching spec to spec and evidence to evidence by id and comparing `base` of the deleted file to `head` of the added file. Paired paths (spec and evidence alike) are removed from the generic delete/draft/approved checks and from the `idea/`/`spec/` "may only touch `<spec_dir>/**`" checks, which today reject evidence JSON because `inSpecDir` matches `.md` only; an unpaired JSON change on those branches is still an error as today. So those rules cannot fire contradictory errors on a valid move or restore; unpaired paths under `archive/` or deletions of `done` specs fall through and fail. The archive rules below are explicit and independent of the draft and approved rules; none of them relies on an existing rule firing by accident. The `archive` kind is handled in its own branch, not the "any other branch" fallthrough, and `validateTree(headSpecs)` still runs.

**Archive PR (`archive/<id>` branch kind).** No human, unless a changed path matches `protectedPaths` (then `humanRequired`, as for `build/`). It checks:
- the changed paths are exactly `<spec_dir>/<id>.md` (D), `<spec_dir>/evidence/<id>.json` (D), `<spec_dir>/archive/<id>.md` (A) and `<spec_dir>/archive/evidence/<id>.json` (A); anything else, including another spec's move, is an error (AC-15);
- the archived spec is byte-identical to the deleted active one, its status is `done`, its id equals `<id>`, and its file name equals its id (AC-3, AC-6, AC-15). The added file is validated with the deleted file's text as `baseText`; `validateSpec` treats the unchanged `done` status as legal, so it does not trip "new specs must start as draft";
- the archived evidence is byte-identical to the deleted evidence, and that evidence exists (AC-4).
A PR that meets all of this ends with no errors, no `humanRequired` and no `pending`, so `gateState` returns success (AC-7).

**Rules on every branch kind.**
- Adding a file under the archive from any branch other than a valid `archive/<id>` move or a `spec/` restore is an error, and a spec added there whose status is not `done` is an error naming the spec (AC-6). This is a new rule keyed on the path, not the draft rule.
- Modifying or deleting a file that exists under the archive at the base fails, except for the restore case below (AC-13).
- Deleting a `done` spec still fails everywhere unless it is the archive move on an `archive/<id>` branch or the restore on a `spec/` branch (AC-8).
- Restore: on a `spec/` branch, deleting `<spec_dir>/archive/<id>.md` and its evidence while adding byte-identical files at the active paths is allowed and adds a `humanRequired` entry (`spec/` already needs one). It is the only way out of the archive. On any other branch kind, or with any content change, or with only one of the two files, it is an error (AC-14). The restore also requires the archived spec's status to be `done` (checked explicitly), and `validateSpec` runs with the archived text as `baseText`. `gate-cli.mjs` already supplies `base` and `head` text for every changed path, JSON included, so it needs no new input for evidence.
- A repo with no archive files at base or head sees no change in any result (AC-9): every new rule is keyed on a path under `archive/` or the `archive/` branch prefix.

**Build gate.** The `build/` dependency check already looks up `baseSpecs` by id, and `baseSpecs` now includes archived specs through `specsAt`, so an archived done dependency counts as done and a missing or not-done one is still an error (AC-2). The build flow's evidence handling for `build/<id>` is untouched.

**Build skill.** `skills/build/SKILL.md` step 4 and step 1 of the worker brief say: a dependency is the spec at `<spec_dir>/<id>.md` or `<spec_dir>/archive/<id>.md` on `origin/main`, and it must be `done` (AC-16).

**`archive` command (new `src/archive.mjs`, bundled to `dist/archive.mjs`).** The planning is a pure function `planArchive({ archive, specs, evidenceIds, priorArchiveIds })` in `src/archive-plan.mjs` (specs from `specsAt('origin/<default>')`; `priorArchiveIds` come from the repo's PR history, all states, paginated, because head branches are deleted after merge). It returns `{ moves, skipped }` (AC-11). A small neutral module `src/prefixes.mjs` exports `SWEEP_PREFIXES = ['idea/', 'spec/', 'build/', 'archive/']`, which `src/sweep.mjs` imports (replacing its inline list and updating its header comment and usage line) for its default prefixes, so merged archive worktrees are removed (AC-12). The command reads `archive` from `.specforge/config.yml` and exits with a message when it is not true. `GH_TOKEN` (the app token) must be in the environment: the caller mints it with `mint-app-token.mjs`, as the skills do, so a scheduler must mint it too, and the command stops if it is absent. It fetches `origin` with that token and stops on failure, never falling back to a cached ref. A dry run (the default) prints the planned moves and skipped specs. With `--apply`, for each move it creates a fresh `orca worktree` on `archive/<id>` from `origin/<default>` (never in the user's checkout), moves the spec and evidence with `git mv`, commits with the standard trailer, pushes as the app, opens a PR titled `archive: <title>` ending with the Generated-with line, runs `gh pr merge --squash --auto`, and leaves the worktree for the sweep to remove after the merge. It opens at most one PR per spec, and every spec skipped for a prior PR or missing evidence is reported. If the app token is refused it stops and reports; it never uses the user's own credentials. `src/sweep.mjs` gains only the shared prefix list (AC-12, AC-17), and its "only reads PRs" header stays true. `archive` is added to the esbuild entry list in `package.json` and to the bundle-load loop in `test/dist.test.mjs`. AC-18 spawns the bundled command in a temp directory. Running it on a schedule is a separate spec.

**Config and docs.** `templates/config.yml` gets `archive: false` with a one-line comment. `README.md`, `docs/design.md`, `skills/sweep/SKILL.md` and `skills/init` (upgrade note) describe the archive, the `archive/` prefix, the `archive` command, immutability and the restore path. `docs/design.md`'s "keep their names" line says archiving keeps the name too. `CLAUDE.md`'s "Spec files are ..." bullet says that archived specs and evidence live under `<spec_dir>/archive/` and are immutable.

**Build-PR approval.** `src/`, `dist/`, `skills/`, `templates/`, `test/`, `package.json` and `CLAUDE.md` are protected paths, so the `build/` PR for this spec needs a human approval. That is intended. `dist/` must be rebuilt and committed.

**Tests.** All new tests are top-level `test()` calls in `test/archive.test.mjs`, so each verify line (`✔ <name> (`) is at column 0; the commands pass `--test-reporter=spec` so the format does not depend on the Node default. Gate tests call `evaluateGate` and `gateState` directly with synthetic `changes`, `baseSpecs`, `headSpecs` and `evidence` values, as `test/spec.test.mjs` does. AC-9 defines its own scenarios with expected values in the test; the expectations are written first and run green against the unmodified gate, so they record the pre-change behavior. A criterion that lists several cases (AC-2, AC-4, AC-8, AC-9, AC-11, AC-13, AC-14, AC-15) is asserted by one `t.test` subtest per case inside the named top-level test, so a missing or failing case fails the verify line. AC-10 builds a temporary git repo (a small helper in the test file; no shared fixture exists today) with an active and an archived spec and an evidence file and runs the real `specsAt`. Existing tests must pass unmodified. Before the release that ships this, it is tested end to end in `zalmb8/specforge-sandbox` (a clean archive PR, a PR the gate must reject, a restore), because unit tests alone missed the worst past bugs. That run, AC-9 and the existing bundle-load tests for `gate-cli` and `sweep` are the no-regression guard for the `specsAt` extraction.

**Release impact.** Adopters pin `v0`, so the new gate reaches all of them at once. The new rules fire only for paths under `archive/` or an `archive/` branch, so an adopter that never archives sees no change, with one caveat: an existing human branch named `archive/...` will now be held to the archive rules; this is accepted and goes in the release notes. The first `--apply` on a backlog opens one auto-merged PR per done spec with no cap; this is accepted too, since the gate's exactness check is the control and dry run is the default. No workflow permission changes, and the app needs no new permission: it already pushes branches and opens PRs for the other flows, and branch protection matches the target branch only, not `archive/*`. The `archive` command opens PRs only when `archive: true` and `--apply` is passed. Releasing is a separate human step.

**Rollback.** Git history plus the restore PR above. The gate must allow it, which AC-14 pins.

## Out of scope

- The Orca Automation that runs the sweep and archive on a schedule (its own spec).
- A "reopen / rework" status or any way to correct a done spec. By design a done spec, archived or not, cannot be edited; the escape hatch is the repo admin's bypass, and a reopen state is its own spec.
- Archiving specs that are not `done`.
- Editing archived files, or deleting specs or evidence permanently (the `spec/` restore moves them back; it does not delete them).
- Making the idea and refine skills' own id-collision listing archive-aware (the gate's duplicate-id check, AC-19, catches a reused id), a bulk "archive everything in one PR" mode, and a per-run cap on archive PRs (a repo with many done specs gets one PR per spec on the first run).
- Changing how a build PR writes or the gate checks evidence for a spec being built.
