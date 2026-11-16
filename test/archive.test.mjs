import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateTree } from '../src/spec.mjs';
import { evaluateGate, gateState, evidencePath, archivePath, archiveEvidencePath } from '../src/gate.mjs';
import { specsAt } from '../src/spec-tree.mjs';
import { planArchive } from '../src/archive-plan.mjs';
import { SWEEP_PREFIXES } from '../src/prefixes.mjs';

const spec = ({ id = 'retry-queue', status = 'done', deps, extra = '' } = {}) => `---
specforge: 1
id: ${id}
title: Retry queue
status: ${status}
${deps ? `depends_on: [${deps}]\n` : ''}acceptance:
  - id: AC-1
    text: backs off
    verify: npm test
---

## Summary
x${extra}

## Open questions
- [x] done
`;
const ev = (id = 'retry-queue') => JSON.stringify({ specforge: 1, spec: id, results: [] });
const ch = (path, status, base, head) => ({ path, status, base, head });
const sp = (id, status = 'done', depends_on = []) => ({ id, status, depends_on, acceptance: [] });

const D = 'specs';
// The four changes of a clean archive move of `id`.
const move = (id = 'retry-queue', { text = spec({ id }), evText = ev(id) } = {}) => [
  ch(`${D}/${id}.md`, 'D', text, undefined),
  ch(evidencePath(D, id), 'D', evText, undefined),
  ch(archivePath(D, id), 'A', undefined, text),
  ch(archiveEvidencePath(D, id), 'A', undefined, evText),
];
// A restore is the move in reverse.
const restore = (id = 'retry-queue', { text = spec({ id }), evText = ev(id) } = {}) => [
  ch(archivePath(D, id), 'D', text, undefined),
  ch(archiveEvidencePath(D, id), 'D', evText, undefined),
  ch(`${D}/${id}.md`, 'A', undefined, text),
  ch(evidencePath(D, id), 'A', undefined, evText),
];
const gate = (headRef, changes, more = {}) => evaluateGate({ headRef, changes, specDir: D, ...more });
const summary = (r) => [r.errors, r.humanRequired, r.pending];

test('archive: validateTree resolves a dependency on an archived spec', () => {
  assert.deepEqual(validateTree([sp('a', 'approved', ['b']), sp('b', 'done')]), []);
  // the same list as specsAt returns it: the archived spec is just another entry
  assert.match(validateTree([sp('a', 'approved', ['b'])]).join(), /"b" does not exist/);
});

test('archive: build gate dependency check sees archived specs', (t) => {
  const build = (baseSpecs) => {
    const base = [sp('feat', 'approved', ['dep']), ...baseSpecs];
    return gate('build/feat', [], { baseSpecs: base, headSpecs: base });
  };
  t.test('archived done dependency is satisfied', () => {
    assert.deepEqual(build([sp('dep', 'done')]).errors, []);
  });
  t.test('missing dependency still reported', () => {
    assert.match(build([]).errors.join(), /"dep" is not done \(missing\)/);
  });
  t.test('not-done dependency still reported', () => {
    assert.match(build([sp('dep', 'implementing')]).errors.join(), /"dep" is not done \(implementing\)/);
  });
});

test('archive: archived file name must match its id', () => {
  const text = spec({ id: 'retry-queue' });
  const r = gate('archive/other', [
    ch(`${D}/other.md`, 'D', text, undefined),
    ch(`${D}/archive/other.md`, 'A', undefined, text),
  ]);
  assert.match(r.errors.join(), /file name must match id/);
});

test('archive: the evidence must move byte-identical with the spec', (t) => {
  const id = 'retry-queue';
  const errs = (changes) => gate(`archive/${id}`, changes, { headSpecs: [sp(id)] }).errors.join('\n');
  t.test('evidence not added at the archive path', () => {
    assert.match(errs(move().filter((c) => c.path !== archiveEvidencePath(D, id))), /the evidence must be added to the archive/);
  });
  t.test('evidence content differs', () => {
    const c = move();
    c[3] = ch(archiveEvidencePath(D, id), 'A', undefined, ev(id) + ' ');
    assert.match(errs(c), /the archived evidence must be identical/);
  });
  t.test('active evidence not deleted', () => {
    assert.match(errs(move().filter((c) => c.path !== evidencePath(D, id))), /the active evidence must be deleted/);
  });
});

