---
name: sweep
description: Remove Orca worktrees and branches for finished idea/ work, and list stuck ideas. Use when the user asks to clean up idea worktrees or see which ideas are stuck.
---

# specforge sweep

Run the dry run first, show the user, then apply:

```text
node ${CLAUDE_PLUGIN_ROOT}/dist/sweep.mjs            # dry run
node ${CLAUDE_PLUGIN_ROOT}/dist/sweep.mjs --apply    # remove
```

The sweep covers `idea/`, `spec/`, `build/` and `archive/` branches. It never opens PRs; archiving is the separate `dist/archive.mjs` command.

A worktree is removed only when its PR merged at the exact commit checked out, the tree is clean, and nothing is unpushed. Everything else is listed under "stuck" with the reason (open PR, red checks, uncommitted changes, no PR). Never force-remove a stuck worktree; report it and let the user decide.
