---
specforge: 1
id: native-review-pipeline
title: One native review pipeline for code and spec review
status: draft
depends_on: []        # ids of specs that must be done before this one can be built
acceptance:
  - id: AC-1
    text: "The review skill's prose defines four stages in this order: find (specialty reviewers in parallel), verify (an independent verifier re-checks each finding), rank (deduplicate and order by severity), return (verified findings go to the author agent)."
    verify: TBD   # prose-conformance check only: a new test asserts the four stage headings exist in order in the skill file
  - id: AC-2
    text: "The review skill's reviewer and verifier briefs are built from the diff or spec path only and contain no author reasoning or session context."
    verify: TBD   # prose-conformance check on the brief template in the skill
  - id: AC-3
    text: "The reviewer and verifier agent definitions grant read access to the codebase and no write tools."
    verify: TBD   # check the tools line of each agent file
  - id: AC-4
    text: "Code review takes its input from `git diff origin/<default>...HEAD`, with the default branch taken from `.specforge/config.yml`, and needs no PR to exist."
    verify: TBD
  - id: AC-5
    text: "The review skill and agents contain no `gh pr comment`, `gh api` write call or inline-comment tool call."
    verify: TBD   # grep over the skill and agent files; revisit if the posting open question resolves in favor of posting
  - id: AC-6
    text: "In `skills/build/SKILL.md`, the independent review step comes after the test run and acceptance verification step."
    verify: TBD
  - id: AC-7
    text: "`skills/build/SKILL.md` tells the author to fix each verified finding or record a pushback reason in a named artifact (to be decided; see Open questions), and to run no triage of its own before the verifier has returned."
    verify: TBD
  - id: AC-8
    text: "The skills and agents introduced or changed by this spec contain no `Read` of a path under `${CLAUDE_PLUGIN_ROOT}` or the plugin cache."
    verify: TBD   # proxy check; an end-to-end unattended run in zalmb8/specforge-sandbox is a separate manual check, pending the open question on where specialty agents live
  - id: AC-9
    text: "No file in non-archived `skills/`, `agents/`, `docs/`, `README.md` or `src/` uses the superseded reviewer label that CLAUDE.md forbids; `<spec_dir>/archive/` is excluded because archived specs are immutable."
    verify: TBD   # grep for the forbidden term named in CLAUDE.md, expecting no matches
  - id: AC-10
    text: "The change does not modify the gate rules in `src/gate*.mjs` and does not change the version in `package.json` or `.claude-plugin/plugin.json`."
    verify: TBD   # git diff origin/main...HEAD --stat shows none of those files
  - id: AC-11
    text: "The spec-review mode of the pipeline is used by `idea` and `refine`, with the same four stages applied to a spec file instead of a diff."
    verify: TBD
---

## Summary

Replace the homegrown lens review with one review pipeline shaped like Claude Code's own Code Review, used for both code review (in `build`) and spec review (in `idea` and `refine`):

1. **Find**: specialty reviewer agents run in parallel on the change.
2. **Verify**: an independent verification step re-checks each finding against the code and drops false positives.
3. **Rank**: deduplicate and rank by severity.
4. **Return**: the verified findings go back to the author agent, which fixes them or pushes back with reasons.

The author never certifies its own work. An independent agent (a different agent than the author, no author context, full read access to the codebase) runs both the review and the verification.

## Context

Today a generic `agents/code-reviewer.md` or `agents/spec-reviewer.md` holds shared rules, and the caller reads one file from `lenses/code/` or `lenses/spec/` and pastes its text into the prompt. The author then triages the findings itself. Problems seen:

- The worker has to Read lens files from the plugin cache, outside its worktree. That triggered a permission prompt and stalled an unattended run.
- The author judges findings about its own work.
- The lens-file-plus-injection scheme is homegrown and needs the `review_lenses`, `exclude_lenses`, `code_review_lenses` and `exclude_code_lenses` override rules.

Current shape: spec lenses are testability, scope-risk, codebase-fit and consistency; agents are `spec-reviewer`, `code-reviewer` and `ac-verifier`; loop caps are `loops.spec_review_max` and `loops.code_review_max`. The `idea` flow runs one round with two lenses, `refine` runs all spec lenses up to the cap, and `build` step 6 runs the code lenses and then the author triages.

Reference points:

- Claude Code ships a `code-review` skill (levels low to max; `--comment` posts inline PR comments; `--fix` applies fixes; `ultra` runs a cloud multi-agent review).
- The official plugin `code-review` is a plain markdown command. It launches 4 parallel agents (2 CLAUDE.md-compliance, 2 bug), then one validation subagent per issue, drops anything unvalidated, and optionally posts inline comments. It reviews a PR via `gh`, not a local diff.
- The official plugin `pr-review-toolkit` has specialist agents (code-reviewer, code-simplifier, comment-analyzer, pr-test-analyzer, silent-failure-hunter, type-design-analyzer) and a `review-pr` orchestrating command.
- The hosted Claude Code Review (GitHub) is tuned by `REVIEW.md` at the repo root, read from the base branch. `REVIEW.md` only tunes a fixed pipeline (severity, nit caps, skip rules, evidence rules); it does not define specialties or agents. The local `/code-review` reads `CLAUDE.md`, not `REVIEW.md`. The hosted product needs a Team or Enterprise plan and the Claude GitHub App, and its check run never concludes as a failure, so it cannot replace `specforge/gate` or be a required check. The identity its comments post as is not documented.
- Plugin agents (`agents/*.md`) load natively and need no file reads. `lenses/`, `templates/` and `dist/` are plain data a worker must Read by path.

