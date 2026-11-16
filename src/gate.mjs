import { parseSpec, validateSpec } from './spec.mjs';

// Paths whose change always needs a human, whatever branch produced them.
// These are the rails that keep the automation honest, so it can't merge edits to itself.
// Repos extend this via `protected_paths` in .specforge/config.yml (regex strings).
export const DEFAULT_PROTECTED = ['^\\.github/', '^\\.specforge/', '^CODEOWNERS$'];

const inSpecDir = (specDir, p) => p.startsWith(`${specDir}/`) && p.endsWith('.md');
const acceptanceOf = (text) => JSON.stringify(parseSpec(text ?? '').data?.acceptance ?? null);

/**
 * Pure policy: decide what a PR needs, from its head branch and its changes.
 *
 * changes: [{ path, status: 'A'|'M'|'D', base?: string, head?: string }]
 * Returns { errors, humanRequired }. `errors` are hard failures. `humanRequired`
 * reasons are satisfied by an approving review from a human who isn't the PR author.
 */
export function evaluateGate({ headRef, changes, specDir = 'specs', protectedPaths = DEFAULT_PROTECTED }) {
  const protectedRes = protectedPaths.map((p) => new RegExp(p));
  const errors = [];
  const humanRequired = [];
  const kind = headRef.split('/')[0];
  const specs = changes.filter((c) => inSpecDir(specDir, c.path));

  for (const c of specs) {
    if (c.status === 'D') {
      errors.push(`${c.path}: specs must not be deleted by a PR`);
      continue;
    }
    const { errors: errs, data } = validateSpec(c.head, { baseText: c.base });
    errors.push(...errs.map((e) => `${c.path}: ${e}`));
    const stem = c.path.split('/').pop().replace(/\.md$/, '');
    if (data?.id && data.id !== stem) errors.push(`${c.path}: file name must match id (${data.id}.md)`);
  }

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
    for (const c of specs) {
      const baseStatus = parseSpec(c.base ?? '').data?.status;
      if (!['approved', 'implementing'].includes(baseStatus)) {
        errors.push(`${c.path}: build/ may only touch specs that are approved or implementing`);
      }
      if (acceptanceOf(c.base) !== acceptanceOf(c.head)) {
        humanRequired.push(`${c.path}: acceptance criteria changed during build`);
      }
    }
    for (const c of changes) {
      if (protectedRes.some((re) => re.test(c.path))) humanRequired.push(`${c.path}: protected path`);
    }
  }
  // Any other branch is a normal human PR: only touched specs are validated.

  return { errors, humanRequired: [...new Set(humanRequired)] };
}

// An approval only counts for the commit it was given on: a push after the review makes it stale,
// so the author can't change a spec after sign-off. `headSha` is the PR head, not the merge commit.
// The commit status the gate reports. Statuses are replaced per context, so approving flips
// pending to success; separate check runs from different events never replace one another,
// and GitHub would keep the old red one blocking the merge.
export function gateState({ errors, humanRequired, approved }) {
  if (errors.length) return { state: 'failure', description: errors[0].slice(0, 130) };
  if (humanRequired.length && !approved) return { state: 'pending', description: 'Waiting for a human approval on the current commit' };
  return { state: 'success', description: humanRequired.length ? 'Approved by a human' : 'No human approval required' };
}

export function hasHumanApproval(reviews, prAuthor, headSha) {
  const latest = new Map();
  for (const r of reviews) latest.set(r.user?.login, r);
  return [...latest.values()].some(
    (r) => r.state === 'APPROVED' && r.user?.type === 'User' && r.user.login !== prAuthor
      && (!headSha || r.commit_id === headSha),
  );
}
