import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { parse } from 'yaml';
import { evaluateGate, hasHumanApproval, gateState, reviewersToRerequest, evidencePath, DEFAULT_PROTECTED } from './gate.mjs';
import { git, show, specsAt } from './spec-tree.mjs';

// Reports the required commit status `specforge/gate` on the PR head commit.
// Env (set by the reusable workflow): HEAD_REF, BASE_REF, PR_AUTHOR, PR_HEAD_SHA, PR_NUMBER, GH_TOKEN, GITHUB_REPOSITORY
const env = process.env;

const cfg = existsSync('.specforge/config.yml') ? parse(readFileSync('.specforge/config.yml', 'utf8')) ?? {} : {};
const specDir = cfg.spec_dir ?? 'specs';
const protectedPaths = [...DEFAULT_PROTECTED, ...(cfg.protected_paths ?? [])];

const baseRef = `origin/${env.BASE_REF}`;
const changes = git('diff', '--name-status', '--no-renames', `${baseRef}...HEAD`)
  .split('\n').filter(Boolean).map((line) => {
    const [status, path] = line.split('\t');
    return {
      status, path,
      base: status === 'A' ? undefined : show(baseRef, path),
      head: status === 'D' ? undefined : show('HEAD', path),
    };
  });

const baseSpecs = specsAt(baseRef, specDir);
const headSpecs = specsAt('HEAD', specDir);

// For a build/ PR: the committed AC evidence, and whether it still describes what ships.
let evidence;
if (env.HEAD_REF.startsWith('build/')) {
  const path = evidencePath(specDir, env.HEAD_REF.slice('build/'.length));
  let json = null;
  try { json = JSON.parse(show(env.PR_HEAD_SHA, path) ?? 'null'); } catch { /* malformed: treated as missing */ }
  let ancestor = false;
  let changedSince = [];
  if (json?.sha) {
    try {
      git('merge-base', '--is-ancestor', json.sha, env.PR_HEAD_SHA);
      ancestor = true;
      changedSince = git('diff', '--name-only', json.sha, env.PR_HEAD_SHA).split('\n').filter(Boolean);
    } catch { /* not an ancestor, or unknown commit */ }
  }
  evidence = { path, json, ancestor, changedSince };
}

const { errors, humanRequired, pending } = evaluateGate({ headRef: env.HEAD_REF, changes, specDir, protectedPaths, baseSpecs, headSpecs, evidence });

let approved = false;
let reviews = [];
if (humanRequired.length && !errors.length) {
  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/pulls/${env.PR_NUMBER}/reviews?per_page=100`, {
    headers: { authorization: `Bearer ${env.GH_TOKEN}`, accept: 'application/vnd.github+json' },
  });
  if (!res.ok) { console.error(`could not list reviews: ${res.status}`); process.exit(1); }
  reviews = await res.json();
  approved = hasHumanApproval(reviews, env.PR_AUTHOR, env.PR_HEAD_SHA);
}

const lines = [`### specforge/gate: \`${env.HEAD_REF}\``];
for (const e of errors) lines.push(`- ❌ ${e}`);
for (const p of pending) lines.push(`- ⏳ ${p}`);
for (const h of humanRequired) lines.push(`- ${approved ? '✅' : '⏳'} ${h}${approved ? ' (human approved)' : ' (waiting for human approval)'}`);
if (!errors.length && !pending.length && !humanRequired.length) lines.push('- ✅ no human approval required');
console.log(lines.join('\n'));
if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');

const { state, description } = gateState({ errors, humanRequired, pending, approved });
const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/statuses/${env.PR_HEAD_SHA}`, {
  method: 'POST',
  headers: { authorization: `Bearer ${env.GH_TOKEN}`, accept: 'application/vnd.github+json' },
  body: JSON.stringify({ state, context: 'specforge/gate', description, target_url: `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}` }),
});
if (!res.ok) { console.error(`could not post the gate status: ${res.status} ${await res.text()}`); process.exit(1); }
console.log(`specforge/gate: ${state} (${description})`);
// While waiting for a human, ask again whoever's approval went stale. Never fails the gate.
if (state === 'pending' && humanRequired.length && !approved) {
  try {
    const gh = (path, init = {}) => fetch(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}${path}`, {
      ...init, headers: { authorization: `Bearer ${env.GH_TOKEN}`, accept: 'application/vnd.github+json' },
    });
    const pr = await (await gh(`/pulls/${env.PR_NUMBER}`)).json();
    const again = reviewersToRerequest(reviews, env.PR_HEAD_SHA, env.PR_AUTHOR, (pr.requested_reviewers ?? []).map((u) => u.login));
    if (again.length) {
      const r = await gh(`/pulls/${env.PR_NUMBER}/requested_reviewers`, { method: 'POST', body: JSON.stringify({ reviewers: again }) });
      console.log(r.ok ? `re-requested review from ${again.join(', ')}` : `could not re-request review (${r.status})`);
    }
  } catch (e) {
    console.warn(`could not re-request review: ${e.message}`);
  }
}
// The status is what branch protection requires. The job only turns red for real violations,
// not while it is waiting for a human.
process.exit(state === 'failure' ? 1 : 0);
