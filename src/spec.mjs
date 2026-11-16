import { parse } from 'yaml';

export const SCHEMA_VERSION = 1;
export const STATUSES = ['draft', 'refining', 'approved', 'implementing', 'done'];

// Legal status moves between base (main) and head. Staying put is always legal.
const TRANSITIONS = {
  draft: ['refining', 'approved'], // a refine PR goes straight from main's draft to approved
  refining: ['draft', 'approved'],
  approved: ['refining', 'implementing', 'done'], // a build PR goes straight from main's approved to done
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

  if (data.depends_on !== undefined) {
    const deps = data.depends_on;
    if (!Array.isArray(deps)) errors.push('depends_on must be a list of spec ids');
    else {
      const seenDep = new Set();
      for (const d of deps) {
        if (typeof d !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(d)) errors.push(`depends_on entry ${JSON.stringify(d)} is not a spec id`);
        else if (d === data.id) errors.push('a spec cannot depend on itself');
        else if (seenDep.has(d)) errors.push(`duplicate depends_on entry ${d}`);
        seenDep.add(d);
      }
    }
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

/**
 * Checks the whole dependency tree: every depends_on must name an existing spec, and there must
 * be no cycles, and no two specs may share an id. specs: [{ id, depends_on? }]. Returns a list of error strings.
 */
export function validateTree(specs) {
  const errors = [];
  const byId = new Map(specs.map((s) => [s.id, s]));
  if (byId.size !== specs.length) {
    const seen = new Set();
    for (const s of specs) {
      if (seen.has(s.id)) errors.push(`duplicate spec id "${s.id}"`);
      seen.add(s.id);
    }
  }
  for (const s of specs) {
    for (const d of s.depends_on ?? []) {
      if (!byId.has(d)) errors.push(`${s.id}: depends_on "${d}" does not exist`);
    }
  }
  const state = new Map(); // 1 = on the current path, 2 = done
  const walk = (id, path) => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) {
      errors.push(`dependency cycle: ${[...path.slice(path.indexOf(id)), id].join(' -> ')}`);
      return;
    }
    state.set(id, 1);
    for (const d of byId.get(id)?.depends_on ?? []) if (byId.has(d)) walk(d, [...path, id]);
    state.set(id, 2);
  };
  for (const s of specs) walk(s.id, []);
  return [...new Set(errors)];
}
