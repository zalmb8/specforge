import { parse } from 'yaml';

export const SCHEMA_VERSION = 1;
export const STATUSES = ['draft', 'refining', 'approved', 'implementing', 'done'];

// Legal status moves between base (main) and head. Staying put is always legal.
const TRANSITIONS = {
  draft: ['refining', 'approved'], // a refine PR goes straight from main's draft to approved
  refining: ['draft', 'approved'],
  approved: ['refining', 'implementing'],
  implementing: ['approved', 'done'],
  done: [],
};

const BINDING = ['approved', 'implementing', 'done'];

export function parseSpec(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return { error: 'missing YAML frontmatter' };
  let data;
  try {
    data = parse(m[1]);
  } catch (e) {
    return { error: `invalid frontmatter YAML: ${e.message}` };
  }
  if (!data || typeof data !== 'object') return { error: 'frontmatter must be a mapping' };
  return { data, body: m[2] };
}

export function openQuestions(body) {
  const m = /^##\s+Open questions\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/im.exec(body);
  if (!m) return 0;
  return (m[1].match(/^\s*[-*]\s+\[ \]/gm) || []).length;
}

export function validateSpec(text, { baseText } = {}) {
  const errors = [];
  const parsed = parseSpec(text);
  if (parsed.error) return { errors: [parsed.error] };
  const { data, body } = parsed;

  if (data.specforge !== SCHEMA_VERSION) errors.push(`specforge must be ${SCHEMA_VERSION}`);
  if (!data.id || !/^[a-z0-9][a-z0-9-]*$/.test(String(data.id))) errors.push('id must be a lowercase slug');
  if (!data.title) errors.push('title is required');
  if (!STATUSES.includes(data.status)) errors.push(`status must be one of ${STATUSES.join(', ')}`);

  const acs = Array.isArray(data.acceptance) ? data.acceptance : [];
  if (!Array.isArray(data.acceptance)) errors.push('acceptance must be a list');
  const seen = new Set();
  for (const ac of acs) {
    if (!ac || !/^AC-\d+$/.test(String(ac.id))) {
      errors.push(`acceptance id must look like AC-1 (got ${JSON.stringify(ac?.id)})`);
      continue;
    }
    if (seen.has(ac.id)) errors.push(`duplicate acceptance id ${ac.id}`);
    seen.add(ac.id);
    if (!ac.text) errors.push(`${ac.id}: text is required`);
  }

  const open = openQuestions(body);
  if (BINDING.includes(data.status)) {
    if (open > 0) errors.push(`${data.status} spec has ${open} open question(s)`);
    if (acs.length === 0) errors.push(`${data.status} spec needs at least one acceptance criterion`);
    for (const ac of acs) {
      if (!ac?.verify || /^\s*tbd\s*$/i.test(String(ac.verify))) {
        errors.push(`${ac?.id}: verify is required once a spec is ${data.status}`);
      }
    }
  }

  if (baseText !== undefined) {
    const base = parseSpec(baseText);
    const from = base.data?.status;
    if (from && STATUSES.includes(data.status) && from !== data.status
        && !TRANSITIONS[from]?.includes(data.status)) {
      errors.push(`illegal status transition ${from} -> ${data.status}`);
    }
    if (base.data?.id && base.data.id !== data.id) errors.push('id must not change');
  } else if (data.status !== 'draft') {
    errors.push(`new specs must start as draft (got ${data.status})`);
  }

  return { errors, data, open };
}
