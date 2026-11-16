---
name: init
description: Adopt specforge in the current repo: add .specforge/config.yml, the gate workflow, a specs/ directory, and the plugin settings. Also upgrades an existing install. Use when setting up specforge in a repo.
---

# specforge init

`PLUGIN` means `${CLAUDE_PLUGIN_ROOT}`.

1. Copy `PLUGIN/templates/config.yml` to `.specforge/config.yml`. Read `package.json` (or the repo's equivalent) and set `commands.test` / `commands.lint` only to scripts that actually exist; leave a command empty rather than guess one that would fail. Ask the user to confirm them and the `spec_dir`.
2. Copy `templates/gate-caller.yml` to `.github/workflows/specforge-gate.yml`. It has two jobs: `gate`, and `merge`, which merges an approved `spec/` PR. Explain that `merge` is why the caller grants `contents: write` and `pull-requests: write`, and let the user drop that job if they would rather merge spec PRs by hand.
3. Create `specs/.gitkeep`. Add `.specforge/brief.md` to `.gitignore`.
4. Settings. Never overwrite existing keys.
   - Merge into the committed `.claude/settings.json`: the `specforge` marketplace under `extraKnownMarketplaces` and `"specforge@specforge": true` under `enabledPlugins`. Nothing machine-specific goes in this file.
   - Merge into the uncommitted `.claude/settings.local.json` (and make sure it is gitignored): `permissions.additionalDirectories` containing the plugin's cache directory *without the version segment* (the parent of `PLUGIN`, e.g. `~/.claude/plugins/cache/specforge/specforge`), so unattended workers can read the plugin's templates and scripts without stalling on a permission prompt, and it survives plugin updates. It is per-machine, so every machine that adopts the repo runs `init` (or this step) once.
5. Repo settings (run with the user's `gh`, not the app): `gh api -X PATCH repos/{owner}/{repo} -F delete_branch_on_merge=true -F allow_auto_merge=true`. On a free private repo `allow_auto_merge` is ignored; that's fine, because agents merge through `merge-pr`, which enforces the gate itself.
6. Tell the user the manual steps: install the GitHub App on the repo (link: `https://github.com/settings/installations/<installationId>` with the ID read from `~/.config/specforge/app.json`; if that file is missing, link `https://github.com/settings/installations`), and on a plan that supports it require the `specforge/gate` check on the default branch.
7. Optional: schedule the sweep in Orca, e.g.
   `orca automations create --name specforge-sweep --trigger daily --time 07:00 --provider claude --repo path:<repo> --prompt "Run the specforge sweep skill with --apply and report stuck ideas."`

`init --upgrade` compares `.specforge/config.yml`'s `specforge:` version and the workflow's `@v` tag with the plugin's, and migrates or reports.
