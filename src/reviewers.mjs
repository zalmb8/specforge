// Who should be asked to review a spec PR. Pure, so it can be unit tested.
// Explicit `reviewers` in config wins; otherwise CODEOWNERS decides for the spec path.

const matches = (pattern, path) => {
  const p = pattern.replace(/\/\*\*$/, '/');
  if (p === '*' || p === '**' || p === '/*') return true;
  if (p.startsWith('*.')) return path.endsWith(p.slice(1));
  if (p.endsWith('/')) return path.startsWith(p.replace(/^\//, ''));
  return path === p.replace(/^\//, '');
};

// CODEOWNERS: the last matching line wins. Returns the owners for `path`, or [].
export function codeownersFor(text, path) {
  let owners = [];
  for (const raw of (text ?? '').split('\n')) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const [pattern, ...who] = line.split(/\s+/);
    if (matches(pattern, path)) owners = who;
  }
  return owners;
}

/**
 * Returns { users, teams } to request, never including the PR author.
 * Owners that are emails, or the author, are dropped; `@org/team` and `org/team` become teams.
 */
export function resolveReviewers({ configReviewers, codeowners, specPath, author }) {
  const raw = configReviewers?.length ? configReviewers : codeownersFor(codeowners, specPath);
  const users = new Set();
  const teams = new Set();
  for (const r of raw) {
    const name = String(r).replace(/^@/, '');
    if (name.includes('@')) continue; // an email owner can't be requested through the API
    if (name.includes('/')) teams.add(name.split('/')[1]);
    else if (name.toLowerCase() !== String(author ?? '').replace(/\[bot\]$/, '').toLowerCase()) users.add(name);
  }
  return { users: [...users], teams: [...teams] };
}
