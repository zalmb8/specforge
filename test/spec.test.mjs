import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSpec, validateTree, openQuestions } from '../src/spec.mjs';
import { evaluateGate, hasHumanApproval, checkEvidence, evidencePath } from '../src/gate.mjs';

const spec = ({ status = 'draft', questions = '', acs = '', id = 'retry-queue', deps } = {}) => `---
specforge: 1
id: ${id}
title: Retry queue
status: ${status}
${deps ? `depends_on: [${deps}]\n` : ''}acceptance:${acs || ' []'}
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

test('human approval ignores bots, the author, and superseded reviews', () => {
  const r = (login, type, state) => ({ user: { login, type }, state });
  assert.equal(hasHumanApproval([r('app[bot]', 'Bot', 'APPROVED')], 'app[bot]'), false);
  assert.equal(hasHumanApproval([r('me', 'User', 'APPROVED')], 'me'), false);
  assert.equal(hasHumanApproval([r('zach', 'User', 'APPROVED'), r('zach', 'User', 'CHANGES_REQUESTED')], 'app[bot]'), false);
  assert.equal(hasHumanApproval([r('zach', 'User', 'APPROVED')], 'app[bot]'), true);
});


test('spec file name must match its id', () => {
  const r = evaluateGate({ headRef: 'idea/x', changes: [change('specs/other-name.md', 'A', undefined, spec())] });
  assert.match(r.errors.join(), /file name must match id/);
});

test('a refine PR may go straight from draft to approved', () => {
  const approved = spec({ status: 'approved', questions: '- [x] q', acs: AC });
  assert.deepEqual(validateSpec(approved, { baseText: spec() }).errors, []);
});


test('human approval counts only for the current head commit', () => {
  const r = (login, commit_id, state = 'APPROVED') => ({ user: { login, type: 'User' }, state, commit_id });
  assert.equal(hasHumanApproval([r('zach', 'aaa')], 'app[bot]', 'aaa'), true);
  assert.equal(hasHumanApproval([r('zach', 'aaa')], 'app[bot]', 'bbb'), false); // pushed after approval
  assert.equal(hasHumanApproval([r('zach', 'aaa')], 'app[bot]'), true); // no head sha known: not enforced
});


import { gateState } from '../src/gate.mjs';

test('gateState: pending until a human approves, failure only for violations', () => {
  assert.equal(gateState({ errors: ['x'], humanRequired: [], approved: false }).state, 'failure');
  assert.equal(gateState({ errors: [], humanRequired: ['spec/ PRs need human approval'], approved: false }).state, 'pending');
  assert.equal(gateState({ errors: [], humanRequired: ['spec/ PRs need human approval'], approved: true }).state, 'success');
  assert.equal(gateState({ errors: [], humanRequired: [], approved: false }).state, 'success');
});

import { reviewersToRerequest } from '../src/gate.mjs';

test('reviewersToRerequest: dismissed or older-commit approvals, not already requested', () => {
  const r = (login, state, commit_id, type = 'User') => ({ user: { login, type }, state, commit_id });
  assert.deepEqual(reviewersToRerequest([r('zach', 'DISMISSED', 'old')], 'new', 'app'), ['zach']);
  assert.deepEqual(reviewersToRerequest([r('zach', 'APPROVED', 'old')], 'new', 'app'), ['zach']);
  assert.deepEqual(reviewersToRerequest([r('zach', 'APPROVED', 'new')], 'new', 'app'), []); // current approval
  assert.deepEqual(reviewersToRerequest([r('zach', 'DISMISSED', 'old')], 'new', 'app', ['zach']), []); // already asked
  assert.deepEqual(reviewersToRerequest([r('bot', 'DISMISSED', 'old', 'Bot'), r('app', 'DISMISSED', 'old')], 'new', 'app'), []);
  assert.deepEqual(reviewersToRerequest([r('zach', 'DISMISSED', 'old'), r('zach', 'APPROVED', 'new')], 'new', 'app'), []); // superseded
});

// ---- build flow: dependencies, deletions, evidence

const entry = (id, status, o = {}) => ({ id, status, depends_on: [], acceptance: [{ id: 'AC-1', text: 't', verify: 'v' }], ...o });

test('depends_on must be a list of valid ids, not self, no duplicates', () => {
  assert.deepEqual(validateSpec(spec({ deps: 'a, b' })).errors, []);
  assert.match(validateSpec(spec({ deps: 'retry-queue' })).errors.join(), /cannot depend on itself/);
  assert.match(validateSpec(spec({ deps: 'a, a' })).errors.join(), /duplicate depends_on/);
  assert.match(validateSpec(spec({ deps: 'Bad Id' })).errors.join(), /not a spec id/);
});

test('validateTree finds dangling references and cycles', () => {
  assert.deepEqual(validateTree([entry('a', 'done'), entry('b', 'draft', { depends_on: ['a'] })]), []);
  assert.match(validateTree([entry('b', 'draft', { depends_on: ['a'] })]).join(), /"a" does not exist/);
  assert.match(validateTree([entry('a', 'draft', { depends_on: ['b'] }), entry('b', 'draft', { depends_on: ['a'] })]).join(), /dependency cycle/);
});

test('a spec may be renamed or removed only while draft/approved and unreferenced', () => {
  const del = (status) => change('specs/old.md', 'D', spec({ status, id: 'old', acs: AC }), undefined);
  // draft, nothing points at it: allowed on a spec/ branch (human approval still required)
  const ok = evaluateGate({ headRef: 'spec/rename', changes: [del('draft')], baseSpecs: [entry('old', 'draft')], headSpecs: [] });
  assert.deepEqual(ok.errors, []);
  // another spec still points at the old id: the tree check fails the PR
  const dangling = evaluateGate({ headRef: 'spec/rename', changes: [del('draft')], baseSpecs: [entry('old', 'draft'), entry('b', 'draft', { depends_on: ['old'] })], headSpecs: [entry('b', 'draft', { depends_on: ['old'] })] });
  assert.match(dangling.errors.join(), /"old" does not exist/);
  // referrer updated in the same PR: fine
  const renamed = evaluateGate({ headRef: 'spec/rename', changes: [del('draft')], baseSpecs: [entry('old', 'draft'), entry('b', 'draft', { depends_on: ['old'] })], headSpecs: [entry('new', 'draft'), entry('b', 'draft', { depends_on: ['new'] })] });
  assert.deepEqual(renamed.errors, []);
  // built or in-flight specs keep their names, and idea/ and build/ never delete
  assert.match(evaluateGate({ headRef: 'spec/x', changes: [del('done')], baseSpecs: [], headSpecs: [] }).errors.join(), /cannot be deleted or renamed/);
  assert.match(evaluateGate({ headRef: 'idea/x', changes: [del('draft')], baseSpecs: [], headSpecs: [] }).errors.join(), /may not delete specs/);
});

const GOOD = { specforge: 1, spec: 'retry-queue', sha: 'abc', results: [{ id: 'AC-1', target: 'v', result: 'pass' }] };
const ev = (o = {}) => ({ path: evidencePath('specs', 'retry-queue'), json: GOOD, ancestor: true, changedSince: ['specs/evidence/retry-queue.json'], ...o });

test('checkEvidence: complete, matching, passing evidence on an unchanged tree is accepted', () => {
  assert.deepEqual(checkEvidence({ headSpec: entry('retry-queue', 'done'), evidence: ev() }), []);
});

test('checkEvidence rejects missing, failing, mismatched and stale evidence', () => {
  const h = entry('retry-queue', 'done');
  assert.match(checkEvidence({ headSpec: h, evidence: ev({ json: null }) }).join(), /no AC evidence/);
  assert.match(checkEvidence({ headSpec: h, evidence: ev({ json: { ...GOOD, results: [] } }) }).join(), /AC-1 has no evidence/);
  assert.match(checkEvidence({ headSpec: h, evidence: ev({ json: { ...GOOD, results: [{ id: 'AC-1', target: 'v', result: 'fail' }] } }) }).join(), /did not pass/);
  assert.match(checkEvidence({ headSpec: h, evidence: ev({ json: { ...GOOD, results: [{ id: 'AC-1', target: 'other', result: 'pass' }] } }) }).join(), /different verify target/);
  assert.match(checkEvidence({ headSpec: h, evidence: ev({ ancestor: false }) }).join(), /not part of this PR/);
  assert.match(checkEvidence({ headSpec: h, evidence: ev({ changedSince: ['src/app.js', 'specs/evidence/retry-queue.json'] }) }).join(), /changed after verification: src\/app.js/);
  assert.match(checkEvidence({ headSpec: h, evidence: ev({ json: { ...GOOD, spec: 'other' } }) }).join(), /different spec/);
});

test('build/: refuses unbuilt dependencies, stays pending until done with evidence', () => {
  const base = [entry('retry-queue', 'approved', { depends_on: ['dep'] }), entry('dep', 'approved')];
  const blocked = evaluateGate({ headRef: 'build/retry-queue', changes: [], baseSpecs: base, headSpecs: base });
  assert.match(blocked.errors.join(), /depends_on "dep" is not done \(approved\)/);

  const ready = [entry('retry-queue', 'approved', { depends_on: ['dep'] }), entry('dep', 'done')];
  const inProgress = evaluateGate({ headRef: 'build/retry-queue', changes: [], baseSpecs: ready, headSpecs: [entry('retry-queue', 'implementing', { depends_on: ['dep'] }), entry('dep', 'done')] });
  assert.deepEqual(inProgress.errors, []);
  assert.match(inProgress.pending.join(), /implementing, not done yet/);

  const done = [entry('retry-queue', 'done', { depends_on: ['dep'] }), entry('dep', 'done')];
  const noEvidence = evaluateGate({ headRef: 'build/retry-queue', changes: [], baseSpecs: ready, headSpecs: done, evidence: ev({ json: null }) });
  assert.match(noEvidence.pending.join(), /AC evidence: no AC evidence/);
  const finished = evaluateGate({ headRef: 'build/retry-queue', changes: [], baseSpecs: ready, headSpecs: done, evidence: ev() });
  assert.deepEqual([finished.errors, finished.pending, finished.humanRequired], [[], [], []]);
});

test('build/: AC or depends_on edits and protected paths need a human; a missing spec is an error', () => {
  const base = spec({ status: 'approved', acs: AC });
  const changedAc = spec({ status: 'implementing', acs: AC.replace('backs off', 'backs off slowly') });
  const baseSpecs = [entry('retry-queue', 'approved')];
  const r = evaluateGate({
    headRef: 'build/retry-queue', baseSpecs, headSpecs: [entry('retry-queue', 'implementing')],
    changes: [change('specs/retry-queue.md', 'M', base, changedAc), change('.github/workflows/ci.yml', 'M', 'a', 'b')],
  });
  assert.deepEqual(r.errors, []);
  assert.equal(r.humanRequired.length, 2);
  const withDeps = evaluateGate({
    headRef: 'build/retry-queue', baseSpecs, headSpecs: [entry('retry-queue', 'implementing', { depends_on: [] })],
    changes: [change('specs/retry-queue.md', 'M', base, spec({ status: 'implementing', acs: AC, deps: 'x' }))],
  });
  assert.match(withDeps.humanRequired.join(), /depends_on changed during build/);
  assert.match(evaluateGate({ headRef: 'build/nope', changes: [], baseSpecs, headSpecs: baseSpecs }).errors.join(), /no spec "nope" on the base branch/);
  const draft = evaluateGate({ headRef: 'build/retry-queue', baseSpecs, headSpecs: baseSpecs, changes: [change('specs/retry-queue.md', 'M', spec(), spec())] });
  assert.match(draft.errors.join(), /approved or implementing/);
});

test('a build PR may go straight from approved to done', () => {
  const approved = spec({ status: 'approved', questions: '- [x] q', acs: AC });
  const done = spec({ status: 'done', questions: '- [x] q', acs: AC });
  assert.deepEqual(validateSpec(done, { baseText: approved }).errors, []);
});

test('gateState: pending reasons win over a satisfied human approval, errors win over everything', () => {
  assert.equal(gateState({ errors: [], humanRequired: [], pending: ['AC evidence: missing'], approved: true }).state, 'pending');
  assert.equal(gateState({ errors: ['x'], humanRequired: [], pending: ['y'], approved: true }).state, 'failure');
  assert.equal(gateState({ errors: [], humanRequired: [], pending: [], approved: false }).state, 'success');
});
