import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The committed dist/ bundles are what repos actually run, so exercise them, not just src/.
const run = (file, args = [], env = {}) =>
  spawnSync('node', [file, ...args], { encoding: 'utf8', env: { PATH: process.env.PATH, HOME: mkdtempSync(join(tmpdir(), 'sf-')), ...env } });

test('dist/validate-cli passes a valid spec and fails an invalid one', () => {
  const ok = run('dist/validate-cli.mjs', ['test/fixtures/fixture.md']);
  assert.equal(ok.status, 0, ok.stderr);
  const dir = mkdtempSync(join(tmpdir(), 'sf-'));
  const bad = join(dir, 'bad.md');
  writeFileSync(bad, '---\nspecforge: 1\nid: Bad Id\n---\n');
  assert.equal(run('dist/validate-cli.mjs', [bad]).status, 1);
});

for (const f of ['gate-cli', 'mint-app-token', 'sweep']) {
  test(`dist/${f} loads without a module error`, () => {
    const r = run(`dist/${f}.mjs`);
    assert.doesNotMatch(r.stderr, /Dynamic require|Cannot find module|SyntaxError|ERR_/, r.stderr);
  });
}