test('archive: a move leaves referrers valid and unchanged', () => {
  // the referrer a is not in the diff; only b moved
  const headSpecs = [sp('a', 'approved', ['b']), sp('b', 'done')];
  const r = gate('archive/b', move('b'), { headSpecs, baseSpecs: headSpecs });
  assert.deepEqual(r.errors, []);
});

test('archive: only done specs may be archived', (t) => {
  const text = spec({ status: 'approved' });
  for (const kind of ['archive', 'idea', 'spec', 'build']) {
    t.test(kind, () => {
      const r = gate(`${kind}/retry-queue`, move('retry-queue', { text }));
      assert.match(r.errors.join('\n'), /only done specs may be archived \(retry-queue is approved\)/);
    });
  }
});

test('archive: a clean move passes with no human', () => {
  const r = gate('archive/retry-queue', move(), { headSpecs: [sp('retry-queue')] });
  assert.deepEqual(summary(r), [[], [], []]);
  assert.equal(gateState({ ...r, approved: false }).state, 'success');
});

test('archive: deleting a done spec without moving it fails', (t) => {
  for (const kind of ['archive', 'idea', 'spec', 'build']) {
    t.test(kind, () => {
      const id = kind === 'archive' || kind === 'build' ? 'retry-queue' : 'x';
      const r = gate(`${kind}/${id}`, [ch(`${D}/retry-queue.md`, 'D', spec(), undefined)]);
      assert.match(r.errors.join('\n'), /a spec that is done cannot be deleted or renamed/);
      if (kind === 'archive') assert.match(r.errors.join('\n'), /must be added to the archive/);
    });
  }
});

test('archive: no archive leaves existing gate results unchanged', (t) => {
  const draft = spec({ status: 'draft' });
  const approved = spec({ status: 'approved' });
  const scenarios = {
    'idea add': [gate('idea/x', [ch(`${D}/retry-queue.md`, 'A', undefined, draft)]), [[], [], []]],
    'idea edit of approved': [
      gate('idea/x', [ch(`${D}/retry-queue.md`, 'M', approved, approved.replace('x\n', 'y\n'))]),
      [[`${D}/retry-queue.md: idea/ branches may not modify a non-draft spec`, `${D}/retry-queue.md: idea/ specs must be draft`], [], []],
    ],
    'spec edit': [
      gate('spec/x', [ch(`${D}/retry-queue.md`, 'M', draft, draft.replace('x\n', 'y\n'))]),
      [[], ['spec/ PRs need human approval'], []],
    ],
    'build with unbuilt dependency': [
      gate('build/feat', [], { baseSpecs: [sp('feat', 'approved', ['dep']), sp('dep', 'approved')], headSpecs: [sp('feat', 'approved', ['dep']), sp('dep', 'approved')] }),
      [['depends_on "dep" is not done (approved)'], [], ['spec feat is approved, not done yet']],
    ],
    'draft rename': [
      gate('spec/x', [
        ch(`${D}/retry-queue.md`, 'D', draft, undefined),
        ch(`${D}/retry-q.md`, 'A', undefined, draft.replace('id: retry-queue', 'id: retry-q')),
      ], { headSpecs: [sp('retry-q', 'draft')] }),
      [[], ['spec/ PRs need human approval'], []],
    ],
    'done delete': [
      gate('spec/x', [ch(`${D}/retry-queue.md`, 'D', spec(), undefined)]),
      [[`${D}/retry-queue.md: a spec that is done cannot be deleted or renamed`], ['spec/ PRs need human approval'], []],
    ],
  };
  for (const [name, [got, want]] of Object.entries(scenarios)) {
    t.test(name, () => assert.deepEqual(summary(got), want));
  }
});

// A scratch git repo, since specsAt shells out to git.
const repo = () => {
  const dir = mkdtempSync(join(tmpdir(), 'sf-arch-'));
  const g = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' });
  g('init', '-q', '-b', 'main');
  g('config', 'user.email', 't@example.com');
  g('config', 'user.name', 't');
  return { dir, g };
};

