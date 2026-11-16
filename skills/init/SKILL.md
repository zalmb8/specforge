---
name: init
description: Adopt specforge in the current repo: add .specforge/config.yml, the gate workflow, a specs/ directory, and the plugin settings. Also upgrades an existing install. Use when setting up specforge in a repo.
---

# specforge init

`PLUGIN` means `${CLAUDE_PLUGIN_ROOT}`.

1. Copy `PLUGIN/templates/config.yml` to `.specforge/config.yml` (ask the user for test/lint commands and spec_dir; keep defaults otherwise).
2. Copy `templates/gate-caller.yml` to `.github/workflows/specforge-gate.yml`.
3. Create `specs/.gitkeep`. Add `.specforge/brief.md` to `.gitignore`.
4. Merge into `.claude/settings.json` (never overwrite existing keys):
   - the `specforge` marketplace under `extraKnownMarketplaces` and `"specforge@specforge": true` under `enabledPlugins`;
   - `PLUGIN`'s directory under `permissions.additionalDirectories`, so unattended workers can read the plugin's templates and scripts without stalling on a permission prompt.
5. Repo settings (run with the user's `gh`, not the app): `gh api -X PATCH repos/{owner}/{repo} -F delete_branch_on_merge=true -F allow_auto_merge=true`. On a free private repo `allow_auto_merge` is ignored; that's fine, because agents merge through `merge-pr`, which enforces the gate itself.
6. Tell the user the manual steps: install the GitHub App on the repo (https://github.com/settings/installations/<id>), and on a plan that supports it require the `specforge/gate` check on the default branch.
7. Optional: schedule the sweep in Orca, e.g.
   `orca automations create --name specforge-sweep --trigger daily --time 07:00 --provider claude --repo path:<repo> --prompt "Run the specforge sweep skill with --apply and report stuck ideas."`

`init --upgrade` compares `.specforge/config.yml`'s `specforge:` version and the workflow's `@v` tag with the plugin's, and migrates or reports.
