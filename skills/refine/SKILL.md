---
name: refine
description: Refine a draft spec into an approved one on a spec/ branch, answering open questions with the user, running independent reviews, and opening a PR for human approval. Manual kickoff, e.g. "/specforge:refine todo-json-export". Use when the user wants to refine, finalize or approve a spec.
---

# specforge refine

You are the kickoff session. The refinement itself happens in its own Orca workspace, in an agent the user talks to there. You prepare it, launch it, report, and stop. `PLUGIN` means `${CLAUDE_PLUGIN_ROOT}`; write its literal value into the brief, because the worker has no such variable.

## Kickoff

1. **Resolve the spec id.** The argument is the full slug (`todo-json-export`); accept a unique prefix. With no argument or an ambiguous one, list the specs on `origin/main` whose status is `draft` and ask the user to pick. Only `draft` or `approved` specs can be refined; refuse `implementing` and `done`.
2. **Sweep** finished worktrees first: `node PLUGIN/dist/sweep.mjs --apply`
3. **Fetch with the app token**; if the fetch fails, stop and tell the user, never fall back to a cached ref:
   ```text
   export GH_TOKEN=$(node PLUGIN/dist/mint-app-token.mjs)
   git -c credential.helper= -c "credential.helper=!f() { echo username=x-access-token; echo password=$GH_TOKEN; }; f" fetch origin main
   ```
4. **Resume if possible.** If a worktree on `spec/<id>` already exists (`orca worktree list --json`), tell the user where it is and stop; do not create a second one.
5. **Create the worktree with no agent yet**, write the brief into it, then launch:
   ```text
   orca worktree create --name refine-<id> --no-parent --base-branch origin/main --branch spec/<id> --json
   ```
   Write the brief (below) to `<worktree path>/.specforge/brief.md` (gitignored). Then:
   ```text
   orca agent launch --agent claude --worktree id:<worktree id> \
     --prompt "Read .specforge/brief.md and follow it exactly." --json
   ```
   Require `result.launch.prompt.outcome` to be `journaled` or `handed-to-terminal`; if the prompt was not delivered, the agent is idle, so say so instead of reporting success.
6. **Report** the worktree and branch, tell the user to continue in that workspace, and stop. Do not do the refinement yourself.

## Brief

> You are the specforge refine agent for spec `<id>` in `<owner/repo>`, on branch `spec/<id>`. PLUGIN=`<literal plugin path>`; use it exactly as written. You work interactively with the user in this session. Touch only `<spec_dir>/<id>.md`. Do not invent answers to open questions, and never decide a question that is the user's to decide.
>
> **1. Read** the spec, `.specforge/config.yml`, and enough of the codebase to discuss the spec accurately. Commit nothing yet.
>
> **2. Answer open questions.** Take the unchecked items under "Open questions" and put them to the user with AskUserQuestion, grouped so each round is a handful of related questions, with your recommendation first where you have one. For each answer: tick the item (`- [x]`), add the answer to it, and **change the Design and acceptance criteria to reflect it**. A ticked question with an unchanged spec is a defect. New questions that arise go in as new `- [ ]` items and are asked too. Continue until none are unchecked.
>
> **2b. Dependencies.** Decide `depends_on` with the user: list the id of every spec this one needs built first, and nothing else. Check each id exists under `<spec_dir>/`. A spec that is built on top of unfinished work cannot be built until its dependencies are `done`, so ask when the prose names a prerequisite.
>
> **3. Make it verifiable.** Replace every `verify: TBD` with a concrete target: a test path and name, or a command with an expected result. A target must isolate its criterion: running it executes only that test or check, and it fails if the test does not exist. Run the command yourself against the code when you can, and confirm only the named test runs. Ask the user where a target is a real choice.
>
> **4. Independent review loop**, at most `loops.spec_review_max` rounds. Each round:
> - Spawn one `spec-reviewer` agent per lens, in parallel. The lenses are every file in `PLUGIN/lenses/spec/` plus any extra names in `review_lenses` (read from `.specforge/lenses/spec/<name>.md`; a repo file with a built-in's name replaces it; drop names listed in `exclude_lenses`; no duplicates). Each reviewer gets the path to the spec and the full text of exactly one lens. Pass no reasoning, no history, no summary of the conversation.
> - Triage every finding yourself, and record the verdict:
>   - **Valid**: fix it in the spec.
>   - **Wrong**: push back. Write one line saying why, citing the code or the spec; it goes in the PR description.
>   - **Questionable** (a real judgment call, a tradeoff, or it touches a decision the user made): ask the user, with your recommendation.
> - If a fix changed the spec materially, run another round, otherwise stop. When the cap is reached with findings outstanding, list them for the user rather than looping on.
>
> **5. Acceptance.** Show the user the final spec in summary: what it will build, the acceptance criteria with their verify targets, what was pushed back on and why. Ask whether to approve it. Do not proceed without an explicit yes. If they want changes, make them and re-run only the review rounds still within the cap.
>
> **6. Approve and open the PR.** Set `status: approved`. Run `node PLUGIN/dist/validate-cli.mjs <spec_dir>/<id>.md --base origin/main` and fix until it passes (if the tool itself crashes, stop and report). Commit with the trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Act as the GitHub App: `export GH_TOKEN=$(node PLUGIN/dist/mint-app-token.mjs)`; push with
> `git -c credential.helper= -c "credential.helper=!f() { echo username=x-access-token; echo password=$GH_TOKEN; }; f" push -u origin spec/<id>`;
> open a PR titled `spec: <title>` whose body has the summary, the acceptance criteria, and the pushed-back findings with reasons, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
>
> **7. Hand off to the human.** Enable native auto-merge as the app right after opening the PR: `gh pr merge <pr number> --squash --auto`. GitHub merges it once the required checks pass; the `specforge/gate` check stays red until a human who is not the PR author approves, by design. CODEOWNERS requests the reviewer automatically. Set the workspace status with `orca worktree set --worktree active --workspace-status in-review --comment "<PR url>"`. Tell the user the PR is ready for their review, give the URL, and say that approving it merges it. Then stop. Do not wait, poll, or merge any other way. The sweep removes this worktree after the merge.
