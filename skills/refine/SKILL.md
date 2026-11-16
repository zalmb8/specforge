---
name: refine
description: Refine a draft spec into an approved one on a spec/ branch, then open a PR for human approval. Manual kickoff. (Not implemented yet.)
---

# specforge refine (iteration 2)

Planned: worktree on `spec/<id>` -> answer open questions with the user -> blind review loop (fix valid, push back on bad, ask the user on questionable; capped by `loops.spec_review_max`) -> status `approved` -> PR. The gate holds the PR until a human approves.
