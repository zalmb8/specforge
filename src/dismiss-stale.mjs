// Dismiss human approvals that were given on an older commit than the PR head, then ask the
// same reviewers again, so GitHub's own "approved" state matches what the gate will accept.
// Native "dismiss stale approvals" needs branch protection, which free private repos lack.

// Latest review per human; keep those that approved a commit other than headSha.
export function staleApprovals(reviews, headSha, prAuthor) {
  const latest = new Map();
  for (const r of reviews) latest.set(r.user?.login, r);
  return [...latest.values()].filter(
    (r) => r.state === 'APPROVED' && r.user?.type === 'User' && r.user.login !== prAuthor && r.commit_id !== headSha,
  );
}

// Only run as a CLI, so tests can import staleApprovals without side effects.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('dismiss-stale.mjs')) {
  const [repo, number] = process.argv.slice(2);
  if (!repo || !number || !process.env.GH_TOKEN) {
    console.error('usage: GH_TOKEN=... dismiss-stale <owner/repo> <pr-number>');
    process.exit(2);
  }
  const api = async (path, init = {}) => {
    const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${process.env.GH_TOKEN}`, accept: 'application/vnd.github+json' },
    });
    return { ok: res.ok, status: res.status, body: await res.json().catch(() => ({})) };
  };

  const pr = await api(`/pulls/${number}`);
  const reviews = await api(`/pulls/${number}/reviews?per_page=100`);
  if (!pr.ok || !reviews.ok) { console.error(`cannot read PR or reviews (${pr.status}/${reviews.status})`); process.exit(1); }

  const head = pr.body.head.sha;
  const stale = staleApprovals(reviews.body, head, pr.body.user.login);
  if (!stale.length) { console.log('no stale approvals'); process.exit(0); }

  const dismissed = [];
  for (const r of stale) {
    const d = await api(`/pulls/${number}/reviews/${r.id}/dismissals`, {
      method: 'PUT',
      body: JSON.stringify({ message: `Dismissed: new commits were pushed after this approval (approved ${r.commit_id.slice(0, 7)}, now ${head.slice(0, 7)}). Please review again.` }),
    });
    if (d.ok) dismissed.push(r.user.login);
    else console.warn(`could not dismiss ${r.user.login}'s review: ${d.status} ${d.body.message}`);
  }
  if (dismissed.length) {
    const rr = await api(`/pulls/${number}/requested_reviewers`, { method: 'POST', body: JSON.stringify({ reviewers: dismissed }) });
    if (!rr.ok) console.warn(`dismissed, but could not re-request review: ${rr.status} ${rr.body.message}`);
    console.log(`dismissed stale approval from ${dismissed.join(', ')} and re-requested review`);
  }
}
