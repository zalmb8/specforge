// Pure merge decision, kept separate from the network code so it can be unit tested.
const GATE = /(^|\/|\s)specforge\/gate$/;
const OK = new Set(['success', 'skipped', 'neutral']);

/**
 * checkRuns: [{ name, status, conclusion }] for the PR head commit.
 * awaitingHuman: a spec/ PR with no human approval yet. Its gate is red by design, so that
 * is a wait, not a refusal; the gate re-runs when the review lands.
 * Returns { state: 'merge' | 'wait' | 'refuse', reason }.
 * Refuses (never merges) unless the specforge gate ran and every check passed.
 */
export function decideMerge(checkRuns, { awaitingHuman = false } = {}) {
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
