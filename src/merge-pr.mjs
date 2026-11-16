import { decideMerge } from './merge.mjs';
import { hasHumanApproval } from './gate.mjs';

// usage: merge-pr <owner/repo> <pr-number> [--timeout-s 600]
// Env: GH_TOKEN (an app installation token). Merges (squash) only when the gate and every check are green.
// This is the only sanctioned way for agents to merge: repos without branch protection
// (free private plans) get no server-side enforcement, so the script enforces it.
const [repo, number, ...rest] = process.argv.slice(2);
const timeoutS = Number(rest[rest.indexOf('--timeout-s') + 1]) || 600;
if (!repo || !number || !process.env.GH_TOKEN) {
  console.error('usage: GH_TOKEN=... merge-pr <owner/repo> <pr-number> [--timeout-s N]');
  process.exit(2);
}

const api = async (path, init = {}) => {
  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${process.env.GH_TOKEN}`, accept: 'application/vnd.github+json', ...init.headers },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
};

const deadline = Date.now() + timeoutS * 1000;
for (;;) {
  const pr = await api(`/pulls/${number}`);
  if (!pr.ok) { console.error(`cannot read PR: ${pr.status}`); process.exit(1); }
  if (pr.body.merged) { console.log('already merged'); process.exit(0); }
  if (pr.body.state !== 'open') { console.error('PR is not open'); process.exit(1); }

  const sha = pr.body.head.sha;
  const runs = await api(`/commits/${sha}/check-runs?per_page=100`);
  if (!runs.ok) { console.error(`cannot read checks: ${runs.status}`); process.exit(1); }
  let awaitingHuman = false;
  if (pr.body.head.ref.startsWith('spec/')) {
    const reviews = await api(`/pulls/${number}/reviews?per_page=100`);
    awaitingHuman = !(reviews.ok && hasHumanApproval(reviews.body, pr.body.user.login));
  }
  const verdict = decideMerge(runs.body.check_runs, { awaitingHuman });

  if (verdict.state === 'refuse') { console.error(`refusing to merge: ${verdict.reason}`); process.exit(1); }
  if (verdict.state === 'merge') {
    const m = await api(`/pulls/${number}/merge`, {
      method: 'PUT',
      body: JSON.stringify({ merge_method: 'squash', sha }), // sha pins the merge to the commit we checked
    });
    if (!m.ok) { console.error(`merge failed: ${m.status} ${m.body.message}`); process.exit(1); }
    await api(`/git/refs/heads/${pr.body.head.ref}`, { method: 'DELETE' }); // best effort
    console.log(`merged #${number}`);
    process.exit(0);
  }
  if (Date.now() > deadline) { console.error(`timed out: ${verdict.reason}`); process.exit(1); }
  await new Promise((r) => setTimeout(r, 10000));
}