test('archive: specsAt lists archived specs in a real repo', () => {
  const { dir, g } = repo();
  mkdirSync(join(dir, 'specs/archive/evidence'), { recursive: true });
  mkdirSync(join(dir, 'specs/evidence'), { recursive: true });
  writeFileSync(join(dir, 'specs/live.md'), spec({ id: 'live', status: 'approved' }));
  writeFileSync(join(dir, 'specs/archive/old.md'), spec({ id: 'old' }));
  writeFileSync(join(dir, 'specs/archive/evidence/old.json'), ev('old'));
  writeFileSync(join(dir, 'specs/evidence/live.json'), ev('live'));
  g('add', '-A');
  g('commit', '-qm', 'x');
  const got = specsAt('HEAD', 'specs', dir);
  assert.deepEqual(got.map((s) => [s.id, s.status, s.path]).sort(), [
    ['live', 'approved', 'specs/live.md'],
    ['old', 'done', 'specs/archive/old.md'],
  ]);
  assert.deepEqual(Object.keys(got[0]).sort(), ['acceptance', 'depends_on', 'id', 'path', 'status']);
  assert.deepEqual(specsAt('HEAD', 'nope', dir), []);
});

test('archive: planArchive picks exactly the done unarchived specs', (t) => {
  const specs = [
    { id: 'a', status: 'done', path: 'specs/a.md' },
    { id: 'b', status: 'approved', path: 'specs/b.md' },
    { id: 'c', status: 'done', path: 'specs/archive/c.md' },
    { id: 'd', status: 'done', path: 'specs/d.md' },
    { id: 'e', status: 'done', path: 'specs/e.md' },
  ];
  const base = { specs, evidenceIds: ['a', 'b', 'd'], priorArchiveIds: ['d'] };
  t.test('moves only done, unarchived, with evidence, no prior PR', () => {
    const r = planArchive({ archive: true, ...base });
    assert.deepEqual(r.moves.map((m) => m.id), ['a']);
    assert.deepEqual(r.skipped.map((s) => s.id).sort(), ['d', 'e']);
    assert.match(r.skipped.find((s) => s.id === 'd').reason, /prior|PR/i);
    assert.match(r.skipped.find((s) => s.id === 'e').reason, /evidence/i);
  });
  t.test('no moves when archive is not true', () => {
    for (const archive of [false, undefined, 'yes']) {
      assert.deepEqual(planArchive({ archive, ...base }).moves, []);
    }
  });
});

test('archive: the sweep prefix list includes archive', () => {
  assert.deepEqual(SWEEP_PREFIXES, ['idea/', 'spec/', 'build/', 'archive/']);
});

test('archive: archived files are immutable', (t) => {
  const text = spec();
  for (const kind of ['archive', 'idea', 'spec', 'build']) {
    for (const [what, p] of [['spec', archivePath(D, 'retry-queue')], ['evidence', archiveEvidencePath(D, 'retry-queue')]]) {
      t.test(`${kind} modifies archived ${what}`, () => {
        const isSpec = what === 'spec';
        const r = gate(`${kind}/retry-queue`, [ch(p, 'M', isSpec ? text : ev(), isSpec ? text.replace('x\n', 'y\n') : ev() + ' ')]);
        assert.match(r.errors.join(), /immutable/);
      });
    }
  }
});

test('archive: archived files are immutable when deleted alone', (t) => {
  for (const kind of ['archive', 'idea', 'spec', 'build']) {
    t.test(`${kind} deletes one archived file`, () => {
      const r = gate(`${kind}/retry-queue`, [ch(archivePath(D, 'retry-queue'), 'D', spec(), undefined)]);
      assert.match(r.errors.join('\n'), /immutable/);
    });
  }
});

