---
name: init
description: Adopt specforge in the current repo: add .specforge/config.yml, the gate workflow, a specs/ directory, and the plugin settings. Also upgrades an existing install. Use when setting up specforge in a repo.
---

# specforge init

1. Copy `${CLAUDE_PLUGIN_ROOT}/templates/config.yml` to `.specforge/config.yml` (ask the user for test/lint commands and spec_dir; keep defaults otherwise).
2. Copy `templates/gate-caller.yml` to `.github/workflows/specforge-gate.yml`.
3. Create `specs/.gitkeep`.
4. Merge into `.claude/settings.json` (don't overwrite): the `specforge` marketplace under `extraKnownMarketplaces` and `"specforge@specforge": true` under `enabledPlugins`.
5. Tell the user the manual GitHub steps: require the `specforge/gate` check on `main`, enable "automatically delete head branches", allow auto-merge, install the GitHub App.
6. Optional: schedule the sweep in Orca, e.g.
   `orca automations create --name specforge-sweep --trigger daily --time 07:00 --provider claude --repo path:<repo> --prompt "Run the specforge sweep skill with --apply and report stuck ideas."`

`init --upgrade` compares `.specforge/config.yml`'s `specforge:` version and the workflow's `@v` tag with the plugin's, and migrates or reports.
