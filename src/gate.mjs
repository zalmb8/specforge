import { parseSpec, validateSpec, validateTree } from './spec.mjs';

// Paths whose change always needs a human, whatever branch produced them.
// These are the rails that keep the automation honest, so it can't merge edits to itself.
// Repos extend this via `protected_paths` in .specforge/config.yml (regex strings).
export const DEFAULT_PROTECTED = ['^\\.github/', '^\\.specforge/', '^CODEOWNERS$'];

const inSpecDir = (specDir, p) => p.startsWith(`${specDir}/`) && p.endsWith('.md');
const acceptanceOf = (text) => JSON.stringify(parseSpec(text ?? '').data?.acceptance ?? null);
const dependsOf = (text) => JSON.stringify(parseSpec(text ?? '').data?.depends_on ?? []);

/** Where the AC evidence for a spec lives. It is JSON, so spec validation never parses it. */
export const evidencePath = (specDir, id) => `${specDir}/evidence/${id}.json`;

/**
 * Problems with the AC evidence for a finished spec; an empty list means it is good.
 *
 * evidence: { path, json, ancestor, changedSince }
 *   json         the parsed evidence file at the PR head, or null if absent
 *   ancestor     whether the commit the evidence was recorded on is part of this PR
 *   changedSince files changed between that commit and the PR head
 * The evidence commit may only add the evidence file itself, so what was verified is what ships.
 */
export function checkEvidence({ headSpec, evidence }) {
  if (!evidence?.json) return [`no AC evidence at ${evidence?.path}`];
  const j = evidence.json;
  const problems = [];
  if (j.specforge !== 1 || j.spec !== headSpec.id) problems.push('evidence is for a different spec or schema version');
  for (const ac of headSpec.acceptance ?? []) {
    const e = (j.results ?? []).find((r) => r.id === ac.id);
    if (!e) problems.push(`${ac.id} has no evidence`);
    else if (e.result !== 'pass') problems.push(`${ac.id} did not pass`);
    else if (e.target !== ac.verify) problems.push(`${ac.id} evidence is for a different verify target`);
  }
  if (!evidence.ancestor) {
    problems.push('evidence was recorded on a commit that is not part of this PR');
  } else {
    const extra = (evidence.changedSince ?? []).filter((p) => p !== evidence.path);
    if (extra.length) problems.push(`files changed after verification: ${extra.slice(0, 5).join(', ')}`);
  }
  return problems;
}

/**
 * Pure policy: decide what a PR needs, from its head branch and its changes.
 *
 * changes:   [{ path, status: 'A'|'M'|'D', base?: string, head?: string }]
 * baseSpecs: every spec on the base branch, headSpecs: every spec as the PR would leave it,
 *            each { id, status, depends_on, acceptance }
 * evidence:  see checkEvidence; only used for build/ PRs
 *
 * Returns { errors, humanRequired, pending }.
 *   errors         hard failures
 *   humanRequired  satisfied by an approving review from a human who isn't the PR author
 *   pending        work still to do (a build that is not done yet, missing AC evidence)
 */
