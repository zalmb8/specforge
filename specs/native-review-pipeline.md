---
specforge: 1
id: native-review-pipeline
title: One native review pipeline for spec review
status: approved
depends_on: [native-orca-idea-flow]        # ids of specs that must be done before this one can be built
acceptance:
  - id: AC-1
    text: "The `review-spec` skill (`skills/review-spec/SKILL.md`) has the headings `## Stage 1: Find`, `## Stage 2: Verify`, `## Stage 3: Rank` and `## Stage 4: Return`, in that order: find (specialty reviewers in parallel), verify (an independent verifier re-checks each finding), rank (deduplicate and order by severity), return (verified findings go to the author agent)."
    verify: node --test test/review-spec/ac-1.test.mjs   # new test; asserts the four heading strings appear in order; fails if the file is missing
  - id: AC-2
    text: "The `review-spec` skill's `## Brief templates` section (from that heading to the next `## ` heading) holds the reviewer and verifier briefs. They are built from the spec path only: the only placeholders matching `\\{\\{[^}]+\\}\\}` are `{{spec_path}}` and, in the verifier brief, `{{findings}}`, and the section contains the sentence `Pass no author reasoning, history or session summary.`"
    verify: node --test test/review-spec/ac-2.test.mjs   # new test; string and placeholder assertions on that section
  - id: AC-3
    text: "Each of `agents/spec-testability.md`, `agents/spec-scope-risk.md`, `agents/spec-codebase-fit.md`, `agents/spec-consistency.md` and `agents/spec-verifier.md` has a frontmatter `name:` equal to the file's basename, a non-empty `description:`, a `tools:` line that is present and equals `Read, Grep, Glob` (read access to the codebase and no write tools), and the shared-rules sentence `Do not edit any file.`"
    verify: node --test test/review-spec/ac-3.test.mjs   # new test; fails if a file or its tools line is missing
  - id: AC-4
    text: "`skills/review-spec/SKILL.md` and the five agent files must exist and match none of these single-line regexes (a prose mention counts): `gh pr (comment|review)`, `gh api\\b.*(-X|--method)[ =]*(POST|PUT|PATCH|DELETE)`, `gh api\\b.*( -f | -F |--field|--raw-field)`, `pulls/\\S+/comments`. The test also runs each regex against a synthetic positive string to prove it can match."
    verify: node --test test/review-spec/ac-4.test.mjs   # new test; regex scan of those six files
  - id: AC-5
    text: "`skills/review-spec/SKILL.md` and the five agent files do not contain `CLAUDE_PLUGIN_ROOT`, `PLUGIN/` or `plugins/cache` (a prose mention counts), so no `Read` of a plugin-cache path is instructed."
    verify: node --test test/review-spec/ac-5.test.mjs   # new test; proxy check. The end-to-end run in zalmb8/specforge-sandbox (see Design, Release gate) is the real check
  - id: AC-6
    text: "No file under `skills/`, `agents/`, `docs/`, `src/`, `templates/`, `test/`, `.specforge/` or non-archived `specs/`, nor `README.md` or `CLAUDE.md`, contains the superseded reviewer label (the old name for independent reviewers that CLAUDE.md's `Say independent` rule forbids), matched case-insensitively with any suffix. Directories that do not exist are skipped; the test runs its regex against a synthetic positive string. Commit messages and PR text are checked by hand. `specs/archive/` and `dist/` are excluded."
    verify: node --test test/review-spec/ac-6.test.mjs   # new test; builds the label's regex from pieces so the word is not written in the repo
  - id: AC-7
    text: "The change modifies no file under `src/` or `dist/` (so no `src/gate*.mjs`), and neither `package.json` nor `.claude-plugin/plugin.json`. Evaluated on the committed tree after a fetch of `origin/main` with the app token; the check fails if the ref does not resolve or the diff errors."
    verify: bash -c 'd=$(git diff --name-only origin/main...HEAD) || exit 1; ! echo "$d" | grep -qE "^(src/|dist/|package\.json$|\.claude-plugin/plugin\.json$)"'   # exits 0 only when git succeeds and none of those paths changed
  - id: AC-8
    text: "`agents/` contains the five files named in AC-3 plus the unchanged `code-reviewer.md` and `ac-verifier.md`; `lenses/spec/` and `agents/spec-reviewer.md` do not exist; `lenses/code/` and `agents/code-reviewer.md` exist."
    verify: node --test test/review-spec/ac-8.test.mjs   # new test with one named subtest per clause; steady-state file-existence checks only, no git
  - id: AC-9
    text: "`templates/config.yml` and `.specforge/config.yml` each contain a line starting `exclude_spec_reviewers: []` (a trailing comment is allowed), contain no line starting `review_lenses:`, `exclude_lenses:` or `spec_reviewers:`, and still contain lines starting `code_review_lenses:` and `exclude_code_lenses:` (line-anchored, because `code_review_lenses` contains `review_lenses`)."
    verify: node --test test/review-spec/ac-9.test.mjs   # new test; line-anchored regexes on both files
  - id: AC-10
    text: "`skills/refine/SKILL.md` runs spec review through `specforge:review-spec`, one named subtest per clause: it names the four built-in specialties (`spec-testability`, `spec-scope-risk`, `spec-codebase-fit`, `spec-consistency`) minus any named in `exclude_spec_reviewers`, treating an absent key as `[]`; it repeats while a round's fixes were material, defined by the exact phrase `a change to the acceptance criteria, Design or Out of scope` and applied by diffing those sections, and at most `loops.spec_review_max` rounds; it contains the sentence `Put the finding to the user with a recommendation.` for a kept finding that is a judgment call or touches a decision the user made; it contains the sentence `Record each pushback reason in the PR description.`; its brief tells the worker to stop and report if `specforge:review-spec` is unavailable; and it contains none of `lenses/spec`, `spec-reviewer` or a bare `review_lenses`/`exclude_lenses` key."
    verify: node --test test/review-spec/ac-10.test.mjs   # new test; string assertions on the refine skill
  - id: AC-11
    text: "`skills/idea/SKILL.md` runs spec review through `specforge:review-spec`, one named subtest per clause: exactly `spec-testability` and `spec-scope-risk`, one pass (the strings `spec-consistency` and `spec-codebase-fit` do not appear anywhere in the skill); no `lenses/spec` or `spec-reviewer`, and no `ignore the rest` wording; it contains the sentence `Record each pushback reason in the PR description.`; and its brief tells the worker to stop and report if `specforge:review-spec` is unavailable. Meaningful only once `native-orca-idea-flow` is merged; asserted against the text it leaves."
    verify: node --test test/review-spec/ac-11.test.mjs   # new test; string assertions on the idea skill
  - id: AC-12
    text: "The `review-spec` skill requires the verifier to return every finding with a verdict `kept` or `dropped` and a reason, and contains the sentences `Show the author every dropped finding with its reason.` and `Do not triage findings before the verifier has returned.`; `agents/spec-verifier.md` instructs it to return a verdict and reason for every finding it is given. One named subtest per clause."
    verify: node --test test/review-spec/ac-12.test.mjs   # new test; string assertions on the skill and `agents/spec-verifier.md`
  - id: AC-13
    text: "The `review-spec` skill states its failure rules, one named subtest per clause: verification is one verifier call over all of a round's findings, and if that call fails or returns malformed output every finding goes to the author marked `unverified`; an absent `exclude_spec_reviewers` is treated as `[]`; a name in `exclude_spec_reviewers` that matches no built-in stops the run with an error (an unattended `idea` worker then opens no PR and names the bad key in its final message); and pushback reasons are kept in the worker's running notes across rounds and written into the PR description when the PR is opened."
    verify: node --test test/review-spec/ac-13.test.mjs   # new test; string assertions on the skill
  - id: AC-14
    text: "`README.md`, `docs/design.md` and the Layout blocks of `README.md` and `CLAUDE.md` (the code fence under `## Layout`) satisfy, one named subtest per clause: no file contains `spec-reviewer`, `lenses/spec`, or a `review_lenses` or `exclude_lenses` key (matched with `(?<![a-z_])` so `code_review_lenses` is allowed); both Layout blocks name the five agents and no longer say `spec/ and code/`; `README.md` documents `exclude_spec_reviewers`; `README.md` and `docs/design.md` still mention `code_review_lenses` and `exclude_code_lenses`; and each of the five agent names appears in at least one of `README.md` and `docs/design.md`."
    verify: node --test test/review-spec/ac-14.test.mjs   # new test; text checks on the three files
  - id: AC-15
    text: "Against `origin/main`, `skills/build/`, `lenses/code/`, `agents/code-reviewer.md` and `agents/ac-verifier.md` are unchanged. The `ac-verifier` runs this and AC-7 after fetching `origin/main` with the app token, and their output is the evidence; the check fails if the ref does not resolve or if `git ls-tree origin/main` does not list all four paths."
    verify: bash -c 'git rev-parse --verify -q origin/main >/dev/null && test $(git ls-tree origin/main -- skills/build lenses/code agents/code-reviewer.md agents/ac-verifier.md | wc -l) -eq 4 && git diff --quiet origin/main...HEAD -- skills/build lenses/code agents/code-reviewer.md agents/ac-verifier.md'   # exits 0 only when the ref resolves, all four paths exist on main, and nothing differs
