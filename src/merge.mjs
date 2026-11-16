// Pure merge decision, kept separate from the network code so it can be unit tested.
const GATE = /(^|\/|\s)specforge\/gate$/;
const OK = new Set(['success', 'skipped', 'neutral']);

// A check re-run (for example the gate re-running on a review) leaves the older run listed
// beside the new one. Only the most recent run of each check name counts.
function latestPerName(runs) {
  const latest = new Map();
  for (const r of runs) {
    const prev = latest.get(r.name);
    const newer = !prev || (r.id ?? 0) > (prev.id ?? 0);
    if (newer) latest.set(r.name, r);
  }
  return [...latest.values()];
}

/**
 * checkRuns: [{ name, status, conclusion }] for the PR head commit.
 * awaitingHuman: a spec/ PR with no human approval yet. Its gate is red by design, so that
 * is a wait, not a refusal; the gate re-runs when the review lands.
 * Returns { state: 'merge' | 'wait' | 'refuse', reason }.
 * Refuses (never merges) unless the specforge gate ran and every check passed.
 */
export function decideMerge(allRuns, { awaitingHuman = false, ignoreJob } = {}) {
  // The merge job calls this while its own check is still running; it must not wait on itself.
  const others = ignoreJob ? allRuns.filter((r) => r.name !== ignoreJob && !r.name.endsWith(` / ${ignoreJob}`)) : allRuns;
  const checkRuns = latestPerName(others);
  const gate = checkRuns.find((r) => GATE.test(r.name));
  if (!gate) return { state: 'wait', reason: 'specforge/gate has not reported yet' };
  const pending = checkRuns.filter((r) => r.status !== 'completed');
  if (pending.length) return { state: 'wait', reason: `still running: ${pending.map((r) => r.name).join(', ')}` };
  const bad = checkRuns.filter((r) => !OK.has(r.conclusion));
  if (awaitingHuman && bad.length === 1 && bad[0] === gate) {
    return { state: 'wait', reason: 'waiting for a human approval' };
  }
  if (bad.length) return { state: 'refuse', reason: `not green: ${bad.map((r) => `${r.name}=${r.conclusion}`).join(', ')}` };
  return { state: 'merge', reason: 'gate and all checks passed' };
}