## Open questions

- [ ] One spec or two builds (code review and spec review), and in which order?
- [ ] One `review` skill with `spec` and `code` modes, or two skills?
- [ ] Where do the specialty agents live, and how does a repo add or exclude specialties? Can a repo `.claude/agents/` file override a same-named plugin agent (precedence not verified)?
- [ ] Generate agents from the lens files, or drop `lenses/` entirely? How do repos with `.specforge/lenses/` migrate?
- [ ] Reviewer as a subagent or as an Orca worker (`orca orchestration worker-start`)? Is Codex as reviewer wanted? A non-Claude reviewer cannot use Claude plugin agents, so the specialty prompts would also need to exist as plain text.
- [ ] Level knobs (quick, standard, deep) versus the existing `loops.*_max` caps?
- [ ] Cost and latency of parallel specialists plus a verifier on an `idea` PR; should `idea` use a lighter level than `refine`?
- [ ] License terms for forking the official `code-review` and `pr-review-toolkit` plugins.
- [ ] Is `--comment`-style posting to GitHub ever wanted, and as which identity?
- [ ] How does the verifier avoid dropping true findings (false-negative risk), and how may the author still push back?
- [ ] Is the hosted Claude Code Review offered at all, as an extra layer that never gates?
- [ ] Are `lenses/`, the old `spec-reviewer` and `code-reviewer` agents and the config keys `review_lenses`, `exclude_lenses`, `code_review_lenses`, `exclude_code_lenses` removed, deprecated or kept? How do adopting repos behave on upgrade (for example old keys parsed and ignored), and does the `^lenses/` entry in `protected_paths` change?
- [ ] Does the config surface for adding or excluding specialties need changes in `src/` and `dist/` (validator, rebuild, tests), or is it plain agent files only?
- [ ] Loop behavior: one pass, or a loop bounded by the existing `loops.*_max` caps? Where does the author record a pushback reason, and can the author see what the verifier dropped?
- [ ] Does a subagent spawned from a worker see the plugin's agents without the plugin-cache allow-list, and is that allow-list kept as a fallback?
- [ ] Rollback and staging: a bad review path breaks every later build. Is revert-the-PR plus an end-to-end check in `zalmb8/specforge-sandbox` before release enough?

## Design

Starting point, subject to the open questions.

**Code review.** A `specforge:review` skill forked from the official `code-review` command. It reviews the local diff (`git diff origin/<default>...HEAD`) so it can run before the PR exists. Native specialty agents suited to specforge, for example: gate and permissions contract, the rule that no flow uses the user's own login, silent failures, spec and acceptance-criteria conformance, and test quality adapted from `pr-test-analyzer`. Each finding gets an independent verification pass, then dedupe and rank, then typed verified findings go to the build agent. It posts nothing to GitHub by default, which avoids the identity question. `build` step 6 becomes: after tests and verification, start the independent review, fix valid findings, push back with reasons on the rest.

**Spec review.** The same pipeline over a spec document instead of a diff. Specialty agents run in parallel (testability, scope and risk, codebase fit, consistency, dependency-tree sanity). An independent verifier re-checks each finding against the codebase and the spec, then dedupe and rank, then findings return to the authoring agent in `idea` or `refine`.

**Repo rules.** Repo-specific rules live in `CLAUDE.md`, which local and hosted review both read, rather than in a lens library. A `.specforge/` config may list extra specialty agent names and exclude built-in ones.

**Hosted review.** Optionally the hosted Claude Code Review runs as an extra layer on PRs, never as a gate.

**Orca.** A reviewer may run as a subagent, or as an Orca worker in its own worktree, possibly on a different agent.

**Constraints.** Do not weaken independence. Do not change the gate's rules. Never use the user's own credentials. The app never gets Workflows or Administration. No flow tags, moves `v0` or bumps versions. The plugin's rails (src, dist, skills, agents, lenses, templates, tests) are protected paths, so a build of this spec needs the human.

## Out of scope

- Replacing or weakening the `specforge/gate` status, or making the hosted review a required check.
- Changing `ac-verifier` or the acceptance-evidence rules.
- Releases, version bumps and moving `v0`.
- Anything the open questions leave undecided (Orca-worker or non-Claude reviewers, the hosted Claude Code Review, posting comments to GitHub): none of it is built until refinement decides it in or out.
- Editing archived specs.