export function evaluateGate({
  headRef, changes, specDir = 'specs', protectedPaths = DEFAULT_PROTECTED,
  baseSpecs = [], headSpecs = [], evidence,
}) {
  const protectedRes = protectedPaths.map((p) => new RegExp(p));
  const errors = [];
  const humanRequired = [];
  const pending = [];
  const kind = headRef.split('/')[0];
  const specs = changes.filter((c) => inSpecDir(specDir, c.path));

  for (const c of specs) {
    if (c.status === 'D') {
      // A spec may be renamed or removed only while nothing is built on it, and the tree check
      // below fails the PR if any other spec still points at the old id.
      const baseStatus = parseSpec(c.base ?? '').data?.status;
      if (!['draft', 'approved'].includes(baseStatus)) {
        errors.push(`${c.path}: a spec that is ${baseStatus} cannot be deleted or renamed`);
      } else if (kind === 'idea' || kind === 'build') {
        errors.push(`${c.path}: ${kind}/ branches may not delete specs`);
      }
      continue;
    }
    const { errors: errs, data } = validateSpec(c.head, { baseText: c.base });
    errors.push(...errs.map((e) => `${c.path}: ${e}`));
    const stem = c.path.split('/').pop().replace(/\.md$/, '');
    if (data?.id && data.id !== stem) errors.push(`${c.path}: file name must match id (${data.id}.md)`);
  }
  if (specs.length) errors.push(...validateTree(headSpecs));

  if (kind === 'idea') {
    for (const c of changes) {
      if (!inSpecDir(specDir, c.path)) errors.push(`${c.path}: idea/ branches may only touch ${specDir}/**`);
    }
    for (const c of specs) {
      if (c.base !== undefined && parseSpec(c.base).data?.status !== 'draft') {
        errors.push(`${c.path}: idea/ branches may not modify a non-draft spec`);
      }
      if (c.head !== undefined && parseSpec(c.head).data?.status !== 'draft') {
        errors.push(`${c.path}: idea/ specs must be draft`);
      }
    }
  } else if (kind === 'spec') {
    humanRequired.push('spec/ PRs need human approval');
    for (const c of changes) {
      if (!inSpecDir(specDir, c.path)) errors.push(`${c.path}: spec/ branches may only touch ${specDir}/**`);
    }
  } else if (kind === 'build') {
    const id = headRef.slice('build/'.length);
    for (const c of specs) {
      if (c.status === 'D') continue;
      const baseStatus = parseSpec(c.base ?? '').data?.status;
      if (!['approved', 'implementing'].includes(baseStatus)) {
        errors.push(`${c.path}: build/ may only touch specs that are approved or implementing`);
      }
      if (acceptanceOf(c.base) !== acceptanceOf(c.head)) {
        humanRequired.push(`${c.path}: acceptance criteria changed during build`);
      }
      if (dependsOf(c.base) !== dependsOf(c.head)) {
        humanRequired.push(`${c.path}: depends_on changed during build`);
      }
    }
    for (const c of changes) {
      if (protectedRes.some((re) => re.test(c.path))) humanRequired.push(`${c.path}: protected path`);
    }

    const baseSpec = baseSpecs.find((s) => s.id === id);
    const headSpec = headSpecs.find((s) => s.id === id);
    if (!baseSpec) {
      errors.push(`build/${id}: there is no spec "${id}" on the base branch`);
    } else {
      // Never build on top of work that isn't finished.
      for (const dep of baseSpec.depends_on ?? []) {
        const d = baseSpecs.find((s) => s.id === dep);
        if (d?.status !== 'done') errors.push(`depends_on "${dep}" is not done (${d?.status ?? 'missing'})`);
      }
      if (!headSpec) errors.push(`build/${id}: spec "${id}" is missing from the PR`);
      else if (headSpec.status !== 'done') pending.push(`spec ${id} is ${headSpec.status}, not done yet`);
      else {
        const problems = checkEvidence({ headSpec, evidence });
        if (problems.length) pending.push(`AC evidence: ${problems.join('; ')}`);
      }
    }
  }
  // Any other branch is a normal human PR: only touched specs are validated.

  return { errors, humanRequired: [...new Set(humanRequired)], pending };
}

// The commit status the gate reports. Statuses are replaced per context, so approving flips
// pending to success; separate check runs from different events never replace one another,
// and GitHub would keep the old red one blocking the merge.
export function gateState({ errors, humanRequired, pending = [], approved }) {
  if (errors.length) return { state: 'failure', description: errors[0].slice(0, 130) };
  if (pending.length) return { state: 'pending', description: pending[0].slice(0, 130) };
  if (humanRequired.length && !approved) return { state: 'pending', description: 'Waiting for a human approval on the current commit' };
  return { state: 'success', description: humanRequired.length ? 'Approved by a human' : 'No human approval required' };
}

// Humans whose approval no longer counts and who should be asked again: their latest review was
// dismissed (GitHub does that on a push), or approved an older commit. GitHub does not re-request
// them itself. `alreadyRequested` is skipped so repeated gate runs do not nag.
export function reviewersToRerequest(reviews, headSha, prAuthor, alreadyRequested = []) {
  const latest = new Map();
  for (const r of reviews) latest.set(r.user?.login, r);
  return [...latest.values()]
    .filter((r) => r.user?.type === 'User' && r.user.login !== prAuthor
      && (r.state === 'DISMISSED' || (r.state === 'APPROVED' && r.commit_id !== headSha)))
    .map((r) => r.user.login)
    .filter((login) => !alreadyRequested.includes(login));
}

// An approval only counts for the commit it was given on: a push after the review makes it stale,
// so the author can't change a spec after sign-off. `headSha` is the PR head, not the merge commit.
export function hasHumanApproval(reviews, prAuthor, headSha) {
  const latest = new Map();
  for (const r of reviews) latest.set(r.user?.login, r);
  return [...latest.values()].some(
    (r) => r.state === 'APPROVED' && r.user?.type === 'User' && r.user.login !== prAuthor
      && (!headSha || r.commit_id === headSha),
  );
}
