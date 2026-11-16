import { execFileSync } from 'node:child_process';
import { parseSpec } from './spec.mjs';

// git helpers bound to a working directory (the process's own when `cwd` is undefined).
export const gitIn = (cwd) => {
  const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, cwd });
  const show = (ref, p) => {
    try { return git('show', `${ref}:${p}`); } catch { return undefined; }
  };
  return { git, show };
};
export const { git, show } = gitIn(undefined);

// Every spec at a ref, reduced to what the dependency and evidence rules need. `git ls-tree -r`
// lists nested files, so archived specs come back together with active ones; evidence is JSON and skipped.
export const specsAt = (ref, specDir, cwd) => {
  const { git: g, show: s } = gitIn(cwd);
  let names = [];
  try { names = g('ls-tree', '-r', '--name-only', ref, '--', `${specDir}/`).split('\n').filter((n) => n.endsWith('.md')); } catch { /* no spec dir yet */ }
  return names.map((path) => {
    const { data } = parseSpec(s(ref, path) ?? '');
    return data?.id ? { path, id: data.id, status: data.status, depends_on: data.depends_on ?? [], acceptance: data.acceptance ?? [] } : undefined;
  }).filter(Boolean);
};
