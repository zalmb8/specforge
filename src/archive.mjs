import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parse } from 'yaml';
import { evidencePath, archivePath, archiveEvidencePath } from './gate.mjs';
import { planArchive } from './archive-plan.mjs';
import { git, show, specsAt } from './spec-tree.mjs';
import { parseSpec } from './spec.mjs';

// usage: archive [--apply]
// Opens one archive/<id> PR per done spec on the default branch, moving the spec and its evidence into
// <spec_dir>/archive/. Does nothing unless `archive: true` is set in .specforge/config.yml. Dry run unless --apply.
// Needs GH_TOKEN (the app token, from mint-app-token.mjs); it never falls back to the user's own credentials.
const apply = process.argv.slice(2).includes('--apply');
const cfg = existsSync('.specforge/config.yml') ? parse(readFileSync('.specforge/config.yml', 'utf8')) ?? {} : {};
if (cfg.archive !== true) {
  console.log('archiving is not enabled: set `archive: true` in .specforge/config.yml');
  process.exit(0);
}
const specDir = cfg.spec_dir ?? 'specs';
const branch = cfg.default_branch ?? 'main';
const token = process.env.GH_TOKEN;
if (!token) {
  console.error('archive: GH_TOKEN is not set; mint the app token first (node <plugin>/dist/mint-app-token.mjs)');
  process.exit(2);
}

const run = (cmd, a, opts = {}) => execFileSync(cmd, a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
const asApp = ['-c', 'credential.helper=', '-c', `credential.helper=!f() { echo username=x-access-token; echo password=${token}; }; f`];

try {
  git(...asApp, 'fetch', 'origin', branch);
} catch (e) {
  console.error(`archive: could not fetch origin ${branch} as the app, stopping: ${String(e.stderr || e.message).split('\n')[0]}`);
  process.exit(1);
}

const ref = `origin/${branch}`;
const specs = specsAt(ref, specDir);
const evidenceIds = git('ls-tree', '-r', '--name-only', ref, '--', `${specDir}/evidence/`)
  .split('\n').filter((n) => n.endsWith('.json')).map((n) => n.split('/').pop().replace(/\.json$/, ''));
// Head branches are deleted after a merge, so the PR history is the record of what was ever tried.
const prior = new Set();
try {
  const refs = run('gh', ['api', '--paginate', 'repos/{owner}/{repo}/pulls?state=all&per_page=100', '--jq', '.[].head.ref']);
  for (const r of refs.split('\n')) if (r.startsWith('archive/')) prior.add(r.slice('archive/'.length));
  for (const l of git('ls-remote', '--heads', 'origin', 'archive/*').split('\n').filter(Boolean)) prior.add(l.split('refs/heads/archive/')[1]);
} catch (e) {
  console.error(`archive: could not read the PR history, stopping: ${String(e.stderr || e.message).split('\n')[0]}`);
  process.exit(1);
}

const { moves, skipped } = planArchive({ archive: true, specs, evidenceIds, priorArchiveIds: [...prior], specDir });
console.log(`${apply ? 'archiving' : 'would archive'} ${moves.length}:`);
for (const m of moves) console.log(`  - ${m.id}`);
console.log(`skipped ${skipped.length}:`);
for (const s of skipped) console.log(`  - ${s.id}: ${s.reason}`);

if (apply) {
  for (const { id, path } of moves) {
    try {
      const title = parseSpec(show(ref, path) ?? '').data?.title ?? id;
      const created = JSON.parse(run('orca', ['worktree', 'create', '--name', `archive-${id}`, '--no-parent', '--base-branch', ref, '--branch', `archive/${id}`, '--json'])).result;
      const cwd = created.worktree?.path ?? created.path;
      const g = (...a) => run('git', a, { cwd });
      mkdirSync(`${cwd}/${specDir}/archive/evidence`, { recursive: true });
      g('mv', '--', path, archivePath(specDir, id));
      g('mv', evidencePath(specDir, id), archiveEvidencePath(specDir, id));
      g('commit', '-m', `Archive ${id}\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`);
      run('git', [...asApp, 'push', '-u', 'origin', `archive/${id}`], { cwd });
      const url = run('gh', ['pr', 'create', '--base', branch, '--head', `archive/${id}`, '--title', `archive: ${title}`,
        '--body', `Moves the done spec \`${id}\` and its evidence into \`${specDir}/archive/\`, content unchanged.\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)`], { cwd, env: process.env }).trim();
      run('gh', ['pr', 'merge', url, '--squash', '--auto'], { cwd, env: process.env });
      console.log(`opened ${url}`);
    } catch (e) {
      console.error(`archive: ${id} failed, stopping: ${String(e.stderr || e.message).split('\n')[0]}`);
      process.exit(1);
    }
  }
}
