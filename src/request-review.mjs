import { readFileSync, existsSync } from 'node:fs';
import { parse } from 'yaml';
import { resolveReviewers } from './reviewers.mjs';

// usage: request-review <owner/repo> <pr-number>      (run from the repo checkout)
// Env: GH_TOKEN (app installation token). Requests the configured reviewers on a spec PR.
// Never fails the flow: a PR with no requested reviewer is still reviewable, so errors only warn.
const [repo, number] = process.argv.slice(2);
if (!repo || !number || !process.env.GH_TOKEN) {
  console.error('usage: GH_TOKEN=... request-review <owner/repo> <pr-number>');
  process.exit(2);
}

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : undefined);
const cfg = parse(read('.specforge/config.yml') ?? '') ?? {};
const codeowners = read('CODEOWNERS') ?? read('.github/CODEOWNERS') ?? read('docs/CODEOWNERS');

const api = async (path, init = {}) => {
  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${process.env.GH_TOKEN}`, accept: 'application/vnd.github+json' },
  });
  return { ok: res.ok, status: res.status, body: await res.json().catch(() => ({})) };
};

const pr = await api(`/pulls/${number}`);
if (!pr.ok) { console.warn(`request-review: cannot read PR (${pr.status})`); process.exit(0); }
const files = await api(`/pulls/${number}/files?per_page=100`);
const specPath = files.ok ? files.body.map((f) => f.filename).find((f) => f.startsWith(`${cfg.spec_dir ?? 'specs'}/`)) : undefined;

const { users, teams } = resolveReviewers({
  configReviewers: cfg.reviewers,
  codeowners,
  specPath: specPath ?? `${cfg.spec_dir ?? 'specs'}/`,
  author: pr.body.user?.login,
});
if (!users.length && !teams.length) {
  console.log('request-review: no reviewers configured (set `reviewers:` in .specforge/config.yml or add a CODEOWNERS entry)');
  process.exit(0);
}

const r = await api(`/pulls/${number}/requested_reviewers`, {
  method: 'POST',
  body: JSON.stringify({ reviewers: users, team_reviewers: teams }),
});
if (!r.ok) { console.warn(`request-review: GitHub refused (${r.status}): ${r.body.message}`); process.exit(0); }
console.log(`requested review from ${[...users, ...teams.map((t) => `team ${t}`)].join(', ')}`);
