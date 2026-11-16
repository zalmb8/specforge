---
name: init
description: Adopt specforge in the current repo: add .specforge/config.yml, the gate workflow, a specs/ directory, plugin settings, branch protection and CODEOWNERS. Also upgrades an existing install. Use when setting up specforge in a repo.
---

# specforge init

`PLUGIN` means `${CLAUDE_PLUGIN_ROOT}`. Specforge relies on GitHub's native branch protection, auto-merge and CODEOWNERS, so the repo must be public or on a plan that supports them (see the README, "Private repos on free plans"). Check first: if step 5 is refused with an "upgrade your plan" error, stop and tell the user to read that README section.

1. Copy `PLUGIN/templates/config.yml` to `.specforge/config.yml`. Read `package.json` (or the repo's equivalent) and set `commands.test` / `commands.lint` only to scripts that actually exist; leave a command empty rather than guess one that would fail. Ask the user to confirm them, the `spec_dir`, and their GitHub username for the CODEOWNERS entry, in one question.
2. Copy `templates/gate-caller.yml` to `.github/workflows/specforge-gate.yml`.
3. Create `specs/.gitkeep`. Add `.specforge/brief.md` to `.gitignore`.
4. Settings. Never overwrite existing keys.
   - Merge into the committed `.claude/settings.json`: the `specforge` marketplace under `extraKnownMarketplaces` and `"specforge@specforge": true` under `enabledPlugins`. Nothing machine-specific goes in this file.
   - Merge into the uncommitted `.claude/settings.local.json` (and make sure it is gitignored): `permissions.additionalDirectories` containing the plugin's cache directory *without the version segment* (the parent of `PLUGIN`, e.g. `~/.claude/plugins/cache/specforge/specforge`), so unattended workers can read the plugin's templates and scripts without stalling on a permission prompt, and it survives plugin updates. It is per-machine, so every machine that adopts the repo runs `init` (or this step) once.
5. Repo settings. This is one-time setup the user asked for, so run it with the user's `gh`, not the app:
   - `gh api -X PATCH repos/{owner}/{repo} -F allow_auto_merge=true -F delete_branch_on_merge=true -F allow_squash_merge=true`
   - Branch protection on the default branch. **Read the existing protection first** (`gh api repos/{owner}/{repo}/branches/<default>/protection`) and only add to it, never weaken it. Required: status context `specforge/gate` (a commit status the gate reports; not the `gate / specforge/gate` check run, which GitHub never lets a later run replace) (plus any the repo already requires, and its test job if it has one), `dismiss_stale_reviews: true`, `strict: true`, `enforce_admins: false`, and no required approving review count beyond what already exists (the gate itself demands a human approval on `spec/` PRs; a blanket requirement would block auto-merging `idea/` and `build/` PRs).
6. CODEOWNERS (`.github/CODEOWNERS`, append, never clobber): `<spec_dir>/ @<username>`. This is what requests the user as reviewer on spec PRs.
7. Tell the user the manual step: install the GitHub App on the repo (link: `https://github.com/settings/installations/<installationId>` with the ID read from `~/.config/specforge/app.json`; if that file is missing, link `https://github.com/settings/installations`).
8. Optional: schedule the sweep in Orca, e.g.
   `orca automations create --name specforge-sweep --trigger daily --time 07:00 --provider claude --repo path:<repo> --prompt "Run the specforge sweep skill with --apply and report stuck ideas."`

On `init --upgrade`, if `archive` is absent from `.specforge/config.yml`, add the `archive: false` line from `templates/config.yml` and tell the user it is opt-in (done specs move to `<spec_dir>/archive/` via `dist/archive.mjs`). `init --upgrade` also compares `.specforge/config.yml`'s `specforge:` version and the workflow's `@v` tag with the plugin's, and migrates or reports.
