import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSpec, openQuestions } from '../src/spec.mjs';
import { evaluateGate, hasHumanApproval } from '../src/gate.mjs';

const spec = ({ status = 'draft', questions = '', acs = '', id = 'retry-queue' } = {}) => `---
specforge: 1
id: ${id}
title: Retry queue
status: ${status}
acceptance:${acs || ' []'}
---

## Summary
x

## Open questions
${questions}
`;
const AC = '\n  - id: AC-1\n    text: backs off\n    verify: tests/retry.test.ts::backs_off';

test('draft with open questions is valid', () => {
  assert.deepEqual(validateSpec(spec({ questions: '- [ ] how long?' })).errors, []);
});

test('approved requires zero open questions, ACs and verify', () => {
  const r = validateSpec(spec({ status: 'approved', questions: '- [ ] q' }), { baseText: spec({ status: 'refining' }) });
  assert.match(r.errors.join(), /open question/);
  assert.match(r.errors.join(), /at least one acceptance/);
  const ok = validateSpec(spec({ status: 'approved', questions: '- [x] q', acs: AC }), { baseText: spec({ status: 'refining' }) });
  assert.deepEqual(ok.errors, []);
});

test('approved AC with TBD verify fails', () => {
  const acs = AC.replace('tests/retry.test.ts::backs_off', 'TBD');
  const r = validateSpec(spec({ status: 'approved', acs }), { baseText: spec({ status: 'refining' }) });
  assert.match(r.errors.join(), /verify is required/);
});

test('illegal transition and new non-draft spec', () => {
  assert.match(validateSpec(spec({ status: 'done', acs: AC }), { baseText: spec() }).errors.join(), /illegal status transition/);
  assert.match(validateSpec(spec({ status: 'refining' })).errors.join(), /must start as draft/);
});

test('openQuestions counts only unchecked items in the section', () => {
  assert.equal(openQuestions('## Open questions\n- [ ] a\n- [x] b\n- [ ] c\n## Next\n- [ ] not counted'), 2);
});

const change = (path, status, base, head) => ({ path, status, base, head });

test('idea/ may only add draft specs under specs/', () => {
  const ok = evaluateGate({ headRef: 'idea/x', changes: [change('specs/retry-queue.md', 'A', undefined, spec())] });
  assert.deepEqual([ok.errors, ok.humanRequired], [[], []]);
  const bad = evaluateGate({ headRef: 'idea/x', changes: [change('src/app.js', 'M', 'a', 'b')] });
  assert.match(bad.errors.join(), /may only touch/);
});

test('idea/ cannot modify an approved spec', () => {
  const r = evaluateGate({
    headRef: 'idea/x',
    changes: [change('specs/retry-queue.md', 'M', spec({ status: 'approved', acs: AC }), spec({ acs: AC }))],
  });
  assert.match(r.errors.join(), /non-draft/);
});

test('spec/ always needs a human', () => {
  const r = evaluateGate({ headRef: 'spec/x', changes: [change('specs/retry-queue.md', 'M', spec({ status: 'refining' }), spec({ status: 'refining' }))] });
  assert.equal(r.humanRequired.length, 1);
});

test('build/ escalates on AC change and protected paths', () => {
  const base = spec({ status: 'approved', acs: AC });
  const changedAc = spec({ status: 'implementing', acs: AC.replace('backs off', 'backs off slowly') });
  const r = evaluateGate({
    headRef: 'build/x',
    changes: [change('specs/retry-queue.md', 'M', base, changedAc), change('.github/workflows/ci.yml', 'M', 'a', 'b')],
  });
  assert.equal(r.errors.length, 0);
  assert.equal(r.humanRequired.length, 2);
});

test('build/ status-only change is autonomous; build of a draft is rejected', () => {
  const base = spec({ status: 'approved', acs: AC });
  const ok = evaluateGate({ headRef: 'build/x', changes: [change('specs/retry-queue.md', 'M', base, spec({ status: 'implementing', acs: AC }))] });
  assert.deepEqual([ok.errors, ok.humanRequired], [[], []]);
  const bad = evaluateGate({ headRef: 'build/x', changes: [change('specs/retry-queue.md', 'M', spec(), spec())] });
  assert.match(bad.errors.join(), /approved or implementing/);
});

test('human approval ignores bots, the author, and superseded reviews', () => {
  const r = (login, type, state) => ({ user: { login, type }, state });
  assert.equal(hasHumanApproval([r('app[bot]', 'Bot', 'APPROVED')], 'app[bot]'), false);
  assert.equal(hasHumanApproval([r('me', 'User', 'APPROVED')], 'me'), false);
  assert.equal(hasHumanApproval([r('zach', 'User', 'APPROVED'), r('zach', 'User', 'CHANGES_REQUESTED')], 'app[bot]'), false);
  assert.equal(hasHumanApproval([r('zach', 'User', 'APPROVED')], 'app[bot]'), true);
});

import { decideMerge } from '../src/merge.mjs';

test('decideMerge waits for the gate, refuses on red, merges when all green', () => {
  const gate = (o) => ({ name: 'gate / specforge/gate', status: 'completed', conclusion: 'success', ...o });
  assert.equal(decideMerge([{ name: 'test', status: 'completed', conclusion: 'success' }]).state, 'wait');
  assert.equal(decideMerge([gate({ status: 'in_progress', conclusion: null })]).state, 'wait');
  assert.equal(decideMerge([gate({ conclusion: 'failure' })]).state, 'refuse');
  assert.equal(decideMerge([gate(), { name: 'test', status: 'completed', conclusion: 'failure' }]).state, 'refuse');
  assert.equal(decideMerge([gate(), { name: 'test', status: 'completed', conclusion: 'success' }]).state, 'merge');
});

test('spec file name must match its id', () => {
  const r = evaluateGate({ headRef: 'idea/x', changes: [change('specs/other-name.md', 'A', undefined, spec())] });
  assert.match(r.errors.join(), /file name must match id/);
});

test('decideMerge waits on a red gate only while a spec/ PR awaits its human', () => {
  const gate = { name: 'gate / specforge/gate', status: 'completed', conclusion: 'failure' };
  const test_ = { name: 'test', status: 'completed', conclusion: 'success' };
  assert.equal(decideMerge([gate, test_], { awaitingHuman: true }).state, 'wait');
  assert.equal(decideMerge([gate, test_], { awaitingHuman: false }).state, 'refuse');
  // another failing check is never excused by the pending approval
  assert.equal(decideMerge([gate, { ...test_, conclusion: 'failure' }], { awaitingHuman: true }).state, 'refuse');
});

test('a refine PR may go straight from draft to approved', () => {
  const approved = spec({ status: 'approved', questions: '- [x] q', acs: AC });
  assert.deepEqual(validateSpec(approved, { baseText: spec() }).errors, []);
});