---

## Summary

Replace the homegrown lens review of specs with a review pipeline shaped like Claude Code's own Code Review, as a `review-spec` skill used by `idea` and `refine`. Code review in `build` gets its own `review-code` skill in a follow-up spec (suggested id `native-code-review`, not yet written) that follows the same four stages. Until that lands, the `build` flow still reads code lenses from the plugin cache and can still stall on the permission prompt; this spec removes the lens reads for spec review only (the code-side problems above are the follow-up's):

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

- [x] One spec or two builds (code review and spec review), and in which order? **Two builds, spec review first.** This spec covers spec review only; code review (`build` step 6) is a follow-up spec that depends on this one being done.
- [x] One `review` skill with `spec` and `code` modes, or two skills? **Two skills.** The two reviews have different inputs (spec file versus diff), callers (`idea`/`refine` versus `build`), specialties and outputs, so a shared skill would only add mode branches. This spec adds `specforge:review-spec`; the follow-up adds `review-code`. The four-stage shape is a convention both follow, not shared code.
- [x] Where do the specialty agents live, and how does a repo add or exclude specialties? Can a repo `.claude/agents/` file override a same-named plugin agent (precedence not verified)? **Specialties are plugin agents, one per spec specialty, in `agents/`.** The first answer was that a repo adds specialties as `.claude/agents/` files named in config; this was reversed in review (below): **no repo extras for now.** A repo can only exclude built-ins by name in config. Overriding a built-in by name is not supported.
- [x] Generate agents from the lens files, or drop `lenses/` entirely? How do repos with `.specforge/lenses/` migrate? **Drop `lenses/spec/` entirely**, no generation. `lenses/code/` stays until the code-review spec. No migration: nothing outside this repo uses `.specforge/lenses/spec/` yet.
- [x] Reviewer as a subagent or as an Orca worker (`orca orchestration worker-start`)? Is Codex as reviewer wanted? **Subagents only, Claude only.** Orca-worker and non-Claude reviewers are out of scope.
- [x] Level knobs (quick, standard, deep) versus the existing `loops.*_max` caps? **No level knobs.** `loops.spec_review_max` stays the only cap.
- [x] Cost and latency of parallel specialists plus a verifier on an `idea` PR; should `idea` use a lighter level than `refine`? **Yes, by specialty set, not level:** `idea` runs two specialties (testability, scope-risk), one pass, plus the verifier; `refine` runs every built-in specialty not excluded. `idea` deliberately omits `spec-consistency` and `spec-codebase-fit` to keep ideas cheap; the draft `idea-flow-consistency-lens` wanted consistency in `idea`, and that is not adopted here.
- [x] What are the new config key names for adding and excluding spec specialties, and where do they live? **`exclude_spec_reviewers` (built-in names to skip)**, in `.specforge/config.yml` and `templates/config.yml`, default `[]`. Replaces `exclude_lenses`. The planned `spec_reviewers` key for extras was dropped (see the extras question below).
- [x] License terms for forking the official `code-review` and `pr-review-toolkit` plugins. **Not forked.** We write our own skill and agents inspired by their shape; the official plugins are reference only and nothing is copied.
- [x] Is `--comment`-style posting to GitHub ever wanted, and as which identity? **No.** Findings go only to the author agent; nothing is posted, so there is no identity question. Out of scope.
- [x] How does the verifier avoid dropping true findings (false-negative risk), and how may the author still push back? **The verifier returns every finding with a verdict (kept or dropped) and a reason, so nothing is dropped silently.** The author sees the dropped ones and may fix any anyway. Pushback reasons for kept findings go in the PR description. The author does no triage before the verifier has returned.
- [x] Is the hosted Claude Code Review offered at all, as an extra layer that never gates? **No.** Out of scope for this spec.
- [x] Are `lenses/`, the old `spec-reviewer` and `code-reviewer` agents and the config keys `review_lenses`, `exclude_lenses`, `code_review_lenses`, `exclude_code_lenses` removed, deprecated or kept? How do adopting repos behave on upgrade (for example old keys parsed and ignored), and does the `^lenses/` entry in `protected_paths` change? **Spec side removed outright:** `lenses/spec/`, the `spec-reviewer` agent, and the keys `review_lenses` and `exclude_lenses` (from `templates/config.yml` and this repo's config; nothing in `src/` reads them). No deprecation, since no adopter uses them yet. The code side (`lenses/code/`, `code-reviewer`, `code_review_lenses`, `exclude_code_lenses`) stays for the code-review spec. `^lenses/` stays in `protected_paths` because `lenses/code/` remains.
- [x] Does the config surface for adding or excluding specialties need changes in `src/` and `dist/` (validator, rebuild, tests), or is it plain agent files only? **No `src/` or `dist/` change.** Config keys are read by the skills, not the validator (checked: no `src/` reference to the lens keys).
- [x] Loop behavior: one pass, or a loop bounded by the existing `loops.*_max` caps? Where does the author record a pushback reason, and can the author see what the verifier dropped? **`refine` loops the whole pipeline up to `loops.spec_review_max` while a round's fixes were material; `idea` runs one pass.** Pushback reasons go in the PR description; the author sees dropped findings and reasons (see the verifier question).
- [x] Does a subagent spawned from a worker see the plugin's agents without the plugin-cache allow-list, and is that allow-list kept as a fallback? **The allow-list is kept.** Workers still run `PLUGIN/dist/` scripts (token minting, validator) and read templates from the plugin cache, so `init` keeps adding it. This spec only removes the lens reads; AC-5 is scoped to the review skill and its agents.
- [x] Repo-added specialties live in `.claude/agents/`, which the gate does not protect, and an agent file can grant itself write tools. How should the skill treat them? **Dropped for now.** Only built-in specialties exist; the `spec_reviewers` key is not added. A repo may later get extras through a spec that decides how to constrain their tools.
- [x] Rollback and staging: a bad review path breaks every later build. Is revert-the-PR plus an end-to-end check in `zalmb8/specforge-sandbox` before release enough? **Yes.** Rollback is reverting the PR. A manual end-to-end `idea` and `refine` run in `zalmb8/specforge-sandbox` is a pre-release step for the human, not an acceptance criterion; see Design, Release gate. Releases stay human.

## Design

Decided in refinement; see the answers under Open questions.

**Code review (follow-up spec, not built here).** A `specforge:review-code` skill forked from the official `code-review` command. It reviews the local diff (`git diff origin/<default>...HEAD`) so it can run before the PR exists. Native specialty agents suited to specforge, for example: gate and permissions contract, the rule that no flow uses the user's own login, silent failures, spec and acceptance-criteria conformance, and test quality adapted from `pr-test-analyzer`. Each finding gets an independent verification pass, then dedupe and rank, then typed verified findings go to the build agent. It posts nothing to GitHub by default, which avoids the identity question. `build` step 6 becomes: after tests and verification, start the independent review, fix valid findings, push back with reasons on the rest.

**Spec review (this spec).** A `specforge:review-spec` skill running the pipeline over a spec document. Specialty agents run in parallel (testability, scope and risk, codebase fit, consistency; the `depends_on` and dependency-tree checks belong to `spec-consistency`). An independent verifier re-checks each finding against the codebase and the spec, then dedupe and rank, then findings return to the authoring agent in `idea` or `refine`.

**Repo rules.** Repo-specific rules live in `CLAUDE.md`, which local and hosted review both read, rather than in a lens library. A repo can exclude built-in spec specialties by name with `exclude_spec_reviewers`; it cannot add or override specialties yet (`.claude/agents/` is not a protected path and an agent file can grant itself write tools, so extras need their own decision). `lenses/spec/`, the `spec-reviewer` agent and the `review_lenses`/`exclude_lenses` keys are deleted with no deprecation period. A stale `review_lenses` or `exclude_lenses` key left in a repo's config is ignored: nothing reads it. Before release the human checks which repos have adopted specforge and whether any set those keys.

**Names.** The skill is `skills/review-spec/SKILL.md`. Specialty agents: `spec-testability`, `spec-scope-risk`, `spec-codebase-fit`, `spec-consistency`; verifier: `spec-verifier`. Each is a native plugin agent with `tools: Read, Grep, Glob`. One test file per criterion under `test/review-spec/`, so each verify target runs only its own check (AC-7 is a shell command instead); `npm test` picks them up through its `test/**/*.test.mjs` glob. **Shared rules.** Each agent file carries a short shared preamble as its system prompt (independent reviewer, read-only, quote the spec, say which way a finding points, "unstated" versus "wrong", `Do not edit any file.`, finding format) followed by its specialty's criteria, as `spec-reviewer.md` does today; the skill's brief supplies only the spec path. The duplication across five files is accepted. `code-reviewer` is unchanged, and the follow-up spec reconciles the two.

**Invocation.** `idea` and `refine` workers call `specforge:review-spec` with the Skill tool, then spawn the named specialty agents as subagents. The workers never read skill or agent files themselves. **Named risk:** no existing worker invokes a skill this way, and that a spawned worker can do so and see plugin agents without a prompt is unverified; the briefs must fail loudly if the skill is unavailable, never skip review. The `idea` and `refine` briefs still use `PLUGIN/` for templates and `dist/` scripts, so the stall is fixed for lens reads only.

**Matching rules for tests.** The `test/review-spec/ac-N.test.mjs` layout is a deliberate new convention: one file per criterion so a missing test fails its target, which a `--test-name-pattern` filter cannot do. Each test reads the real files and fails if any is missing, and each clause of a multi-clause criterion is a separate subtest named `clause N` in the order the criterion lists them. A section runs from its heading to the next `## ` heading. Negative scans are paired with a positive control. Tests assert steady-state facts only and use no git; change-scoped checks (AC-7, AC-15) are shell commands run on the build PR, because CI uses a shallow checkout with no `origin/main`. The follow-up spec owns updating the tests that mention the code-side files (AC-8, AC-9, AC-14) when it changes them; that obligation is recorded here because the follow-up spec does not exist yet. A `done` spec's criteria are checked at its build time only, which is how `native-orca-idea-flow` AC-10 and this spec's AC-11 coexist.

**Verifier.** One `spec-verifier` call per round, given all of that round's findings and the spec path, not one call per finding; cost stays at four specialists plus one verifier per round.

**Skill contract.** `review-spec` spawns only the five built-in agents it names, so a same-named agent in a repo's `.claude/agents/` is never consulted. It treats an absent `exclude_spec_reviewers` as `[]`, so `init --upgrade` and `skills/init/SKILL.md` are not changed. Using the Skill tool from a worker is a deliberate departure from the literal-path briefs the other flows use; the `idea` and `refine` briefs therefore tell the worker to stop and report if the skill is unavailable.

**Pushback accumulation.** The worker keeps pushback reasons in its running notes across rounds and writes them into the PR description when it opens the PR (`idea` step 4, `refine` step 6). Nothing is posted as a comment.

**Questionable findings.** `refine` keeps today's rule: a kept finding that is a judgment call, a tradeoff or touches a decision the user made goes to the user with a recommendation. `idea` is unattended, so it fixes or pushes back and notes the open call in the PR description.

**Failure rules.** If the verifier fails or returns something unparseable, the findings go to the author marked `unverified`, not dropped. An excluded name that matches no built-in stops the run with an error rather than silently running everything; an unattended `idea` worker then opens no PR and says so in its final message. A stale `review_lenses`/`exclude_lenses` key is not detected; a repo that excluded a lens that way silently re-enables it, which is the accepted outcome.

**Dependencies.** Depends on `native-orca-idea-flow`, which also rewrites the review step of `skills/idea/SKILL.md`. The draft `idea-flow-consistency-lens` conflicts with this spec (it adds a third `spec-reviewer` lens to `idea`); it is left alone here. It is deliberately not in `depends_on` (a dismissal is an action, not a spec that reaches `done`). **Build precondition:** a human dismisses it before this spec is built, using `dismiss-superseded-specs` if that is built, otherwise by archiving or deleting the draft by hand; nothing enforces this, since building it would reintroduce `spec-reviewer` and `lenses/spec`. `native-orca-idea-flow` AC-10 ("exactly two `spec-reviewer` subagents") is superseded by this spec's AC-11 once this merges; that spec's evidence attests the earlier state and stays immutable.

**Docs.** Updated to describe the specialty agents and `exclude_spec_reviewers`: `README.md` (the plugin-details agent list, the config table, the spec-lens override paragraph, the Layout block), `docs/design.md` (the Build and Lenses bullets) and the Layout block of `CLAUDE.md`. The `lenses/code/` text stays, and the replace-by-name rule is kept for code lenses only.

**Reviewers.** Subagents only, Claude only. `idea` runs the testability and scope-risk specialties once; `refine` runs all non-excluded built-ins, looping up to `loops.spec_review_max` while fixes are material (a change to the acceptance criteria, Design or Out of scope). The verifier returns each finding as kept or dropped with a reason; the author fixes kept findings or records a pushback reason in the PR description (accumulated across rounds, written when the PR is opened), and does no triage before the verifier returns. Config key: `exclude_spec_reviewers`.

**Release gate.** The human runs `idea` and `refine` end to end in `zalmb8/specforge-sandbox` from a marketplace install, covering a worker invoking the skill and spawning the agents with no permission prompt, and checks adopters (above). `v0` is not moved until that passes. This is a release step, not an acceptance criterion. The human first confirms how the marketplace install resolves (tag or `main`). If it tracks `main`, the run happens against the PR branch before the merge is approved; otherwise it runs against `main` after the merge and before `v0` is tagged, and adopters pinned to `v0` are unaffected until then. Pass means: no permission prompt, `specforge:review-spec` invoked, the specialties spawned, the verifier returns verdicts, and the run never skips review. Rollback is reverting the PR, and it is the only fallback, since the same PR deletes the old reviewer and lenses. The human owns the adopter check, which must find no repo with `review_lenses` or `exclude_lenses` set.

**Constraints.** Do not weaken independence. Do not change the gate's rules. Never use the user's own credentials. The app never gets Workflows or Administration. No flow tags, moves `v0` or bumps versions. The plugin's rails (src, dist, skills, agents, lenses, templates, tests) are protected paths, so a build of this spec needs the human.

## Out of scope

- Code review: the `review-code` skill and the change to `build` step 6 belong to a follow-up spec. The Design paragraph on it is a sketch only.
- Any change to `skills/build/SKILL.md` (build step 6 keeps using `code-reviewer` and `lenses/code/` until the follow-up).
- Repo-added specialties (`spec_reviewers`) and any change to `lenses/code/`, the `^lenses/` protected path or CODEOWNERS.
- Replacing or weakening the `specforge/gate` status, or making the hosted review a required check.
- Changing `ac-verifier` or the acceptance-evidence rules.
- Releases, version bumps and moving `v0`.
- Orca-worker or non-Claude reviewers.
- Posting comments to GitHub and the hosted Claude Code Review.
- Removing the plugin-cache allow-list that `init` writes (`dist/` scripts and templates still need it).
- Editing archived specs.
