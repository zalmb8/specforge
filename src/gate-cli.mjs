import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parse } from 'yaml';
import { evaluateGate, hasHumanApproval, gateState, DEFAULT_PROTECTED } from './gate.mjs';

// Reports the required commit status `specforge/gate` on the PR head commit.
// Env (set by the reusable workflow): HEAD_REF, BASE_REF, PR_AUTHOR, PR_HEAD_SHA, PR_NUMBER, GH_TOKEN, GITHUB_REPOSITORY
const env = process.env;
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const show = (ref, p) => {
  try { return git('show', `${ref}:${p}`); } catch { return undefined; }
};

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

const { errors, humanRequired } = evaluateGate({ headRef: env.HEAD_REF, changes, specDir, protectedPaths });

let approved = false;
if (humanRequired.length && !errors.length) {
  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/pulls/${env.PR_NUMBER}/reviews?per_page=100`, {
    headers: { authorization: `Bearer ${env.GH_TOKEN}`, accept: 'application/vnd.github+json' },
  });
  if (!res.ok) { console.error(`could not list reviews: ${res.status}`); process.exit(1); }
  approved = hasHumanApproval(await res.json(), env.PR_AUTHOR, env.PR_HEAD_SHA);
}

const lines = [`### specforge/gate: \`${env.HEAD_REF}\``];
for (const e of errors) lines.push(`- ❌ ${e}`);
for (const h of humanRequired) lines.push(`- ${approved ? '✅' : '⏳'} ${h}${approved ? ' (human approved)' : ' (waiting for human approval)'}`);
if (!errors.length && !humanRequired.length) lines.push('- ✅ no human approval required');
console.log(lines.join('\n'));
if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');

const { state, description } = gateState({ errors, humanRequired, approved });
const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/statuses/${env.PR_HEAD_SHA}`, {
  method: 'POST',
  headers: { authorization: `Bearer ${env.GH_TOKEN}`, accept: 'application/vnd.github+json' },
  body: JSON.stringify({ state, context: 'specforge/gate', description, target_url: `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}` }),
});
if (!res.ok) { console.error(`could not post the gate status: ${res.status} ${await res.text()}`); process.exit(1); }
console.log(`specforge/gate: ${state} (${description})`);
// The status is what branch protection requires. The job only turns red for real violations,
// not while it is waiting for a human.
process.exit(state === 'failure' ? 1 : 0);
