---
name: build
description: Implement an approved spec on a build/ branch, loop on review and CI, verify every acceptance criterion, and merge. (Not implemented yet.)
---

# specforge build (iteration 3)

Planned: worktree on `build/<id>` -> implement -> code review loop -> push -> CI-fix loop -> `ac-verifier` posts an AC-to-evidence table on the PR -> merge. Editing acceptance criteria or protected paths escalates to a human via the gate.