test('archive: restore needs a spec branch and a human', (t) => {
  const id = 'retry-queue';
  t.test('spec/ restore is allowed and needs a human', () => {
    const r = gate(`spec/${id}`, restore(), { headSpecs: [sp(id)] });
    assert.deepEqual(r.errors, []);
    assert.ok(r.humanRequired.some((h) => /restore/.test(h)));
  });
  for (const kind of ['idea', 'build', 'archive']) {
    t.test(`${kind}/ restore is an error`, () => {
      assert.match(gate(`${kind}/${id}`, restore(), { headSpecs: [sp(id)] }).errors.join('\n'), /restore of retry-queue: needs a spec\/ branch/);
    });
  }
  t.test('restore with changed content is an error', () => {
    const c = restore();
    c[2] = ch(`${D}/${id}.md`, 'A', undefined, spec({ extra: ' changed' }));
    assert.match(gate(`spec/${id}`, c, { headSpecs: [sp(id)] }).errors.join('\n'), /restore of retry-queue: .*must be added unchanged/);
  });
  t.test('restore with changed evidence is an error', () => {
    const c = restore();
    c[3] = ch(evidencePath(D, id), 'A', undefined, ev(id) + ' ');
    assert.match(gate(`spec/${id}`, c, { headSpecs: [sp(id)] }).errors.join('\n'), /restore of retry-queue: .*must be added unchanged/);
  });
  t.test('restoring only the spec is an error', () => {
    const c = restore().filter((x) => !x.path.endsWith('.json'));
    assert.match(gate(`spec/${id}`, c, { headSpecs: [sp(id)] }).errors.join('\n'), /must restore both the spec and its evidence/);
  });
  t.test('restoring only the evidence is an error', () => {
    const c = restore().filter((x) => x.path.endsWith('.json'));
    assert.match(gate(`spec/${id}`, c, { headSpecs: [sp(id)] }).errors.join('\n'), /must restore both the spec and its evidence/);
  });
  t.test('restoring a spec that is not done is an error', () => {
    const r = gate(`spec/${id}`, restore(id, { text: spec({ status: 'approved' }) }), { headSpecs: [sp(id, 'approved')] });
    assert.match(r.errors.join('\n'), /only a done spec can be restored/);
  });
});

test('archive: an archive PR moves exactly its own spec', (t) => {
  const id = 'retry-queue';
  t.test('another path changed', () => {
    const r = gate(`archive/${id}`, [...move(), ch('README.md', 'M', 'a', 'b')], { headSpecs: [sp(id)] });
    assert.match(r.errors.join(), /README\.md/);
  });
  t.test("another spec's move", () => {
    const r = gate(`archive/${id}`, [...move(), ...move('other')], { headSpecs: [sp(id), sp('other')] });
    assert.match(r.errors.join('\n'), /may only move/);
  });
  t.test('spec id differs from the branch id', () => {
    const r = gate('archive/other', move('other', { text: spec({ id: 'retry-queue' }) }));
    assert.match(r.errors.join('\n'), /the moved spec's id must be other/);
  });
  t.test('a protected path needs a human', () => {
    const r = gate(`archive/${id}`, move(), { headSpecs: [sp(id)], protectedPaths: ['^specs/archive/'] });
    assert.deepEqual(r.errors, []);
    assert.ok(r.humanRequired.length > 0);
  });
});

test('archive: the command does nothing unless archive is true', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sf-cmd-'));
  const g = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' });
  g('init', '-q', '-b', 'main');
  g('config', 'user.email', 't@example.com');
  g('config', 'user.name', 't');
  mkdirSync(join(dir, '.specforge'));
  writeFileSync(join(dir, '.specforge/config.yml'), 'specforge: 1\nspec_dir: specs\ndefault_branch: main\n');
  g('add', '-A');
  g('commit', '-qm', 'x');
  const branches = g('branch', '--list');
  const worktrees = g('worktree', 'list');
  const bundle = fileURLToPath(new URL('../dist/archive.mjs', import.meta.url));
  const r = spawnSync('node', [bundle, '--apply'], { cwd: dir, encoding: 'utf8', env: { PATH: process.env.PATH, HOME: dir } });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /not enabled/i);
  assert.equal(g('branch', '--list'), branches);
  assert.equal(g('worktree', 'list'), worktrees);
});

test('archive: validateTree rejects a duplicate id across active and archived', () => {
  const errs = validateTree([sp('dup', 'done'), sp('dup', 'done')]);
  assert.match(errs.join(), /duplicate spec id "dup"/);
});
