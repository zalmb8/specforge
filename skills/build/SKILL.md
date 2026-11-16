---
name: build
description: Implement an approved spec on a build/ branch with tests first, independent code review, CI fixing and independent acceptance verification, then let GitHub merge it. Manual kickoff, e.g. "/specforge:build todo-json-export". Use when the user wants to build, implement or ship an approved spec.
---

# specforge build

You are the kickoff session. The build itself runs in its own Orca workspace, in an agent that works unattended and asks the user there only when it must. You prepare it, launch it, report, and stop. `PLUGIN` means `${CLAUDE_PLUGIN_ROOT}`; write its literal value into the brief, because the worker has no such variable.

## Kickoff

1. **Resolve the spec id.** The argument is the full slug; accept a unique prefix. With no argument or an ambiguous one, list the specs on `origin/main` whose status is `approved` (or `implementing`, to resume) and ask the user to pick. Refuse `draft`, `refining` and `done`.
2. **Sweep** finished worktrees first: `node PLUGIN/dist/sweep.mjs --apply`
3. **Fetch with the app token**; if the fetch fails, stop and tell the user, never fall back to a cached ref:
   ```text
   export GH_TOKEN=$(node PLUGIN/dist/mint-app-token.mjs)
   git -c credential.helper= -c "credential.helper=!f() { echo username=x-access-token; echo password=$GH_TOKEN; }; f" fetch origin main
   ```
4. **Check dependencies.** Read the spec's `depends_on` on `origin/main`. Every listed spec must exist and be `done`. If any is not, stop and tell the user which, and what its status is. Do not create a worktree.
5. **Resume if possible.** If a worktree on `build/<id>` already exists (`orca worktree list --json`), tell the user where it is and stop.
6. **Create the worktree with no agent yet**, write the brief into it, then launch:
   ```text
   orca worktree create --name build-<id> --no-parent --base-branch origin/main --branch build/<id> --json
   ```
   Write the brief (below) to `<worktree path>/.specforge/brief.md` (gitignored). Then:
   ```text
   orca agent launch --agent claude --worktree id:<worktree id> \
     --prompt "Read .specforge/brief.md and follow it exactly." --json
   ```
   Require `result.launch.prompt.outcome` to be `journaled` or `handed-to-terminal`; if the prompt was not delivered, the agent is idle, so say so instead of reporting success.
7. **Report** the worktree and branch, say the worker runs unattended and will flag that workspace if it needs the user, and stop. Do not do any of the build yourself.

## Brief

> You are the specforge build agent for spec `<id>` in `<owner/repo>`, on branch `build/<id>`. PLUGIN=`<literal plugin path>`; use it exactly as written. You work unattended. Touch the code the spec requires, `<spec_dir>/<id>.md`, and `<spec_dir>/evidence/<id>.json`; leave everything else alone, and never touch `.github/` (the app cannot push workflows, and the gate requires a human for it). Acting as the GitHub App is the only way you push or open PRs; **if the app is refused something, stop and ask the user, never fall back to their own credentials.**
>
> **1. Read** the spec, `.specforge/config.yml` and the codebase. Confirm `depends_on` specs are all `done` on `origin/main`; if not, stop and flag the user (step 9).
>
> **2. Start.** Set `status: implementing` in the spec and commit it (trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`).
>
> **3. Tests first.** For each acceptance criterion, create the thing its `verify` target names (the test file and test name, or the command) so that the target is real and runs. Run them and confirm each fails for the right reason before any implementation. Names must match the `verify` text exactly.
>
> **4. Implement** until `commands.test` and `commands.lint` (when set in the config) pass locally. Never weaken or delete a test to make it pass, and never edit an acceptance criterion to fit the code.
>
> **5. If the spec cannot be met as written** (a criterion is impossible, contradicts the code, or is ambiguous in a way that changes behavior), stop that part and flag the user (step 9), explaining the problem and your proposed amendment. If they agree, edit the criterion in the spec with the reasoning in the commit message. The gate will then require the user's approval on the PR; that is intended.
>
> **6. Independent code review**, at most `loops.code_review_max` rounds. Each round spawn one `code-reviewer` agent per lens, in parallel. The lenses are every file in `PLUGIN/lenses/code/` plus extra names in `code_review_lenses` (read from `.specforge/lenses/code/<name>.md`; a repo file with a built-in's name replaces it; drop names in `exclude_code_lenses`; no duplicates). Each reviewer gets the spec path, the base ref `origin/<default branch>` and the full text of exactly one lens. Pass no reasoning and no history. Triage every finding and record the verdict:
> - **Valid**: fix it.
> - **Wrong**: push back; write one line saying why, citing the code or the spec. It goes in the PR description.
> - **Implies a spec change**: step 5.
> Run another round only if a fix changed the code materially. At the cap with findings outstanding, list them in the PR description instead of looping on.
>
> **7. Open the PR.** Push as the app: `export GH_TOKEN=$(node PLUGIN/dist/mint-app-token.mjs)`; `git -c credential.helper= -c "credential.helper=!f() { echo username=x-access-token; echo password=$GH_TOKEN; }; f" push -u origin build/<id>`. Open a PR titled `build: <title>` with the summary, the acceptance criteria, and the pushed-back review findings with reasons, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Enable native auto-merge: `gh pr merge <n> --squash --auto`. It cannot merge yet: the `specforge/gate` status stays pending until the spec is `done` and has passing evidence for this PR.
>
> **8. CI loop**, at most `loops.ci_fix_max` rounds. Wait for CI without polling: find the runs for your head commit with `gh run list --commit <sha> --json databaseId,workflowName,conclusion`, and for each run start `gh run watch <id> --exit-status` in the background and wait for it to finish. (Do not use `gh pr checks --watch`: the gate's pending status never completes and would hold it forever.) On a failure, read the failing job's log with `gh api repos/{owner}/{repo}/actions/jobs/<job id>/logs --allow-escape-sequences` (strip ANSI codes), fix the cause, push, and wait again. If reading logs is refused, stop and ask the user to grant the app `Actions: read`.
>
> **9. Needing the user.** Run `orca worktree set --worktree active --unread --comment "<one line: what you need>"`, then ask with AskUserQuestion, with options and your recommendation. Do this only for the cases named above (unmet dependency, a spec that cannot be met, a refused permission, a loop cap). Otherwise decide, and note the decision in the PR description.
>
> **10. Finish and verify.** When CI is green: set `status: done` in the spec, commit only that change, push, and wait for CI again. Then spawn one `ac-verifier` agent with the spec id and the head commit sha (nothing else). It runs every `verify` target, writes `<spec_dir>/evidence/<id>.json` and returns a table. If any criterion failed, go back to step 4 (it counts toward `ci_fix_max`), then repeat this step. If all passed, commit **only** the evidence file and push; any other change after verification invalidates it. Post the verifier's table as a PR comment.
>
> **11. Hand off.** Wait for CI on the evidence commit (step 8). Then set `orca worktree set --worktree active --workspace-status in-review --comment "<PR url>"`, tell the user the PR is ready and will merge itself once the gate is green, and stop. Do not wait for the merge, poll, or merge any other way. The sweep removes this worktree afterwards.
>
> **If a loop cap is reached,** stop. Leave the PR open with a comment listing what is outstanding, flag the workspace as in step 9, and report.
