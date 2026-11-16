import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { validateSpec } from './spec.mjs';

// usage: validate-cli <spec.md>... [--base <git-ref>]
const args = process.argv.slice(2);
const baseIdx = args.indexOf('--base');
const base = baseIdx >= 0 ? args.splice(baseIdx, 2)[1] : undefined;

let failed = false;
for (const file of args) {
  let baseText;
  if (base) {
    try {
      baseText = execFileSync('git', ['show', `${base}:${file}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
      baseText = undefined; // new file
    }
  }
  const { errors, data } = validateSpec(readFileSync(file, 'utf8'), { baseText });
  const stem = basename(file).replace(/\.md$/, '');
  if (data?.id && data.id !== stem) errors.push(`file name must match id (${data.id}.md)`);
  if (errors.length) {
    failed = true;
    console.error(`FAIL ${file}\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  } else {
    console.log(`ok   ${file}`);
  }
}
process.exit(failed ? 1 : 0);
