import { isArchived } from './gate.mjs';

/**
 * Which done specs the archive command should move, and which it leaves with a reason.
 *   specs            every spec on the default branch, { id, status, path }
 *   evidenceIds      ids that have an evidence file at the active path
 *   priorArchiveIds  ids that have had an archive/<id> branch or PR in any state
 * Returns { moves: [{ id, path }], skipped: [{ id, reason }] }.
 */
export function planArchive({ archive, specs = [], evidenceIds = [], priorArchiveIds = [], specDir = 'specs' }) {
  const moves = [];
  const skipped = [];
  if (archive !== true) return { moves, skipped };
  const evidence = new Set(evidenceIds);
  const prior = new Set(priorArchiveIds);
  for (const s of specs) {
    if (s.status !== 'done' || isArchived(specDir, s.path)) continue;
    if (s.path.split('/').pop() !== `${s.id}.md`) skipped.push({ id: s.id, reason: `file name does not match id (${s.path})` });
    else if (prior.has(s.id)) skipped.push({ id: s.id, reason: `a prior archive/${s.id} PR exists; reopen it by hand` });
    else if (!evidence.has(s.id)) skipped.push({ id: s.id, reason: 'no evidence file' });
    else moves.push({ id: s.id, path: s.path });
  }
  return { moves, skipped };
}
